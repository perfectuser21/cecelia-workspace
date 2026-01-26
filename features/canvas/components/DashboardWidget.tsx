import { useState, useEffect } from 'react';
import { Trash2, Settings } from 'lucide-react';
import type { DashboardWidget as WidgetType } from '../hooks/useDashboardLayout';
import { MermaidRenderer } from './MermaidRenderer';
import { EChartsRenderer } from './EChartsRenderer';
import { D3ForceRenderer } from './D3ForceRenderer';

interface DashboardWidgetProps {
  widget: WidgetType;
  onRemove: (id: string) => void;
  onConfigure: (id: string) => void;
}

export function DashboardWidget({
  widget,
  onRemove,
  onConfigure,
}: DashboardWidgetProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch data from data source if URL is provided
  useEffect(() => {
    if (!widget.config.dataSource?.url) {
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(widget.config.dataSource!.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch data';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up auto-refresh if interval is specified
    const refreshInterval = widget.config.dataSource.refreshInterval;
    if (refreshInterval && refreshInterval > 0) {
      const intervalId = setInterval(fetchData, refreshInterval * 1000);
      return () => clearInterval(intervalId);
    }
  }, [widget.config.dataSource]);

  const handleRemove = () => {
    if (confirm('Are you sure you want to remove this widget?')) {
      onRemove(widget.id);
    }
  };

  const renderContent = () => {
    // If data source is loading
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-slate-400">Loading data...</div>
        </div>
      );
    }

    // If data source has error
    if (error) {
      return (
        <div className="flex items-center justify-center h-full p-4">
          <div className="text-center">
            <div className="text-red-400 font-semibold mb-2">Data Error</div>
            <div className="text-red-300 text-sm">{error}</div>
          </div>
        </div>
      );
    }

    // Render based on widget type
    const config = data || widget.config.widgetConfig;

    switch (widget.type) {
      case 'mermaid':
        return <MermaidRenderer content={config?.content || ''} />;

      case 'chart':
        return (
          <EChartsRenderer
            type={config?.type || 'bar'}
            data={config?.data || {}}
            title={config?.title}
          />
        );

      case 'network':
        return (
          <D3ForceRenderer
            nodes={config?.nodes || []}
            links={config?.links || []}
          />
        );

      default:
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-400">Unknown widget type</div>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      {/* Widget Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="text-sm font-medium text-slate-200 truncate">
          {widget.config.title || `${widget.type} Widget`}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onConfigure(widget.id)}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
            title="Configure widget"
          >
            <Settings className="w-4 h-4 text-slate-400 hover:text-slate-200" />
          </button>
          <button
            onClick={handleRemove}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
            title="Remove widget"
          >
            <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-400" />
          </button>
        </div>
      </div>

      {/* Widget Content */}
      <div className="flex-1 overflow-auto p-4">{renderContent()}</div>
    </div>
  );
}

export default DashboardWidget;
