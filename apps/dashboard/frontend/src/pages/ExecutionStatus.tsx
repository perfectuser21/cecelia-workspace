import { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  Activity,
  RefreshCw,
  Loader2,
  Clock,
  ChevronDown,
  ChevronRight,
  Database,
  Send,
  ListTodo,
  Wrench,
  Bot,
  Eye,
} from 'lucide-react';
import { n8nLiveStatusApi, N8nExecutionDetail } from '../api/n8n-live-status.api';

// Feature 定义
interface FeatureConfig {
  id: string;
  name: string;
  icon: React.ElementType;
  keywords: string[]; // 工作流名称关键词匹配
}

const FEATURES: FeatureConfig[] = [
  {
    id: 'data-collection',
    name: '数据采集',
    icon: Database,
    keywords: ['采集', '爬取', 'scrape', 'collect', 'fetch-data', '数据采集调度'],
  },
  {
    id: 'content-publish',
    name: '内容发布',
    icon: Send,
    keywords: ['发布', 'publish', 'post', 'upload', '内容发布'],
  },
  {
    id: 'ai-factory',
    name: 'AI 自动化',
    icon: Bot,
    keywords: ['dispatcher', 'claude', 'executor', 'callback', 'completion sync', 'ai factory', 'ai工厂'],
  },
  {
    id: 'monitoring',
    name: '监控巡检',
    icon: Eye,
    keywords: ['监控', '巡逻', 'monitor', 'patrol', 'watch'],
  },
  {
    id: 'maintenance',
    name: '系统维护',
    icon: Wrench,
    keywords: ['nightly', 'backup', 'cleanup', 'scheduler', '维护', '备份', '夜间'],
  },
];

// 子任务友好名称映射
const TASK_NAMES: Record<string, string> = {
  // 数据采集
  '抖音': '抖音',
  '快手': '快手',
  '小红书': '小红书',
  '头条': '头条',
  '微博': '微博',
  '公众号': '公众号',
  '视频号': '视频号',
  '知乎': '知乎',
  '数据采集调度器': '采集调度',
  // 内容发布
  '内容发布': '内容发布',
  'notion': 'Notion 同步',
  // AI 自动化
  'task dispatcher': '任务调度',
  'feature completion': '功能同步',
  'execution callback': '执行回调',
  '异步 claude': 'Claude 执行器',
  // 监控
  '监控巡逻': '系统巡检',
  // 系统维护
  'nightly': '定时任务',
  '夜间备份': '数据备份',
  '夜间文档': '文档检查',
};

function getTaskFriendlyName(workflowName: string): string {
  const lower = workflowName?.toLowerCase() || '';
  for (const [key, value] of Object.entries(TASK_NAMES)) {
    if (lower.includes(key)) return value;
  }
  // 默认返回简化名称
  return workflowName?.replace(/[-_]/g, ' ').slice(0, 20) || '未知任务';
}

function matchFeature(workflowName: string): FeatureConfig {
  const lower = workflowName?.toLowerCase() || '';
  for (const feature of FEATURES) {
    if (feature.keywords.some(kw => lower.includes(kw))) {
      return feature;
    }
  }
  // 默认归类到系统维护
  return FEATURES[FEATURES.length - 1];
}

interface FeatureGroup {
  feature: FeatureConfig;
  executions: N8nExecutionDetail[];
  stats: {
    total: number;
    success: number;
    failed: number;
  };
}

export default function ExecutionStatus() {
  const [executions, setExecutions] = useState<N8nExecutionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set(['ai-factory', 'data-collection', 'content-publish']));

  const fetchData = async () => {
    try {
      const data = await n8nLiveStatusApi.getLiveStatusOverview('local');
      const allExecutions = [
        ...data.runningExecutions.map(e => ({
          id: e.id,
          workflowId: e.workflowId,
          workflowName: e.workflowName,
          status: 'running' as const,
          mode: 'trigger',
          startedAt: e.startedAt,
          finished: false,
        })),
        ...data.recentCompleted,
      ];
      setExecutions(allExecutions);
      setLastUpdate(new Date().toLocaleTimeString('zh-CN'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // 按 Feature 分组
  const featureGroups = useMemo<FeatureGroup[]>(() => {
    const groups = new Map<string, FeatureGroup>();

    // 初始化所有 Feature
    for (const feature of FEATURES) {
      groups.set(feature.id, {
        feature,
        executions: [],
        stats: { total: 0, success: 0, failed: 0 },
      });
    }

    // 分配执行记录
    for (const exec of executions) {
      const feature = matchFeature(exec.workflowName || '');
      const group = groups.get(feature.id)!;
      group.executions.push(exec);
      group.stats.total++;
      if (exec.status === 'success') {
        group.stats.success++;
      } else if (exec.status === 'error' || exec.status === 'crashed') {
        group.stats.failed++;
      }
    }

    // 只返回有数据的分组，按执行数量排序
    return Array.from(groups.values())
      .filter(g => g.stats.total > 0)
      .sort((a, b) => b.stats.total - a.stats.total);
  }, [executions]);

  // 总统计
  const totalStats = useMemo(() => {
    return featureGroups.reduce(
      (acc, g) => ({
        total: acc.total + g.stats.total,
        success: acc.success + g.stats.success,
        failed: acc.failed + g.stats.failed,
      }),
      { total: 0, success: 0, failed: 0 }
    );
  }, [featureGroups]);

  const toggleFeature = (featureId: string) => {
    setExpandedFeatures(prev => {
      const next = new Set(prev);
      if (next.has(featureId)) {
        next.delete(featureId);
      } else {
        next.add(featureId);
      }
      return next;
    });
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (start: string, end?: string): string => {
    if (!end) return '进行中';
    const duration = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
    if (duration < 60) return `${duration}秒`;
    if (duration < 3600) return `${Math.floor(duration / 60)}分${duration % 60}秒`;
    return `${Math.floor(duration / 3600)}时${Math.floor((duration % 3600) / 60)}分`;
  };

  if (loading && executions.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error && executions.length === 0) {
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
            <Activity className="w-8 h-8 text-blue-600" />
            工作记录
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            今日自动任务执行情况
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            更新于 {lastUpdate}
          </span>
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 总统计 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">今日执行</p>
          <p className="text-2xl font-bold mt-1">{totalStats.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">成功</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{totalStats.success}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">失败</p>
          <p className="text-2xl font-bold mt-1 text-red-600">{totalStats.failed}</p>
        </div>
      </div>

      {/* Feature 分组 */}
      <div className="space-y-4">
        {featureGroups.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center text-gray-500 shadow-sm border border-gray-200 dark:border-gray-700">
            今日暂无执行记录
          </div>
        ) : (
          featureGroups.map((group) => {
            const Icon = group.feature.icon;
            const isExpanded = expandedFeatures.has(group.feature.id);

            return (
              <div
                key={group.feature.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Feature 头部 */}
                <button
                  onClick={() => toggleFeature(group.feature.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      {group.feature.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-500">今日 {group.stats.total} 次</span>
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="w-4 h-4" />
                        {group.stats.success}
                      </span>
                      {group.stats.failed > 0 && (
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircle className="w-4 h-4" />
                          {group.stats.failed}
                        </span>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* 执行记录列表 */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {group.executions.map((exec) => (
                        <div
                          key={exec.id}
                          className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400">·</span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {getTaskFriendlyName(exec.workflowName || '')}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-gray-500 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formatTime(exec.startedAt)}
                            </span>
                            {exec.status === 'success' ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="w-4 h-4" />
                                成功
                              </span>
                            ) : exec.status === 'running' ? (
                              <span className="flex items-center gap-1 text-blue-600">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                运行中
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-600">
                                <XCircle className="w-4 h-4" />
                                失败
                              </span>
                            )}
                            <span className="text-gray-400 w-16 text-right">
                              {formatDuration(exec.startedAt, exec.stoppedAt)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
