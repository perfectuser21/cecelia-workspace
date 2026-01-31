import React, { useEffect, useState } from 'react';
import { WidgetRegistry } from '../../shared/widgets';
import { apiClient } from '../../shared/api/client';
import { Server, CheckCircle, XCircle } from 'lucide-react';

interface HealthStatus {
  status: string;
  uptime?: number;
}

function SystemHealthContent() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    apiClient
      .get('/system/health')
      .then((res) => setHealth(res.data))
      .catch(() => setHealth({ status: 'error' }));
  }, []);

  if (!health) {
    return <div className="text-slate-500 text-sm">Checking...</div>;
  }

  const isHealthy = health.status === 'ok' || health.status === 'healthy';

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <div className={`p-3 rounded-full ${isHealthy ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
        {isHealthy ? (
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        ) : (
          <XCircle className="w-8 h-8 text-red-400" />
        )}
      </div>
      <div className="text-center">
        <div className={`text-sm font-medium ${isHealthy ? 'text-emerald-400' : 'text-red-400'}`}>
          {isHealthy ? 'Healthy' : 'Degraded'}
        </div>
        {health.uptime != null && (
          <div className="text-xs text-slate-500 mt-1">
            Uptime: {Math.floor(health.uptime / 3600)}h
          </div>
        )}
      </div>
    </div>
  );
}

WidgetRegistry.register({
  id: 'system-health',
  title: 'System Health',
  description: 'Current system health status',
  category: 'system',
  defaultSize: { cols: 1, rows: 1 },
  component: SystemHealthContent,
});
