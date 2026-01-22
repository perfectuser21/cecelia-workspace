import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  Target,
} from 'lucide-react';
import { publishApi } from '../api/publish.api';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface StatsData {
  total: number;
  byStatus: Record<string, number>;
  byPlatform: Record<string, { total: number; success: number; failed: number }>;
  recentTrend: Array<{ date: string; success: number; failed: number }>;
}

// 状态颜色配置
const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  pending: '#fbbf24',
  processing: '#60a5fa',
  completed: '#34d399',
  failed: '#f87171',
  partial: '#fb923c',
};

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  pending: '待发布',
  processing: '发布中',
  completed: '成功',
  failed: '失败',
  partial: '部分成功',
};

// 平台名称映射
const PLATFORM_NAMES: Record<string, string> = {
  douyin: '抖音',
  kuaishou: '快手',
  xiaohongshu: '小红书',
  toutiao: '头条',
  weibo: '微博',
  videoNumber: '视频号',
  wechat: '公众号',
  zhihu: '知乎',
  website: '官网',
};

export default function PublishStats() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await publishApi.getStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="w-12 h-12 text-red-500 dark:text-red-400 mb-4" />
        <p className="text-red-600 dark:text-red-400 mb-3">{error}</p>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/25"
        >
          重试
        </button>
      </div>
    );
  }

  if (!stats) return null;

  // 计算顶部统计卡片数据
  const totalPublished = stats.total - (stats.byStatus.draft || 0);
  const totalSuccess = stats.byStatus.completed || 0;
  const totalFailed = (stats.byStatus.failed || 0) + (stats.byStatus.partial || 0);
  const successRate =
    totalPublished > 0 ? ((totalSuccess / totalPublished) * 100).toFixed(1) : '0.0';

  // 准备状态分布饼图数据
  const statusChartData = Object.entries(stats.byStatus)
    .filter(([status]) => status !== 'draft')
    .map(([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
      color: STATUS_COLORS[status] || '#94a3b8',
    }));

  // 准备平台统计柱状图数据
  const platformChartData = Object.entries(stats.byPlatform)
    .map(([platform, data]) => ({
      platform: PLATFORM_NAMES[platform] || platform,
      total: data.total,
      success: data.success,
      failed: data.failed,
      successRate: data.total > 0 ? ((data.success / data.total) * 100).toFixed(1) : '0',
    }))
    .sort((a, b) => b.total - a.total);

  // 准备趋势折线图数据
  const trendChartData = stats.recentTrend.map(item => ({
    date: new Date(item.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
    success: item.success,
    failed: item.failed,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">发布统计</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">多平台发布数据分析</p>
          </div>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Target className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">总发布数</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalPublished}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            草稿 {stats.byStatus.draft || 0} 个
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/25">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">成功数</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalSuccess}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">全部成功完成</div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/25">
              <XCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">失败数</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalFailed}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">部分或全部失败</div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">成功率</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{successRate}%</div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">全部完成的比例</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Status Distribution Pie Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">按状态分布</h2>
          {statusChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 dark:text-gray-500">
              暂无数据
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Platform Stats Bar Chart */}
        <div className="col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">按平台统计</h2>
          {platformChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 dark:text-gray-500">
              暂无数据
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={platformChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis dataKey="platform" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      total: '总数',
                      success: '成功',
                      failed: '失败',
                    };
                    return [value, labels[name] || name];
                  }}
                />
                <Legend
                  formatter={(value: string) => {
                    const labels: Record<string, string> = {
                      total: '总数',
                      success: '成功',
                      failed: '失败',
                    };
                    return labels[value] || value;
                  }}
                />
                <Bar dataKey="success" fill="#34d399" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" fill="#f87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Platform Details Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">平台详情</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  平台
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  发布总数
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  成功数
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  失败数
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  成功率
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {platformChartData.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-400 dark:text-gray-500"
                  >
                    暂无数据
                  </td>
                </tr>
              ) : (
                platformChartData.map(platform => (
                  <tr
                    key={platform.platform}
                    className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {platform.platform}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white text-right">
                      {platform.total}
                    </td>
                    <td className="px-6 py-4 text-sm text-green-600 dark:text-green-400 text-right">
                      {platform.success}
                    </td>
                    <td className="px-6 py-4 text-sm text-red-600 dark:text-red-400 text-right">
                      {platform.failed}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${
                          parseFloat(platform.successRate) >= 80
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : parseFloat(platform.successRate) >= 50
                              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}
                      >
                        {platform.successRate}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent 7 Days Trend */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">最近7天趋势</h2>
        {trendChartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-400 dark:text-gray-500">
            暂无数据
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    success: '成功',
                    failed: '失败',
                  };
                  return [value, labels[name] || name];
                }}
              />
              <Legend
                formatter={(value: string) => {
                  const labels: Record<string, string> = {
                    success: '成功',
                    failed: '失败',
                  };
                  return labels[value] || value;
                }}
              />
              <Line
                type="monotone"
                dataKey="success"
                stroke="#34d399"
                strokeWidth={2}
                dot={{ fill: '#34d399', r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="failed"
                stroke="#f87171"
                strokeWidth={2}
                dot={{ fill: '#f87171', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
