import { useState, useEffect, useCallback, useRef } from 'react';
import type { Layout } from 'react-grid-layout';

export interface DashboardWidget {
  id: string;
  type: 'mermaid' | 'chart' | 'network';
  x: number;
  y: number;
  w: number;
  h: number;
  config: {
    title?: string;
    dataSource?: {
      url: string;
      refreshInterval?: number;
    };
    widgetConfig?: any;
  };
}

interface DashboardLayout {
  widgets: DashboardWidget[];
}

const STORAGE_KEY = 'cecelia-dashboard-layout';
const DEBOUNCE_DELAY = 500;

export function useDashboardLayout() {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load layout from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const layout: DashboardLayout = JSON.parse(saved);
        setWidgets(layout.widgets || []);
      } else {
        // Initialize with sample widgets
        const initialWidgets: DashboardWidget[] = [
          {
            id: 'widget-1',
            type: 'mermaid',
            x: 0,
            y: 0,
            w: 6,
            h: 4,
            config: {
              title: 'Sample Mermaid Diagram',
              widgetConfig: {
                content: 'graph TD\n  A[Start] --> B[Process]\n  B --> C[End]',
              },
            },
          },
          {
            id: 'widget-2',
            type: 'chart',
            x: 6,
            y: 0,
            w: 6,
            h: 4,
            config: {
              title: 'Sample Chart',
              widgetConfig: {
                type: 'bar',
                data: {
                  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
                  datasets: [
                    {
                      label: 'Sales',
                      data: [12, 19, 3, 5, 2],
                    },
                  ],
                },
              },
            },
          },
        ];
        setWidgets(initialWidgets);
      }
    } catch (error) {
      console.error('Failed to load dashboard layout:', error);
      setWidgets([]);
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Save layout to localStorage with debouncing
  const saveLayout = useCallback(
    (updatedWidgets: DashboardWidget[]) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        try {
          const layout: DashboardLayout = { widgets: updatedWidgets };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
        } catch (error) {
          console.error('Failed to save dashboard layout:', error);
        }
      }, DEBOUNCE_DELAY);
    },
    []
  );

  // Update widget positions based on layout changes
  const updateLayout = useCallback(
    (layout: Layout[]) => {
      const updatedWidgets = widgets.map((widget) => {
        const layoutItem = layout.find((item) => item.i === widget.id);
        if (layoutItem) {
          return {
            ...widget,
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h,
          };
        }
        return widget;
      });

      setWidgets(updatedWidgets);
      saveLayout(updatedWidgets);
    },
    [widgets, saveLayout]
  );

  // Add a new widget
  const addWidget = useCallback(
    (widget: DashboardWidget) => {
      const updatedWidgets = [...widgets, widget];
      setWidgets(updatedWidgets);
      saveLayout(updatedWidgets);
    },
    [widgets, saveLayout]
  );

  // Remove a widget
  const removeWidget = useCallback(
    (id: string) => {
      const updatedWidgets = widgets.filter((widget) => widget.id !== id);
      setWidgets(updatedWidgets);
      saveLayout(updatedWidgets);
    },
    [widgets, saveLayout]
  );

  // Update widget config
  const updateWidgetConfig = useCallback(
    (id: string, config: Partial<DashboardWidget['config']>) => {
      const updatedWidgets = widgets.map((widget) =>
        widget.id === id
          ? { ...widget, config: { ...widget.config, ...config } }
          : widget
      );
      setWidgets(updatedWidgets);
      saveLayout(updatedWidgets);
    },
    [widgets, saveLayout]
  );

  // Convert widgets to react-grid-layout format
  const layout: Layout[] = widgets.map((widget) => ({
    i: widget.id,
    x: widget.x,
    y: widget.y,
    w: widget.w,
    h: widget.h,
  }));

  return {
    widgets,
    layout,
    updateLayout,
    addWidget,
    removeWidget,
    updateWidgetConfig,
  };
}
