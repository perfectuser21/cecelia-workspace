import React, { useEffect, useState } from 'react';
import { WidgetRegistry } from '../../shared/widgets';
import { apiClient } from '../../shared/api/client';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
}

const statusColors: Record<string, string> = {
  completed: 'bg-emerald-500/20 text-emerald-400',
  in_progress: 'bg-amber-500/20 text-amber-400',
  pending: 'bg-slate-500/20 text-slate-400',
};

function RecentTasksContent() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    apiClient
      .get('/tasks/tasks')
      .then((res) => {
        const all = res.data || [];
        setTasks(all.slice(0, 5));
      })
      .catch(() => setTasks([]));
  }, []);

  if (tasks.length === 0) {
    return <div className="text-slate-500 text-sm">No tasks</div>;
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-center justify-between py-1.5 border-b border-slate-700/30 last:border-0"
        >
          <span className="text-sm text-slate-300 truncate flex-1 mr-2">{task.title}</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${statusColors[task.status] || statusColors.pending}`}
          >
            {task.status}
          </span>
        </div>
      ))}
    </div>
  );
}

WidgetRegistry.register({
  id: 'recent-tasks',
  title: 'Recent Tasks',
  description: 'Latest tasks from the task system',
  category: 'tasks',
  defaultSize: { cols: 2, rows: 1 },
  component: RecentTasksContent,
});
