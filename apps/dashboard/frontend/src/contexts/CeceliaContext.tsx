import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Navigation, Sparkles } from 'lucide-react';

// Page display names for navigation toast
const PAGE_DISPLAY_NAMES: Record<string, string> = {
  '/okr': 'OKR 目标',
  '/projects': '项目列表',
  '/orchestrator': 'Command Center',
  '/tasks': '任务列表',
  '/planner': '工作规划',
  '/brain': '大脑',
  '/': '首页',
};

// ============ Types ============

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  isVoice?: boolean;
  isStreaming?: boolean;
  toolCall?: {
    name: string;
    result: any;
  };
}

// Page state that each page registers
export interface PageState {
  pageType: string;           // 'okr' | 'projects' | 'project-detail' | 'orchestrator' | etc
  title: string;              // Page title for Cecelia to know
  data: any;                  // Current page data (OKRs, projects, tasks, etc)
  uiState: Record<string, any>; // UI state (expandedIds, selectedId, filters, etc)
  summary?: string;           // Brief summary of what's on the page
}

// Actions that each page registers
export interface PageActions {
  // Common actions
  refresh?: () => void;
  // Item actions
  expandItem?: (id: string) => void;
  collapseItem?: (id: string) => void;
  toggleItem?: (id: string) => void;
  selectItem?: (id: string) => void;
  // Custom actions - pages can register their own
  [key: string]: ((...args: any[]) => any) | undefined;
}

// Frontend Tool definitions
export interface FrontendTool {
  name: string;
  description: string;
  parameters: {
    name: string;
    type: string;
    description: string;
    required?: boolean;
  }[];
  execute: (args: Record<string, any>, context: CeceliaContextType) => Promise<string>;
}

// Navigation toast state
interface NavigationToast {
  visible: boolean;
  destination: string;
  path: string;
}

interface CeceliaContextType {
  // Chat state
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearMessages: () => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  toggleChat: () => void;
  input: string;
  setInput: (input: string) => void;
  sending: boolean;
  setSending: (sending: boolean) => void;
  generateId: () => string;
  currentStreamingIdRef: React.MutableRefObject<string | null>;

  // Page awareness
  currentRoute: string;
  pageState: PageState | null;
  pageActions: PageActions;
  registerPage: (state: PageState, actions: PageActions) => void;
  unregisterPage: () => void;

  // Navigation
  navigateTo: (path: string) => void;
  showNavigationToast: (path: string) => void;

  // Frontend Tools
  frontendTools: FrontendTool[];
  executeFrontendTool: (toolName: string, args: Record<string, any>) => Promise<string>;

  // Get page context for AI
  getPageContext: () => string;
}

const CeceliaContext = createContext<CeceliaContextType | undefined>(undefined);

// ============ Frontend Tools ============

const createFrontendTools = (
  navigate: (path: string) => void,
  showToast: (path: string) => void,
  onNavigate?: (path: string) => void
): FrontendTool[] => [
  {
    name: 'get_current_page',
    description: 'Get information about what page the user is currently viewing',
    parameters: [],
    execute: async (_, context) => {
      if (!context.pageState) {
        return `User is at ${context.currentRoute} but page hasn't registered its state yet.`;
      }
      return context.getPageContext();
    }
  },
  {
    name: 'navigate_to',
    description: 'Navigate to a different page',
    parameters: [
      { name: 'path', type: 'string', description: 'The path to navigate to, e.g., "/okr", "/projects", "/projects/123"', required: true }
    ],
    execute: async (args) => {
      const { path } = args;
      console.log('[Cecelia] Executing navigate_to:', path);
      // Show navigation toast
      showToast(path);
      // Call onNavigate callback (e.g., to collapse sidebar)
      onNavigate?.(path);
      // Use the navigate function directly (passed to createFrontendTools)
      navigate(path);
      console.log('[Cecelia] Navigation executed');
      const displayName = PAGE_DISPLAY_NAMES[path] || path;
      return `🧭 正在前往「${displayName}」`;
    }
  },
  {
    name: 'expand_item',
    description: 'Expand an item on the current page (e.g., expand an OKR to show its key results)',
    parameters: [
      { name: 'id', type: 'string', description: 'The ID of the item to expand', required: true }
    ],
    execute: async (args, context) => {
      if (!context.pageActions.expandItem) {
        return 'This page does not support expanding items';
      }
      context.pageActions.expandItem(args.id);
      return `Expanded item ${args.id}`;
    }
  },
  {
    name: 'collapse_item',
    description: 'Collapse an expanded item on the current page',
    parameters: [
      { name: 'id', type: 'string', description: 'The ID of the item to collapse', required: true }
    ],
    execute: async (args, context) => {
      if (!context.pageActions.collapseItem) {
        return 'This page does not support collapsing items';
      }
      context.pageActions.collapseItem(args.id);
      return `Collapsed item ${args.id}`;
    }
  },
  {
    name: 'toggle_item',
    description: 'Toggle an item expanded/collapsed on the current page',
    parameters: [
      { name: 'id', type: 'string', description: 'The ID of the item to toggle', required: true }
    ],
    execute: async (args, context) => {
      if (!context.pageActions.toggleItem) {
        return 'This page does not support toggling items';
      }
      context.pageActions.toggleItem(args.id);
      return `Toggled item ${args.id}`;
    }
  },
  {
    name: 'refresh_page',
    description: 'Refresh the current page data',
    parameters: [],
    execute: async (_, context) => {
      if (!context.pageActions.refresh) {
        return 'This page does not support refresh';
      }
      context.pageActions.refresh();
      return 'Page refreshed';
    }
  },
  {
    name: 'set_filter',
    description: 'Set a filter on the current page',
    parameters: [
      { name: 'filterName', type: 'string', description: 'Name of the filter (e.g., "status", "priority")', required: true },
      { name: 'value', type: 'string', description: 'Filter value (e.g., "active", "P0")', required: true }
    ],
    execute: async (args, context) => {
      const setFilter = context.pageActions[`setFilter_${args.filterName}`] || context.pageActions.setFilter;
      if (!setFilter) {
        return `This page does not support ${args.filterName} filter`;
      }
      setFilter(args.filterName, args.value);
      return `Set ${args.filterName} filter to ${args.value}`;
    }
  }
];

// ============ Provider ============

interface CeceliaProviderProps {
  children: ReactNode;
  onNavigate?: (path: string) => void;  // Called when navigation occurs (for sidebar collapse etc.)
}

export function CeceliaProvider({ children, onNavigate }: CeceliaProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const currentStreamingIdRef = useRef<string | null>(null);

  // Page state
  const [pageState, setPageState] = useState<PageState | null>(null);
  const [pageActions, setPageActions] = useState<PageActions>({});

  // Navigation toast state
  const [navToast, setNavToast] = useState<NavigationToast>({ visible: false, destination: '', path: '' });

  // Show navigation toast
  const showNavigationToast = useCallback((path: string) => {
    const displayName = PAGE_DISPLAY_NAMES[path] || path;
    setNavToast({ visible: true, destination: displayName, path });
    // Auto-hide after 2.5 seconds (matches progress bar animation)
    setTimeout(() => {
      setNavToast(prev => ({ ...prev, visible: false }));
    }, 2500);
  }, []);

  const generateId = useCallback(() => {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }, []);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, ...updates } : msg
    ));
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    currentStreamingIdRef.current = null;
  }, []);

  const toggleChat = useCallback(() => {
    setChatOpen(prev => !prev);
  }, []);

  // Page registration
  const registerPage = useCallback((state: PageState, actions: PageActions) => {
    setPageState(state);
    setPageActions(actions);
  }, []);

  const unregisterPage = useCallback(() => {
    setPageState(null);
    setPageActions({});
  }, []);

  // Navigation
  const navigateTo = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  // Frontend tools
  const frontendTools = useMemo(() => createFrontendTools(navigate, showNavigationToast, onNavigate), [navigate, showNavigationToast, onNavigate]);

  // Execute frontend tool
  const executeFrontendTool = useCallback(async (toolName: string, args: Record<string, any>): Promise<string> => {
    console.log('[Cecelia] executeFrontendTool called:', toolName, args);
    const tool = frontendTools.find(t => t.name === toolName);
    if (!tool) {
      console.log('[Cecelia] Tool not found:', toolName);
      return `Unknown tool: ${toolName}`;
    }
    console.log('[Cecelia] Found tool, executing...');

    // We need to pass the current context to the tool
    // This is a bit tricky since we're inside the provider
    // We'll create a snapshot of the context
    const contextSnapshot: CeceliaContextType = {
      messages,
      addMessage,
      updateMessage,
      clearMessages,
      chatOpen,
      setChatOpen,
      toggleChat,
      input,
      setInput,
      sending,
      setSending,
      generateId,
      currentStreamingIdRef,
      currentRoute: location.pathname,
      pageState,
      pageActions,
      registerPage,
      unregisterPage,
      navigateTo,
      frontendTools,
      executeFrontendTool: async () => '', // Placeholder
      getPageContext: () => '', // Will be set below
    };

    // Set getPageContext
    contextSnapshot.getPageContext = () => {
      if (!pageState) {
        return `Current page: ${location.pathname}\nNo page state registered.`;
      }

      let context = `Current page: ${location.pathname}\n`;
      context += `Page type: ${pageState.pageType}\n`;
      context += `Title: ${pageState.title}\n`;

      if (pageState.summary) {
        context += `Summary: ${pageState.summary}\n`;
      }

      if (pageState.uiState && Object.keys(pageState.uiState).length > 0) {
        context += `UI State: ${JSON.stringify(pageState.uiState)}\n`;
      }

      if (pageState.data) {
        // Provide a summary of data, not the full data
        if (Array.isArray(pageState.data)) {
          context += `Data: ${pageState.data.length} items\n`;
          // Show first few items
          const preview = pageState.data.slice(0, 5).map((item: any) =>
            item.title || item.name || item.id
          ).join(', ');
          context += `Preview: ${preview}${pageState.data.length > 5 ? '...' : ''}\n`;
        } else if (typeof pageState.data === 'object') {
          context += `Data: ${JSON.stringify(pageState.data, null, 2).slice(0, 500)}...\n`;
        }
      }

      // Available actions
      const availableActions = Object.keys(pageActions).filter(k => pageActions[k]);
      if (availableActions.length > 0) {
        context += `Available actions: ${availableActions.join(', ')}\n`;
      }

      return context;
    };

    return await tool.execute(args, contextSnapshot);
  }, [frontendTools, messages, addMessage, updateMessage, clearMessages, chatOpen, setChatOpen, toggleChat, input, setInput, sending, setSending, generateId, currentStreamingIdRef, location.pathname, pageState, pageActions, registerPage, unregisterPage, navigateTo]);

  // Get page context for AI
  const getPageContext = useCallback(() => {
    if (!pageState) {
      return `Current page: ${location.pathname}\nNo page state registered.`;
    }

    let context = `Current page: ${location.pathname}\n`;
    context += `Page type: ${pageState.pageType}\n`;
    context += `Title: ${pageState.title}\n`;

    if (pageState.summary) {
      context += `Summary: ${pageState.summary}\n`;
    }

    if (pageState.uiState && Object.keys(pageState.uiState).length > 0) {
      context += `UI State: ${JSON.stringify(pageState.uiState)}\n`;
    }

    if (pageState.data) {
      if (Array.isArray(pageState.data)) {
        context += `Data: ${pageState.data.length} items\n`;
        const preview = pageState.data.slice(0, 5).map((item: any) =>
          item.title || item.name || item.id
        ).join(', ');
        context += `Preview: ${preview}${pageState.data.length > 5 ? '...' : ''}\n`;
      } else if (typeof pageState.data === 'object') {
        context += `Data: ${JSON.stringify(pageState.data, null, 2).slice(0, 500)}...\n`;
      }
    }

    const availableActions = Object.keys(pageActions).filter(k => pageActions[k]);
    if (availableActions.length > 0) {
      context += `Available actions: ${availableActions.join(', ')}\n`;
    }

    return context;
  }, [location.pathname, pageState, pageActions]);

  const value: CeceliaContextType = {
    // Chat
    messages,
    addMessage,
    updateMessage,
    clearMessages,
    chatOpen,
    setChatOpen,
    toggleChat,
    input,
    setInput,
    sending,
    setSending,
    generateId,
    currentStreamingIdRef,
    // Page awareness
    currentRoute: location.pathname,
    pageState,
    pageActions,
    registerPage,
    unregisterPage,
    // Navigation
    navigateTo,
    showNavigationToast,
    // Frontend Tools
    frontendTools,
    executeFrontendTool,
    getPageContext,
  };

  return (
    <CeceliaContext.Provider value={value}>
      {children}

      {/* Navigation Toast - Full width banner at top */}
      <div
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ease-out ${
          navToast.visible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
      >
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/90 via-purple-600/90 to-indigo-600/90 backdrop-blur-lg" />

        {/* Animated glow overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-violet-400/0 via-white/20 to-violet-400/0 animate-pulse" />

        {/* Content */}
        <div className="relative flex items-center justify-center gap-4 px-6 py-4">
          {/* Animated icon */}
          <div className="relative">
            <div className="absolute inset-0 bg-white/30 rounded-full blur-md animate-ping" />
            <div className="relative p-2.5 bg-white/20 backdrop-blur rounded-full border border-white/30">
              <Navigation className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Text content */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/80 font-medium">正在前往</span>
            <span className="text-lg font-bold text-white tracking-wide">{navToast.destination}</span>
            <Sparkles className="w-5 h-5 text-white/80 animate-pulse" />
          </div>
        </div>

        {/* Progress bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <div
            className="h-full bg-white/80"
            style={{
              animation: 'progress 2.5s ease-out forwards',
            }}
          />
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </CeceliaContext.Provider>
  );
}

export function useCecelia() {
  const context = useContext(CeceliaContext);
  if (context === undefined) {
    throw new Error('useCecelia must be used within a CeceliaProvider');
  }
  return context;
}

// Hook for pages to register themselves
export function useCeceliaPage(
  pageType: string,
  title: string,
  getData: () => any,
  getUiState: () => Record<string, any>,
  actions: PageActions,
  getSummary?: () => string
) {
  const { registerPage, unregisterPage } = useCecelia();

  // Register on mount and when deps change
  const register = useCallback(() => {
    registerPage(
      {
        pageType,
        title,
        data: getData(),
        uiState: getUiState(),
        summary: getSummary?.(),
      },
      actions
    );
  }, [registerPage, pageType, title, getData, getUiState, actions, getSummary]);

  return { register, unregisterPage };
}
