import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  ChevronRight,
  Loader2,
  Trash2,
} from 'lucide-react';
import {
  workflowTrackerApi,
  WorkflowRun,
  RunStatus,
  Phase,
} from '../../api/workflow-tracker.api';

const PHASE_LABELS: Record<Phase, string> = {
  PREPARE: '准备',
  VALIDATE: '验证',
  EXECUTE: '执行',
  VERIFY: '质检',
  FINALIZE: '完成',
};

const STATUS_CONFIG: Record<
  RunStatus,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  running: {
    label: '运行中',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
  },
  success: {
    label: '成功',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  fail: {
    label: '失败',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: <XCircle className="w-4 h-4" />,
  },
  stuck: {
    label: '卡住',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
};

function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return '刚刚';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}小时前`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}天前`;
}

function getElapsedTime(startedAt: string): number {
  const start = new Date(startedAt).getTime();
  return Date.now() - start;
}

interface RunCardProps {
  run: WorkflowRun;
  onDelete: (runId: string) => void;
  onClick: () => void;
}

function RunCard({ run, onDelete, onClick }: RunCardProps) {
  const [elapsed, setElapsed] = useState(getElapsedTime(run.started_at));
  const config = STATUS_CONFIG[run.status];

  useEffect(() => {
    if (run.status !== 'running') return;

    const interval = setInterval(() => {
      setElapsed(getElapsedTime(run.started_at));
    }, 1000);

    return () => clearInterval(interval);
  }, [run.started_at, run.status]);

  const displayDuration =
    run.status === 'running' ? elapsed : run.total_duration_ms;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm text-gray-500">{run.run_id}</span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
            >
              {config.icon}
              {config.label}
            </span>
          </div>
          <div className="text-sm text-gray-700 font-medium">{run.bundle}</div>
          {run.prd_summary && (
            <p className="text-xs text-gray-500 mt-1 truncate">
              {run.prd_summary}
            </p>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(run.run_id);
          }}
          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
          title="删除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Play className="w-3 h-3" />
          <span>{PHASE_LABELS[run.current_phase]}</span>
          {run.current_substep && (
            <>
              <ChevronRight className="w-3 h-3" />
              <span className="font-mono">{run.current_substep}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{formatDuration(displayDuration)}</span>
        </div>
        <div className="ml-auto">{formatTimeAgo(run.started_at)}</div>
      </div>
    </div>
  );
}

export default function WorkflowRuns() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [runningCount, setRunningCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadRuns = useCallback(async () => {
    try {
      const params: { status?: string } = {};
      if (statusFilter) params.status = statusFilter;

      const data = await workflowTrackerApi.getRuns(params);
      setRuns(data.runs);
      setRunningCount(data.running_count);
      setTotalCount(data.total_count);
    } catch (error) {
      console.error('Failed to load runs:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(loadRuns, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadRuns]);

  const handleDelete = async (runId: string) => {
    if (!confirm(`确定删除运行记录 ${runId}？`)) return;

    try {
      await workflowTrackerApi.deleteRun(runId);
      loadRuns();
    } catch (error) {
      console.error('Failed to delete run:', error);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6" />
            Workflow 执行追踪
          </h1>
          <p className="text-gray-500 mt-1">
            共 {totalCount} 个运行记录，{runningCount} 个正在运行
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部状态</option>
            <option value="running">运行中</option>
            <option value="success">成功</option>
            <option value="fail">失败</option>
            <option value="stuck">卡住</option>
          </select>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              autoRefresh
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <RefreshCw
              className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`}
            />
            {autoRefresh ? '自动刷新' : '已暂停'}
          </button>

          <button
            onClick={loadRuns}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>暂无运行记录</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {runs.map((run) => (
            <RunCard
              key={run.run_id}
              run={run}
              onDelete={handleDelete}
              onClick={() =>
                navigate(`/settings/workflow-tracker/${run.run_id}`)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
