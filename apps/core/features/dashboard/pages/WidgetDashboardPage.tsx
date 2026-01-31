import React from 'react';
import { WidgetGrid, WidgetRegistry, WidgetLayout } from '../../shared/widgets';
import { LayoutGrid } from 'lucide-react';

// Register example widgets by importing them
import '../widgets/StatsOverviewWidget';
import '../widgets/RecentTasksWidget';
import '../widgets/SystemHealthWidget';

const defaultLayout: WidgetLayout[] = [
  { widgetId: 'stats-overview', col: 0, row: 0 },
  { widgetId: 'system-health', col: 0, row: 0 },
  { widgetId: 'recent-tasks', col: 0, row: 0, size: { cols: 2, rows: 1 } },
];

export default function WidgetDashboardPage() {
  const widgets = WidgetRegistry.getAll();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/25">
          <LayoutGrid className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-100">Widget Dashboard</h1>
          <p className="text-sm text-slate-400">
            {widgets.length} widgets registered
          </p>
        </div>
      </div>

      <WidgetGrid layout={defaultLayout} columns={4} />
    </div>
  );
}
