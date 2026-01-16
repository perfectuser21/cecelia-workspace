import { useEffect, useState } from 'react';
import { Bot, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';

interface TaskRun {
  id: string;
  project: string;
  feature_branch: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_checkpoints: number;
  completed_checkpoints: number;
  failed_checkpoints: number;
  current_checkpoint?: string;
  started_at: string;
  updated_at: string;
}

interface Overview {
  success: boolean;
  total_runs: number;
  running: number;
  completed: number;
  failed: number;
  recent_runs: TaskRun[];
}

// API 和前端同域，使用相对路径
const CECILIA_API = '';

export default function CeciliaRuns() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      const res = await fetch(`${CECILIA_API}/api/cecilia/overview`);
      const data = await res.json();
      if (data.success) {
        setOverview(data);
        setError(null);
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'running':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      pending: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    };
    const labels: Record<string, string> = {
      completed: '已完成',
      running: '运行中',
      failed: '失败',
      pending: '等待中',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString('zh-CN');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-700 dark:text-red-400">连接 Cecilia API 失败: {error}</p>
        <button
          onClick={fetchOverview}
          className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cecilia</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">AI 代码执行器任务追踪</p>
          </div>
        </div>
        <button
          onClick={fetchOverview}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{overview?.total_runs || 0}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">总任务</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-blue-200 dark:border-blue-800">
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{overview?.running || 0}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">运行中</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-emerald-200 dark:border-emerald-800">
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{overview?.completed || 0}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">已完成</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-red-200 dark:border-red-800">
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">{overview?.failed || 0}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">失败</p>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">最近任务</h2>
        </div>
        {overview?.recent_runs && overview.recent_runs.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-slate-700">
            {overview.recent_runs.map((run) => (
              <div key={run.id} className="p-6 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(run.status)}
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{run.project}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{run.feature_branch}</p>
                    </div>
                  </div>
                  {getStatusBadge(run.status)}
                </div>
                <div className="ml-8">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all"
                        style={{
                          width: `${(run.completed_checkpoints / run.total_checkpoints) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {run.completed_checkpoints}/{run.total_checkpoints}
                    </span>
                  </div>
                  {run.current_checkpoint && (
                    <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">
                      当前: {run.current_checkpoint}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {formatTime(run.updated_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Bot className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">暂无任务</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              通过 N8N 工作流触发 Cecilia 执行 PRD
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
