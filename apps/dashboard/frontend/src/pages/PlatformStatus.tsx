import { useState, useEffect } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Wifi,
  WifiOff,
  ExternalLink,
  Activity,
  Zap,
} from 'lucide-react';
import { publishApi } from '../api/publish.api';

// Platform metadata
const platformMeta: Record<
  string,
  {
    displayName: string;
    icon: string;
    color: string;
    bgColor: string;
    n8nConnected: boolean;
    dashboardUrl?: string;
  }
> = {
  xhs: {
    displayName: '小红书',
    icon: '📕',
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    n8nConnected: true,
    dashboardUrl: 'https://creator.xiaohongshu.com',
  },
  weibo: {
    displayName: '微博',
    icon: '🟠',
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    n8nConnected: true,
    dashboardUrl: 'https://weibo.com',
  },
  douyin: {
    displayName: '抖音',
    icon: '🎵',
    color: 'text-slate-900 dark:text-white',
    bgColor: 'bg-slate-100 dark:bg-slate-700',
    n8nConnected: true,
    dashboardUrl: 'https://creator.douyin.com',
  },
  website: {
    displayName: 'ZenithJoyAI',
    icon: '🌐',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    n8nConnected: true, // 直连数据库
    dashboardUrl: 'https://zenithjoyai.com',
  },
  x: {
    displayName: 'X (Twitter)',
    icon: '𝕏',
    color: 'text-slate-900 dark:text-white',
    bgColor: 'bg-slate-100 dark:bg-slate-700',
    n8nConnected: false,
    dashboardUrl: 'https://x.com',
  },
};

interface PlatformStats {
  total: number;
  success: number;
  failed: number;
}

interface Stats {
  total: number;
  byStatus: Record<string, number>;
  byPlatform: Record<string, PlatformStats>;
  recentTrend: Array<{ date: string; success: number; failed: number }>;
}

export default function PlatformStatus() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchStats = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const data = await publishApi.getStats();
      setStats(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto refresh every 30 seconds
    const interval = setInterval(() => fetchStats(), 30000);
    return () => clearInterval(interval);
  }, []);

  const calculateSuccessRate = (platform: string): number => {
    const platformStats = stats?.byPlatform[platform];
    if (!platformStats || platformStats.total === 0) return 0;
    return Math.round((platformStats.success / platformStats.total) * 100);
  };

  const getStatusColor = (rate: number): string => {
    if (rate >= 80) return 'text-green-500';
    if (rate >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Get all platforms (from metadata + stats)
  const allPlatforms = Object.keys(platformMeta);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">平台状态管理</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            查看各发布平台的连接状态和发布数据
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdate && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              更新于 {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">总发布数</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats?.total || 0}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Activity className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">已连接平台</p>
              <p className="text-2xl font-bold text-green-500 mt-1">
                {allPlatforms.filter(p => platformMeta[p].n8nConnected).length}
                <span className="text-sm text-gray-400 font-normal ml-1">
                  / {allPlatforms.length}
                </span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Wifi className="w-6 h-6 text-green-500" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">总成功数</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {Object.values(stats?.byPlatform || {}).reduce((sum, p) => sum + p.success, 0)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">总失败数</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {Object.values(stats?.byPlatform || {}).reduce((sum, p) => sum + p.failed, 0)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {allPlatforms.map(platform => {
          const meta = platformMeta[platform];
          const platformStats = stats?.byPlatform[platform];
          const successRate = calculateSuccessRate(platform);
          const isConnected = meta.n8nConnected;

          return (
            <div
              key={platform}
              className={`bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden transition-all hover:shadow-lg ${
                !isConnected ? 'opacity-60' : ''
              }`}
            >
              {/* Header */}
              <div className={`p-4 ${meta.bgColor} border-b border-gray-200 dark:border-slate-700`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{meta.icon}</span>
                    <div>
                      <h3 className={`font-semibold ${meta.color}`}>{meta.displayName}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{platform}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-medium">
                        <Wifi className="w-3 h-3" />
                        已连接
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-medium">
                        <WifiOff className="w-3 h-3" />
                        未连接
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="p-4 space-y-4">
                {/* Success Rate */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">成功率</span>
                    <span className={`text-lg font-bold ${getStatusColor(successRate)}`}>
                      {platformStats ? `${successRate}%` : '-'}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        successRate >= 80
                          ? 'bg-green-500'
                          : successRate >= 50
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${successRate}%` }}
                    />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {platformStats?.total || 0}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">总发布</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-green-500">
                      {platformStats?.success || 0}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">成功</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-red-500">{platformStats?.failed || 0}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">失败</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                  {meta.dashboardUrl && (
                    <a
                      href={meta.dashboardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      打开平台
                    </a>
                  )}
                  {isConnected ? (
                    <div className="flex items-center gap-1 px-3 py-2 text-sm text-green-600 dark:text-green-400">
                      <Zap className="w-4 h-4" />
                      <span>工作流正常</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-3 py-2 text-sm text-gray-400">
                      <AlertCircle className="w-4 h-4" />
                      <span>待对接</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Connection Info */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">连接说明</h3>
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-medium">小红书 / 微博 / 抖音</span>
              <span className="text-gray-500"> - 通过 n8n 工作流自动发布，支持图片和视频</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-medium">ZenithJoyAI</span>
              <span className="text-gray-500"> - 直接写入数据库，自动触发网站重建</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-medium">X (Twitter)</span>
              <span className="text-gray-500"> - 待对接 n8n 工作流，暂时不支持发布</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
