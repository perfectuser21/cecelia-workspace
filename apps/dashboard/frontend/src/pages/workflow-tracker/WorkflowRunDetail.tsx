import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  workflowTrackerApi,
  WorkflowRun,
  StreamEvent,
  RunStatus,
} from '../../api/workflow-tracker.api';
import EventStream from './components/EventStream';
import WorkflowGraph from './components/WorkflowGraph';

const STATUS_CONFIG: Record<
  RunStatus,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  running: {
    label: '运行中',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: <Loader2 className="w-5 h-5 animate-spin" />,
  },
  success: {
    label: '成功',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: <CheckCircle className="w-5 h-5" />,
  },
  fail: {
    label: '失败',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: <XCircle className="w-5 h-5" />,
  },
  stuck: {
    label: '卡住',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    icon: <AlertTriangle className="w-5 h-5" />,
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

function getElapsedTime(startedAt: string): number {
  const start = new Date(startedAt).getTime();
  return Date.now() - start;
}

interface RunHeaderProps {
  run: WorkflowRun;
  elapsed: number;
}

function RunHeader({ run, elapsed }: RunHeaderProps) {
  const config = STATUS_CONFIG[run.status];
  const displayDuration = run.status === 'running' ? elapsed : run.total_duration_ms;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-xl font-bold text-gray-900 font-mono">
              {run.run_id}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.bgColor} ${config.color}`}
            >
              {config.icon}
              {config.label}
            </span>
          </div>

          <p className="text-gray-500">
            {run.bundle} {run.workflow && `/ ${run.workflow}`}
          </p>

          {run.prd_summary && (
            <p className="text-sm text-gray-600 mt-2 max-w-2xl">
              {run.prd_summary}
            </p>
          )}
        </div>

        <div className="text-right flex-shrink-0">
          <div className="flex items-center gap-2 justify-end">
            <Clock className="w-5 h-5 text-gray-400" />
            <span className="text-2xl font-mono font-bold text-gray-900">
              {formatDuration(displayDuration)}
            </span>
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {new Date(run.started_at).toLocaleString('zh-CN')}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkflowRunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadData = useCallback(async () => {
    if (!runId) return;

    try {
      const data = await workflowTrackerApi.getEventStream(runId);
      setRun(data.run);
      setEvents(data.events);
      setError(null);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto refresh when running
  useEffect(() => {
    if (!autoRefresh || !run || run.status !== 'running') return;

    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, run?.status, loadData]);

  // Update elapsed time
  useEffect(() => {
    if (!run || run.status !== 'running') return;

    const interval = setInterval(() => {
      setElapsed(getElapsedTime(run.started_at));
    }, 1000);

    return () => clearInterval(interval);
  }, [run?.started_at, run?.status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate('/settings/workflow-tracker')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </button>
        <div className="text-center py-12 text-red-500">
          <XCircle className="w-12 h-12 mx-auto mb-4" />
          <p>{error || '运行记录不存在'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/settings/workflow-tracker')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      {/* Run header */}
      <RunHeader run={run} elapsed={elapsed} />

      {/* 执行流程图 - n8n 风格节点视图 */}
      <WorkflowGraph events={events} />

      {/* Event stream */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>执行日志</span>
          <span className="text-sm font-normal text-gray-500">
            ({events.length} 个事件)
          </span>
        </h2>

        <EventStream events={events} />
      </div>
    </div>
  );
}
