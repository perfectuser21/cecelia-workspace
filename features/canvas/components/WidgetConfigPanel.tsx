import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { DashboardWidget } from '../hooks/useDashboardLayout';

interface WidgetConfigPanelProps {
  widget: DashboardWidget;
  onClose: () => void;
  onSave: (config: Partial<DashboardWidget['config']>) => void;
}

export function WidgetConfigPanel({
  widget,
  onClose,
  onSave,
}: WidgetConfigPanelProps) {
  const [title, setTitle] = useState(widget.config.title || '');
  const [dataSourceUrl, setDataSourceUrl] = useState(
    widget.config.dataSource?.url || ''
  );
  const [refreshInterval, setRefreshInterval] = useState(
    widget.config.dataSource?.refreshInterval?.toString() || ''
  );

  const handleSave = () => {
    const config: Partial<DashboardWidget['config']> = {
      title: title || undefined,
    };

    if (dataSourceUrl) {
      config.dataSource = {
        url: dataSourceUrl,
        refreshInterval: refreshInterval ? parseInt(refreshInterval, 10) : undefined,
      };
    }

    onSave(config);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-200">
            Configure Widget
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-400 hover:text-slate-200" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Widget Type (read-only) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Widget Type
            </label>
            <div className="px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-400 text-sm">
              {widget.type}
            </div>
          </div>

          {/* Title */}
          <div>
            <label
              htmlFor="widget-title"
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              Title
            </label>
            <input
              id="widget-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`${widget.type} Widget`}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Data Source URL */}
          <div>
            <label
              htmlFor="data-source-url"
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              Data Source URL (optional)
            </label>
            <input
              id="data-source-url"
              type="text"
              value={dataSourceUrl}
              onChange={(e) => setDataSourceUrl(e.target.value)}
              placeholder="https://api.example.com/data"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Leave empty to use static configuration
            </p>
          </div>

          {/* Refresh Interval */}
          {dataSourceUrl && (
            <div>
              <label
                htmlFor="refresh-interval"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Refresh Interval (seconds)
              </label>
              <input
                id="refresh-interval"
                type="number"
                min="0"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(e.target.value)}
                placeholder="30"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                Set to 0 to disable auto-refresh
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default WidgetConfigPanel;
