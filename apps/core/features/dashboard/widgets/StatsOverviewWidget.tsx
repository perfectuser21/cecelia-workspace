import React, { useEffect, useState } from 'react';
import { WidgetRegistry } from '../../shared/widgets';
import { apiClient } from '../../shared/api/client';
import { Activity, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface Stats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

function StatsOverviewContent() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    apiClient
      .get('/tasks/tasks')
      .then((res) => {
        const tasks = res.data || [];
        setStats({
          total: tasks.length,
          completed: tasks.filter((t: any) => t.status === 'completed').length,
          inProgress: tasks.filter((t: any) => t.status === 'in_progress').length,
          pending: tasks.filter((t: any) => t.status === 'pending').length,
        });
      })
      .catch(() => setStats({ total: 0, completed: 0, inProgress: 0, pending: 0 }));
  }, []);

  if (!stats) {
    return <div className="text-slate-500 text-sm">Loading...</div>;
  }

  const items = [
    { label: 'Total', value: stats.total, icon: Activity, color: 'text-blue-400' },
    { label: 'Done', value: stats.completed, icon: CheckCircle, color: 'text-emerald-400' },
    { label: 'Active', value: stats.inProgress, icon: Clock, color: 'text-amber-400' },
    { label: 'Pending', value: stats.pending, icon: AlertCircle, color: 'text-slate-400' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 h-full">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <item.icon className={`w-4 h-4 ${item.color}`} />
          <div>
            <div className="text-lg font-semibold text-slate-100">{item.value}</div>
            <div className="text-xs text-slate-500">{item.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

WidgetRegistry.register({
  id: 'stats-overview',
  title: 'Stats Overview',
  description: 'Task statistics at a glance',
  category: 'overview',
  defaultSize: { cols: 1, rows: 1 },
  component: StatsOverviewContent,
});
