import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { instanceApi } from '../api/instance.api';

// 主题配置
interface ThemeConfig {
  logo: string;
  logoCollapsed?: string;
  favicon?: string;
  primaryColor: string;
  secondaryColor?: string;
  sidebarGradient?: string;
}

// Instance 配置类型（与后端 API 返回格式一致）
export interface InstanceConfig {
  instance: string;
  name: string;
  theme: ThemeConfig;
  features: Record<string, boolean>;
}

// 默认配置
const defaultConfig: InstanceConfig = {
  instance: 'zenithjoy',
  name: '悦升云端',
  theme: {
    logo: '/logo-white.png',
    logoCollapsed: 'Z',
    primaryColor: '#3467D6',
    sidebarGradient: 'linear-gradient(180deg, #1e3a8a 0%, #1e2a5e 100%)',
  },
  features: {
    'workbench': true,
    'execution-status': true,
    'tasks': true,
    'data-center': true,
    'content': true,
    'platform-status': true,
    'publish-stats': true,
    'scraping': true,
    'tools': true,
    'video-editor': true,
    'canvas': true,
    'settings': true,
  },
};

interface InstanceContextType {
  config: InstanceConfig | null;
  loading: boolean;
  error: string | null;
  isFeatureEnabled: (featureKey: string) => boolean;
}

const InstanceContext = createContext<InstanceContextType | undefined>(undefined);

export function InstanceProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<InstanceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        // 从后端 API 加载配置
        const response = await instanceApi.getConfig();
        if (response.success && response.config) {
          setConfig(response.config);
          applyTheme(response.config.theme);
        } else {
          // API 返回失败，使用默认配置
          console.warn('API returned no config, using default');
          setConfig(defaultConfig);
          applyTheme(defaultConfig.theme);
        }
      } catch (e) {
        console.warn('Failed to load instance config from API, using default:', e);
        setError('Failed to load configuration');
        setConfig(defaultConfig);
        applyTheme(defaultConfig.theme);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  // 应用主题到 CSS 变量
  const applyTheme = (theme: ThemeConfig) => {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', theme.primaryColor);
    root.style.setProperty('--sidebar-gradient', theme.sidebarGradient || 'linear-gradient(180deg, #1e3a8a 0%, #1e2a5e 100%)');

    // 计算派生颜色
    const primaryHex = theme.primaryColor;
    root.style.setProperty('--primary-color-light', `${primaryHex}20`);
    root.style.setProperty('--primary-color-medium', `${primaryHex}40`);
    root.style.setProperty('--primary-color-dark', adjustColor(primaryHex, -20));

    // 更新 favicon
    if (theme.favicon) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = theme.favicon;
      }
    }
  };

  // 检查 feature 是否启用
  const isFeatureEnabled = (featureKey: string): boolean => {
    if (!config) return true; // 配置未加载时默认启用
    const enabled = config.features[featureKey];
    return enabled !== false; // 未定义的 feature 默认启用
  };

  return (
    <InstanceContext.Provider value={{ config, loading, error, isFeatureEnabled }}>
      {children}
    </InstanceContext.Provider>
  );
}

export function useInstance() {
  const context = useContext(InstanceContext);
  if (context === undefined) {
    throw new Error('useInstance must be used within an InstanceProvider');
  }
  return context;
}

// 辅助函数：调整颜色亮度
function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}
