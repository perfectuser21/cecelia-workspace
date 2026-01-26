/**
 * 项目详情 v15
 * 统计 + 时间选择 + Feature 卡片形式
 */

import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, ChevronRight, CheckCircle, XCircle, Clock, Package, TrendingUp, DollarSign, Zap } from 'lucide-react';

interface TaskRun {
  id: string;
  project: string;
  feature_branch: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  prd_title?: string;
  current_step?: number;
  started_at: string;
  token_usage?: number;
}

interface FeatureInfo {
  id: string;
  name: string;
  version?: string;
}

interface ProjectInfo {
  name: string;
  description: string;
  features: FeatureInfo[];
}

type TimeRange = '24h' | '72h' | '7d' | '30d';

const TOKEN_PRICE_PER_1K = 0.015;

export default function ProjectDetail() {
  const { name } = useParams<{ name: string }>();
  const [runs, setRuns] = useState<TaskRun[]>([]);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const loadData = async () => {
    try {
      const [overviewRes, projectsRes] = await Promise.all([
        fetch('/api/cecelia/overview?limit=100'),
        fetch('/api/cecelia/projects'),
      ]);
      const overviewJson = await overviewRes.json();
      const projectsJson = await projectsRes.json();

      if (overviewJson.success) {
        setRuns(overviewJson.recent_runs.filter((r: TaskRun) => r.project === name));
      }
      if (projectsJson.success) {
        setProjectInfo(projectsJson.projects.find((p: ProjectInfo) => p.name === name) || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [name]);

  const getHours = (range: TimeRange) => {
    switch (range) {
      case '24h': return 24;
      case '72h': return 72;
      case '7d': return 168;
      case '30d': return 720;
    }
  };

  const filteredRuns = useMemo(() => {
    const cutoff = Date.now() - getHours(timeRange) * 60 * 60 * 1000;
    return runs.filter(r => new Date(r.started_at).getTime() >= cutoff);
  }, [runs, timeRange]);

  // 统计
  const runningRuns = filteredRuns.filter(r => r.status === 'running');
  const completedRuns = filteredRuns.filter(r => r.status === 'completed');
  const failedRuns = filteredRuns.filter(r => r.status === 'failed');
  const successRate = filteredRuns.length > 0 ? Math.round((completedRuns.length / filteredRuns.length) * 100) : 0;

  // Token 估算
  const totalTokens = filteredRuns.reduce((sum, r) => sum + (r.token_usage || 0), 0);
  const estimatedTokens = filteredRuns.length * 50000;
  const displayTokens = totalTokens > 0 ? totalTokens : estimatedTokens;
  const cost = (displayTokens / 1000) * TOKEN_PRICE_PER_1K;

  // 按 Feature 分组
  interface FeatureGroup {
    featureId: string;
    featureName: string;
    runs: TaskRun[];
    running: number;
    completed: number;
    failed: number;
    latestRun?: TaskRun;
  }

  const featureGroups = useMemo(() => {
    const groups = new Map<string, FeatureGroup>();

    filteredRuns.forEach(r => {
      const match = r.feature_branch.match(/^cp-([a-zA-Z][a-zA-Z0-9]*)-/i);
      if (!match) return;
      const featureId = match[1].toLowerCase();

      let group = groups.get(featureId);
      if (!group) {
        const featureInfo = projectInfo?.features.find(f => f.id.toLowerCase() === featureId);
        group = {
          featureId,
          featureName: featureInfo?.name || featureId,
          runs: [],
          running: 0,
          completed: 0,
          failed: 0,
        };
        groups.set(featureId, group);
      }
      group.runs.push(r);
      if (r.status === 'running') group.running++;
      if (r.status === 'completed') group.completed++;
      if (r.status === 'failed') group.failed++;
      if (!group.latestRun || new Date(r.started_at) > new Date(group.latestRun.started_at)) {
        group.latestRun = r;
      }
    });

    return Array.from(groups.values())
      .sort((a, b) => (b.running * 10 + b.runs.length) - (a.running * 10 + a.runs.length));
  }, [filteredRuns, projectInfo]);

  // 未匹配到 feature 的任务
  const unmatchedRuns = useMemo(() => {
    return filteredRuns.filter(r => {
      const match = r.feature_branch.match(/^cp-([a-zA-Z][a-zA-Z0-9]*)-/i);
      return !match;
    });
  }, [filteredRuns]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#191919] flex items-center justify-center">
        <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#191919]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* 导航 */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/cecelia" className="text-gray-400 hover:text-white flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Engine 工作台
          </Link>
          <button onClick={loadData} className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-white/5">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 项目头部 */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">{name}</h1>
          {projectInfo?.description && (
            <p className="text-gray-400">{projectInfo.description}</p>
          )}
        </div>

        {/* 统计横条 */}
        <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] rounded-2xl p-5 border border-[#2a2a4a] mb-8">
          {/* 时间选择器 */}
          <div className="flex items-center gap-2 mb-5">
            {(['24h', '72h', '7d', '30d'] as TimeRange[]).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  timeRange === range
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {range === '24h' ? '24h' : range === '72h' ? '72h' : range === '7d' ? '7 天' : '30 天'}
              </button>
            ))}
          </div>

          {/* 统计横排 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-white" />
              <span className="text-white font-bold text-2xl">{filteredRuns.length}</span>
              <span className="text-gray-400 text-sm">任务</span>
            </div>
            <div className="h-8 w-px bg-[#303030]" />
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="text-blue-400 font-bold text-2xl">{runningRuns.length}</span>
              <span className="text-gray-400 text-sm">运行中</span>
            </div>
            <div className="h-8 w-px bg-[#303030]" />
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-bold text-2xl">{completedRuns.length}</span>
              <span className="text-gray-400 text-sm">完成</span>
            </div>
            <div className="h-8 w-px bg-[#303030]" />
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400 font-bold text-2xl">{failedRuns.length}</span>
              <span className="text-gray-400 text-sm">失败</span>
            </div>
            <div className="h-8 w-px bg-[#303030]" />
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <span className="text-purple-400 font-bold text-2xl">{successRate}%</span>
              <span className="text-gray-400 text-sm">成功率</span>
            </div>
            <div className="h-8 w-px bg-[#303030]" />
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-400 font-bold text-xl">${cost.toFixed(2)}</span>
              <span className="text-gray-400 text-sm">{totalTokens > 0 ? '' : '估算'}</span>
            </div>
          </div>
        </div>

        {/* Feature 卡片 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">活跃 Features</h2>
            <span className="text-sm text-gray-500">({featureGroups.length})</span>
          </div>

          {featureGroups.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {featureGroups.map(group => (
                <div key={group.featureId} className="bg-[#202020] rounded-2xl border border-[#303030] p-5">
                  {/* Feature 头部 */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-white font-semibold text-lg">{group.featureName}</span>
                      <span className="text-xs text-gray-500 font-mono ml-2">({group.featureId})</span>
                    </div>
                    {group.running > 0 && (
                      <span className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-pulse" />
                    )}
                  </div>

                  {/* Feature 统计 */}
                  <div className="flex items-center gap-4 mb-4 text-sm">
                    <div>
                      <span className="text-white font-bold">{group.runs.length}</span>
                      <span className="text-gray-500 ml-1">任务</span>
                    </div>
                    {group.running > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                        <span className="text-blue-400">{group.running}</span>
                      </div>
                    )}
                    {group.completed > 0 && (
                      <div>
                        <span className="text-green-400">{group.completed}</span>
                        <span className="text-gray-500 ml-1">完成</span>
                      </div>
                    )}
                    {group.failed > 0 && (
                      <div>
                        <span className="text-red-400">{group.failed}</span>
                        <span className="text-gray-500 ml-1">失败</span>
                      </div>
                    )}
                  </div>

                  {/* 任务列表 */}
                  <div className="space-y-2">
                    {group.runs.slice(0, 3).map(run => (
                      <Link
                        key={run.id}
                        to={`/cecelia/runs/${run.id}`}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {run.status === 'running' && <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse flex-shrink-0" />}
                          {run.status === 'completed' && <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
                          {run.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                          <span className={`text-sm truncate ${run.status === 'completed' ? 'text-gray-400' : 'text-white'}`}>
                            {run.prd_title || run.feature_branch}
                          </span>
                        </div>
                        {run.status === 'running' && run.current_step && (
                          <span className="text-xs text-blue-400 font-mono flex-shrink-0">S{run.current_step}</span>
                        )}
                      </Link>
                    ))}
                    {group.runs.length > 3 && (
                      <div className="text-xs text-gray-500 text-center pt-1">
                        +{group.runs.length - 3} 更多
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#202020] rounded-2xl border border-[#303030] p-8 text-center text-gray-500">
              该时间段内暂无活跃 Feature
            </div>
          )}
        </div>

        {/* 关键进展 - 列表形式 */}
        {filteredRuns.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">关键进展</h2>
            </div>
            <div className="bg-[#202020] rounded-2xl border border-[#303030] overflow-hidden">
              {[...filteredRuns]
                .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
                .slice(0, 10)
                .map((run, i, arr) => {
                  const date = new Date(run.started_at);
                  const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
                  const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                  return (
                    <Link
                      key={run.id}
                      to={`/cecelia/runs/${run.id}`}
                      className={`flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition ${
                        i < arr.length - 1 ? 'border-b border-[#303030]' : ''
                      }`}
                    >
                      {/* 日期时间 */}
                      <div className="flex-shrink-0 w-20 text-sm">
                        <span className="text-gray-400">{dateStr}</span>
                        <span className="text-gray-600 ml-1">{timeStr}</span>
                      </div>
                      {/* 状态 */}
                      <div className="flex-shrink-0">
                        {run.status === 'running' && <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse inline-block" />}
                        {run.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-400" />}
                        {run.status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                        {run.status === 'pending' && <Clock className="w-4 h-4 text-gray-500" />}
                      </div>
                      {/* 标题 */}
                      <div className="flex-1 min-w-0">
                        <span className={`truncate ${run.status === 'completed' ? 'text-gray-400' : 'text-white'}`}>
                          {run.prd_title || run.feature_branch}
                        </span>
                      </div>
                      {/* 进度 */}
                      {run.status === 'running' && run.current_step && (
                        <div className="flex-shrink-0 text-xs text-blue-400 font-mono">
                          S{run.current_step}
                        </div>
                      )}
                    </Link>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
