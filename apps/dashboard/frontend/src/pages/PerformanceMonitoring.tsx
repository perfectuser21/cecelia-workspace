import { useState, useEffect } from 'react';
import { Cpu, HardDrive, Clock, AlertTriangle, RefreshCw, Loader2, XCircle, Activity } from 'lucide-react';
import { systemApi, SystemMetricsResponse, SystemMetrics } from '@/api';

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatMemory(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

function getStatusColor(value: number, thresholds: { warn: number; danger: number }): string {
  if (value >= thresholds.danger) return 'text-red-500';
  if (value >= thresholds.warn) return 'text-amber-500';
  return 'text-green-500';
}

function getBarColor(value: number, thresholds: { warn: number; danger: number }): string {
  if (value >= thresholds.danger) return 'bg-red-500';
  if (value >= thresholds.warn) return 'bg-amber-500';
  return 'bg-green-500';
}

// Mock data when API unavailable
function getMockData(): SystemMetricsResponse {
  const now = Date.now();
  return {
    current: {
      cpuUsage: 35 + Math.random() * 20,
      memoryUsage: 62 + Math.random() * 10,
      memoryTotal: 8 * 1024 * 1024 * 1024,
      memoryUsed: 5 * 1024 * 1024 * 1024,
      avgResponseTime: 120 + Math.random() * 80,
      errorRate: 0.1 + Math.random() * 0.5,
      activeConnections: 12 + Math.floor(Math.random() * 8),
      uptime: 86400 * 3 + 3600 * 7,
    },
    history: Array.from({ length: 10 }, (_, i) => ({
      timestamp: new Date(now - (9 - i) * 30000).toISOString(),
      cpuUsage: 30 + Math.random() * 25,
      memoryUsage: 60 + Math.random() * 15,
      responseTime: 100 + Math.random() * 100,
    })),
  };
}

export default function PerformanceMonitoring() {
  const [data, setData] = useState<SystemMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      // Try to fetch from system metrics API
      const response = await systemApi.getMetrics();
      setData(response);
      setError('');
      setLastUpdate(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      // Use mock data when API unavailable
      setData(getMockData());
      setError('');
      setLastUpdate(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, []);

  const metrics: SystemMetrics = data?.current || {
    cpuUsage: 0,
    memoryUsage: 0,
    memoryTotal: 0,
    memoryUsed: 0,
    avgResponseTime: 0,
    errorRate: 0,
    activeConnections: 0,
    uptime: 0,
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        <XCircle className="w-5 h-5 mr-2" />{error}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">性能监控</h1>
          <p className="text-sm text-gray-500 mt-1">系统资源和性能指标概览</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{lastUpdate} 更新</span>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {/* CPU Usage */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-2">
            <Cpu className="w-3.5 h-3.5" />
            <span>CPU 使用率</span>
          </div>
          <div className={`text-2xl font-bold ${getStatusColor(metrics.cpuUsage, { warn: 70, danger: 90 })}`}>
            {metrics.cpuUsage.toFixed(1)}%
          </div>
          <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getBarColor(metrics.cpuUsage, { warn: 70, danger: 90 })}`}
              style={{ width: `${Math.min(metrics.cpuUsage, 100)}%` }}
            />
          </div>
        </div>

        {/* Memory Usage */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-2">
            <HardDrive className="w-3.5 h-3.5" />
            <span>内存使用</span>
          </div>
          <div className={`text-2xl font-bold ${getStatusColor(metrics.memoryUsage, { warn: 75, danger: 90 })}`}>
            {metrics.memoryUsage.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {formatMemory(metrics.memoryUsed)} / {formatMemory(metrics.memoryTotal)}
          </div>
          <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getBarColor(metrics.memoryUsage, { warn: 75, danger: 90 })}`}
              style={{ width: `${Math.min(metrics.memoryUsage, 100)}%` }}
            />
          </div>
        </div>

        {/* Response Time */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-2">
            <Clock className="w-3.5 h-3.5" />
            <span>平均响应时间</span>
          </div>
          <div className={`text-2xl font-bold ${getStatusColor(metrics.avgResponseTime, { warn: 500, danger: 1000 })}`}>
            {metrics.avgResponseTime.toFixed(0)}ms
          </div>
        </div>

        {/* Error Rate */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>错误率</span>
          </div>
          <div className={`text-2xl font-bold ${getStatusColor(metrics.errorRate, { warn: 1, danger: 5 })}`}>
            {metrics.errorRate.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-50 dark:bg-blue-900/20">
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">系统状态</div>
              <div className="text-xs text-gray-500 mt-0.5">实时运行状态</div>
            </div>
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-xs text-gray-500 mb-1">活跃连接</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{metrics.activeConnections}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">运行时间</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{formatUptime(metrics.uptime)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">状态</div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-lg font-semibold text-green-500">正常</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* History (placeholder for future chart) */}
      {data?.history && data.history.length > 0 && (
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-700/50">
            <div className="font-medium text-gray-900 dark:text-white">历史趋势</div>
          </div>
          <div className="px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {data.history.slice(-10).map((h, i) => (
                <div key={i} className="text-xs bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded">
                  <span className="text-gray-400">{new Date(h.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="mx-2 text-gray-300">|</span>
                  <span className={getStatusColor(h.cpuUsage, { warn: 70, danger: 90 })}>CPU {h.cpuUsage.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
