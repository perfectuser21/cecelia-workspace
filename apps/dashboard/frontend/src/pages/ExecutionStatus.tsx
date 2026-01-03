import { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  Activity,
  RefreshCw,
  Loader2,
  Clock,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Zap,
} from 'lucide-react';
import { runsApi, RunsOverview, RunExecution } from '../api/runs.api';
import { StatusBadge } from '../components/StatusBadge';

export default function ExecutionStatus() {
  const [overview, setOverview] = useState<RunsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchData = async () => {
    try {
      const data = await runsApi.getOverview({ limit: 100 });
      setOverview(data);
      setLastUpdate(new Date().toLocaleTimeString('zh-CN'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchData();
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // 30秒刷新
    return () => clearInterval(interval);
  }, []);

  // 过滤后的执行记录
  const filteredExecutions = useMemo(() => {
    const executions = overview?.executions || [];
    if (statusFilter === 'all') return executions;
    if (statusFilter === 'error') return executions.filter(e => e.status === 'error' || e.status === 'crashed');
    return executions.filter(e => e.status === statusFilter);
  }, [overview?.executions, statusFilter]);

  // 分页后的执行记录
  const paginatedExecutions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredExecutions.slice(start, start + pageSize);
  }, [filteredExecutions, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredExecutions.length / pageSize);

  // 重置分页
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, pageSize]);

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (start: string, end?: string): string => {
    if (!end) return '-';
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const duration = Math.round((endTime - startTime) / 1000);

    if (duration < 60) return `${duration}秒`;
    if (duration < 3600) return `${Math.floor(duration / 60)}分${duration % 60}秒`;
    return `${Math.floor(duration / 3600)}时${Math.floor((duration % 3600) / 60)}分`;
  };

  const getStatusBadgeType = (status: string): 'success' | 'failed' | 'running' | 'waiting' | 'error' => {
    if (status === 'crashed') return 'error';
    return status as 'success' | 'failed' | 'running' | 'waiting' | 'error';
  };

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="flex items-center justify-center h-96 text-red-500">
        <XCircle className="w-6 h-6 mr-2" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            执行历史
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            查看工作流执行历史和成功率统计
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            最后更新: {lastUpdate}
          </span>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 总执行次数 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">总执行次数</p>
              <p className="text-3xl font-bold mt-1">{overview?.totalRuns || 0}</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        {/* 成功次数 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">成功次数</p>
              <p className="text-3xl font-bold mt-1 text-green-600 dark:text-green-400">
                {overview?.successfulRuns || 0}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        {/* 失败次数 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">失败次数</p>
              <p className="text-3xl font-bold mt-1 text-red-600 dark:text-red-400">
                {overview?.failedRuns || 0}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        {/* 成功率 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-500 dark:text-gray-400">整体成功率</p>
              <p className="text-3xl font-bold mt-1">
                {overview?.overallSuccessRate?.toFixed(1) || 0}%
              </p>
              {/* 进度条 */}
              <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${overview?.overallSuccessRate || 0}%` }}
                />
              </div>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* 执行历史列表 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        {/* 筛选栏 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {['all', 'success', 'error', 'running'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {status === 'all' ? '全部' : status === 'success' ? '成功' : status === 'error' ? '失败' : '运行中'}
                  <span className="ml-2 text-xs opacity-75">
                    ({status === 'all'
                      ? overview?.executions.length
                      : status === 'error'
                      ? overview?.executions.filter(e => e.status === 'error' || e.status === 'crashed').length
                      : overview?.executions.filter(e => e.status === status).length})
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">每页显示</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* 表格 */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  工作流
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  开始时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  结束时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  耗时
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  执行ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedExecutions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    暂无执行记录
                  </td>
                </tr>
              ) : (
                paginatedExecutions.map((execution) => (
                  <tr
                    key={execution.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Activity className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {execution.workflowName || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={getStatusBadgeType(execution.status)} size="sm" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {formatTime(execution.startedAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {execution.stoppedAt ? formatTime(execution.stoppedAt) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDuration(execution.startedAt, execution.stoppedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className="px-2 py-1 bg-gray-100 dark:bg-gray-900 rounded text-xs font-mono text-gray-600 dark:text-gray-400">
                        {execution.id.slice(0, 8)}
                      </code>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                显示 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredExecutions.length)} 条，
                共 {filteredExecutions.length} 条
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 rounded-lg text-sm ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
