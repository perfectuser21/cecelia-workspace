/**
 * LiveMonitorPage - Cecelia Live Monitor Dashboard (Enhanced)
 *
 * 实时监控 Cecelia Brain 的工作状态 - 丰富信息展示版
 * 布局：多维度网格（Brain / Resources / Tasks / Logs / Completions / Alerts / Queue / DB）
 */

import { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Pause,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Zap,
  TrendingUp,
  Users,
  Server,
  GitBranch,
  FileText,
  Shield,
} from 'lucide-react';

// ============ Enhanced Mock Data ============
const mockBrainStatus = {
  running: true,
  tick_number: 1847,
  alertness: { level: 1, name: 'NORMAL', color: 'green' },
  uptime_seconds: 87345, // ~24h
  circuit_breaker: {
    status: 'closed',
    failures: 0,
    last_check: new Date().toISOString(),
  },
  watchdog: {
    rss_mb: 245,
    cpu_percent: 12.5,
    healthy: true,
  },
  last_tick_duration_ms: 450,
};

const mockResources = {
  cpu_percent: 45,
  memory_percent: 68,
  disk_percent: 34,
  network_rx_mbps: 12.5,
  network_tx_mbps: 8.3,
  task_counts: {
    active: 7,
    queued: 12,
    quarantined: 2,
    completed_today: 156,
  },
  api_stats: {
    requests_per_minute: 342,
    avg_response_ms: 85,
    error_rate: 0.03,
  },
};

const mockActiveTasks = [
  {
    id: '890',
    title: '重置 embeddings 重试',
    status: 'in_progress',
    priority: 'P0',
    progress: 85,
    started_at: new Date(Date.now() - 765000).toISOString(),
    elapsed_seconds: 765,
    executor: 'Caramel',
  },
  {
    id: '891',
    title: '熔断机制增强 PR #308',
    status: 'in_progress',
    priority: 'P1',
    progress: 42,
    started_at: new Date(Date.now() - 320000).toISOString(),
    elapsed_seconds: 320,
    executor: 'Caramel',
  },
  {
    id: '892',
    title: 'Platform Scraper 抖音数据',
    status: 'in_progress',
    priority: 'P1',
    progress: 68,
    started_at: new Date(Date.now() - 540000).toISOString(),
    elapsed_seconds: 540,
    executor: 'AutoScraper',
  },
  {
    id: '893',
    title: '今日头条发布调度',
    status: 'in_progress',
    priority: 'P2',
    progress: 12,
    started_at: new Date(Date.now() - 120000).toISOString(),
    elapsed_seconds: 120,
    executor: 'Publisher',
  },
  {
    id: '894',
    title: 'OKR 拆解 - Q1 2026',
    status: 'queued',
    priority: 'P0',
    progress: 0,
    blocked_by: ['890'],
  },
  {
    id: '895',
    title: 'Database Migration 028',
    status: 'queued',
    priority: 'P1',
    progress: 0,
    blocked_by: ['891'],
  },
  {
    id: '896',
    title: 'Quality Gate 检查',
    status: 'queued',
    priority: 'P2',
    progress: 0,
  },
];

const mockRecentCompletions = [
  { id: '887', title: 'Core rebuild 完成', completed_at: new Date(Date.now() - 180000), duration_seconds: 24 },
  { id: '888', title: 'LiveMonitor 路由注册', completed_at: new Date(Date.now() - 240000), duration_seconds: 156 },
  { id: '889', title: 'Docker 容器重启', completed_at: new Date(Date.now() - 360000), duration_seconds: 8 },
  { id: '886', title: 'Dashboard 构建', completed_at: new Date(Date.now() - 420000), duration_seconds: 31 },
  { id: '885', title: 'PR #307 合并', completed_at: new Date(Date.now() - 540000), duration_seconds: 12 },
];

const mockQuarantineZone = [
  { id: '782', title: 'N8N Workflow 创建失败', reason: '连续失败 3 次', quarantined_at: new Date(Date.now() - 3600000) },
  { id: '801', title: 'API 超时任务', reason: '执行时间超过 10 分钟', quarantined_at: new Date(Date.now() - 7200000) },
];

const mockAlerts = [
  { level: 'warning', message: 'CPU 使用率持续高于 60% (2min)', timestamp: new Date(Date.now() - 120000) },
  { level: 'warning', message: 'Queue 深度达到 12（阈值 10）', timestamp: new Date(Date.now() - 240000) },
  { level: 'info', message: 'Watchdog 健康检查通过', timestamp: new Date(Date.now() - 300000) },
];

let logCounter = 0;
const generateMockLog = () => {
  const sources = ['tick-loop', 'executor', 'watchdog', 'task', 'alertness', 'api', 'database', 'queue'];
  const messages = [
    `Tick #${mockBrainStatus.tick_number} completed in ${mockBrainStatus.last_tick_duration_ms}ms`,
    `Dispatched task #${Math.floor(Math.random() * 1000)}`,
    `CPU: ${mockResources.cpu_percent}%, Memory: ${mockResources.memory_percent}%`,
    `API request processed: 200 OK (${Math.floor(Math.random() * 200)}ms)`,
    `Queue depth: ${mockResources.task_counts.queued}`,
    `Database query: SELECT * FROM tasks LIMIT 10 (${Math.floor(Math.random() * 50)}ms)`,
    `Alertness level: ${mockBrainStatus.alertness.name}`,
    `Watchdog RSS: ${mockBrainStatus.watchdog.rss_mb}MB`,
    `Task #${Math.floor(Math.random() * 1000)} completed successfully`,
    `Circuit breaker status: ${mockBrainStatus.circuit_breaker.status}`,
  ];

  return {
    id: logCounter++,
    timestamp: new Date(),
    source: sources[Math.floor(Math.random() * sources.length)],
    message: messages[Math.floor(Math.random() * messages.length)],
    level: Math.random() > 0.9 ? 'warning' : 'info',
  };
};

const initialLogs = Array.from({ length: 15 }, generateMockLog);

// ============ Helper Functions ============
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

function getProgressColor(percent: number): string {
  if (percent < 60) return 'bg-green-500';
  if (percent < 80) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getPriorityColor(priority: string): string {
  if (priority === 'P0') return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
  if (priority === 'P1') return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
}

// ============ Components ============

function BrainStatusCard() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3 mb-4">
        <Activity className="w-5 h-5 text-blue-500" />
        <h3 className="font-semibold text-slate-800 dark:text-white">Brain Status</h3>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${mockBrainStatus.running ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {mockBrainStatus.running ? 'Running' : 'Stopped'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-slate-500 dark:text-slate-400">Tick</div>
            <div className="font-medium text-slate-700 dark:text-slate-300">#{mockBrainStatus.tick_number}</div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">Alertness</div>
            <div className="font-medium text-green-600 dark:text-green-400">{mockBrainStatus.alertness.name}</div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">Uptime</div>
            <div className="font-medium text-slate-700 dark:text-slate-300">{formatUptime(mockBrainStatus.uptime_seconds)}</div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">Tick Duration</div>
            <div className="font-medium text-slate-700 dark:text-slate-300">{mockBrainStatus.last_tick_duration_ms}ms</div>
          </div>
        </div>

        {/* Circuit Breaker */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Circuit Breaker
            </span>
            <span className="font-medium text-green-600 dark:text-green-400 uppercase">{mockBrainStatus.circuit_breaker.status}</span>
          </div>
        </div>

        {/* Watchdog */}
        <div className="pt-2">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">Watchdog</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">RSS</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{mockBrainStatus.watchdog.rss_mb}MB</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">CPU</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{mockBrainStatus.watchdog.cpu_percent}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResourcesCard() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3 mb-4">
        <Cpu className="w-5 h-5 text-blue-500" />
        <h3 className="font-semibold text-slate-800 dark:text-white">System Resources</h3>
      </div>

      <div className="space-y-4">
        {/* CPU */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-slate-600 dark:text-slate-400">CPU</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{mockResources.cpu_percent}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getProgressColor(mockResources.cpu_percent)}`}
              style={{ width: `${mockResources.cpu_percent}%` }}
            />
          </div>
        </div>

        {/* Memory */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-slate-600 dark:text-slate-400">Memory</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{mockResources.memory_percent}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getProgressColor(mockResources.memory_percent)}`}
              style={{ width: `${mockResources.memory_percent}%` }}
            />
          </div>
        </div>

        {/* Disk */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-slate-600 dark:text-slate-400">Disk</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{mockResources.disk_percent}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getProgressColor(mockResources.disk_percent)}`}
              style={{ width: `${mockResources.disk_percent}%` }}
            />
          </div>
        </div>

        {/* Network */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Network RX</div>
            <div className="font-medium text-slate-700 dark:text-slate-300">{mockResources.network_rx_mbps} MB/s</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Network TX</div>
            <div className="font-medium text-slate-700 dark:text-slate-300">{mockResources.network_tx_mbps} MB/s</div>
          </div>
        </div>

        {/* Task Counts */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Active</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{mockResources.task_counts.active}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Queued</span>
              <span className="font-bold text-yellow-600 dark:text-yellow-400">{mockResources.task_counts.queued}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Quarantined</span>
              <span className="font-bold text-red-600 dark:text-red-400">{mockResources.task_counts.quarantined}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Done Today</span>
              <span className="font-bold text-green-600 dark:text-green-400">{mockResources.task_counts.completed_today}</span>
            </div>
          </div>
        </div>

        {/* API Stats */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            API Statistics
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-xs text-slate-500">Requests/min</div>
              <div className="font-medium text-slate-700 dark:text-slate-300">{mockResources.api_stats.requests_per_minute}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Avg Response</div>
              <div className="font-medium text-slate-700 dark:text-slate-300">{mockResources.api_stats.avg_response_ms}ms</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActiveTasksList() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3 mb-4">
        <GitBranch className="w-5 h-5 text-blue-500" />
        <h3 className="font-semibold text-slate-800 dark:text-white">Active Tasks ({mockActiveTasks.filter(t => t.status === 'in_progress').length})</h3>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {mockActiveTasks.map(task => (
          <div key={task.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(task.priority || 'P2')}`}>
                    {task.priority}
                  </span>
                  <span className="font-medium text-slate-800 dark:text-white text-sm">#{task.id} {task.title}</span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {task.status === 'in_progress' && task.started_at && (
                    <span className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      Running: {formatDuration(task.elapsed_seconds)}
                      {task.executor && <span>• Executor: {task.executor}</span>}
                    </span>
                  )}
                  {task.status === 'queued' && task.blocked_by && (
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3" />
                      Blocked by: #{task.blocked_by.join(', #')}
                    </span>
                  )}
                  {task.status === 'queued' && !task.blocked_by && (
                    <span className="text-slate-500">Waiting in queue...</span>
                  )}
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                task.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {task.status}
              </span>
            </div>

            {/* Progress Bar */}
            {task.progress > 0 && (
              <div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{task.progress}%</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentCompletionsPanel() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3 mb-4">
        <CheckCircle className="w-5 h-5 text-green-500" />
        <h3 className="font-semibold text-slate-800 dark:text-white">Recent Completions</h3>
      </div>

      <div className="space-y-2">
        {mockRecentCompletions.map(task => (
          <div key={task.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">#{task.id} {task.title}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {new Date(task.completed_at).toLocaleTimeString()} • Duration: {formatDuration(task.duration_seconds)}
              </div>
            </div>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </div>
        ))}
      </div>
    </div>
  );
}

function QuarantineZonePanel() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-red-200 dark:border-red-800">
      <div className="flex items-center gap-3 mb-4">
        <AlertTriangle className="w-5 h-5 text-red-500" />
        <h3 className="font-semibold text-slate-800 dark:text-white">Quarantine Zone ({mockQuarantineZone.length})</h3>
      </div>

      <div className="space-y-3">
        {mockQuarantineZone.map(task => (
          <div key={task.id} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div className="font-medium text-red-800 dark:text-red-300 text-sm">#{task.id} {task.title}</div>
            <div className="text-xs text-red-600 dark:text-red-400 mt-1">
              Reason: {task.reason}
            </div>
            <div className="text-xs text-red-500 dark:text-red-500 mt-1">
              Quarantined: {new Date(task.quarantined_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertsPanel() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3 mb-4">
        <Zap className="w-5 h-5 text-yellow-500" />
        <h3 className="font-semibold text-slate-800 dark:text-white">Recent Alerts</h3>
      </div>

      <div className="space-y-2">
        {mockAlerts.map((alert, i) => (
          <div key={i} className={`p-3 rounded-lg ${
            alert.level === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' :
            'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
          }`}>
            <div className="flex items-start gap-2">
              {alert.level === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              ) : (
                <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
              )}
              <div className="flex-1">
                <div className={`text-sm font-medium ${
                  alert.level === 'warning' ? 'text-yellow-800 dark:text-yellow-300' :
                  'text-blue-800 dark:text-blue-300'
                }`}>
                  {alert.message}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveLogsPanel() {
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState(initialLogs);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setLogs(prev => {
        const newLog = generateMockLog();
        const updated = [newLog, ...prev].slice(0, 100); // Keep last 100
        return updated;
      });
    }, 2000); // New log every 2 seconds

    return () => clearInterval(interval);
  }, [isPaused]);

  const handleClear = () => {
    setLogs([]);
  };

  const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
      'tick-loop': 'text-blue-500',
      'executor': 'text-green-500',
      'watchdog': 'text-yellow-500',
      'task': 'text-purple-500',
      'alertness': 'text-red-500',
      'api': 'text-cyan-500',
      'database': 'text-pink-500',
      'queue': 'text-orange-500',
    };
    return colors[source] || 'text-slate-500';
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-slate-800 dark:text-white">Live Logs ({logs.length})</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`p-2 rounded-lg transition-colors ${
              isPaused ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400' :
              'hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Activity className="w-4 h-4" /> : <Pause className="w-4 h-4 text-slate-600 dark:text-slate-400" />}
          </button>
          <button
            onClick={handleClear}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Clear"
          >
            <Trash2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 h-96 overflow-y-auto font-mono text-xs">
        {logs.map((log) => (
          <div key={log.id} className="mb-1 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded cursor-pointer">
            <span className="text-slate-400 dark:text-slate-600 mr-2">
              {log.timestamp.toLocaleTimeString()}
            </span>
            <span className={`mr-2 font-medium ${getSourceColor(log.source)}`}>[{log.source}]</span>
            <span className={log.level === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : 'text-slate-700 dark:text-slate-300'}>
              {log.message}
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-slate-400 dark:text-slate-600 text-center py-8">
            No logs yet. Logs will appear here in real-time.
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Main Page ============

export default function LiveMonitorPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            🧠 Cecelia Live Monitor
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            实时监控 Brain 状态、资源使用、任务执行和系统健康度
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {/* 网格布局 - 8 个卡片 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Brain Status */}
        <BrainStatusCard />

        {/* System Resources */}
        <ResourcesCard />

        {/* Alerts */}
        <AlertsPanel />

        {/* Active Tasks - 占 2 列 */}
        <div className="lg:col-span-2">
          <ActiveTasksList />
        </div>

        {/* Recent Completions */}
        <RecentCompletionsPanel />

        {/* Quarantine Zone */}
        <QuarantineZonePanel />

        {/* Live Logs - 占 2 列 */}
        <div className="lg:col-span-2">
          <LiveLogsPanel />
        </div>
      </div>

      {/* 提示信息 */}
      <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          ⚠️ 当前使用 Mock 数据展示（自动更新模拟）。待 Brain API 完成后将连接实时数据源（WebSocket: ws://localhost:5221/ws）
        </p>
      </div>
    </div>
  );
}
