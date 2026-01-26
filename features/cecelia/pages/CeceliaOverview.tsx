/**
 * Engine 工作台 v15
 * 热门项目卡片 + 关键进展（不显示 Feature）
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ChevronRight, Zap, CheckCircle, Clock, XCircle, TrendingUp, Folder, DollarSign, Activity } from 'lucide-react';

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

interface ProjectInfo {
  name: string;
  description: string;
  features: { id: string; name: string }[];
}

type TimeRange = '24h' | '72h' | '7d' | '30d';

const TOKEN_PRICE_PER_1K = 0.015;

export default function CeceliaOverviewPage() {
  const [runs, setRuns] = useState<TaskRun[]>([]);
  const [projectsInfo, setProjectsInfo] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const loadData = async () => {
    try {
      const [overviewRes, projectsRes] = await Promise.all([
        fetch('/api/cecelia/overview?limit=200'),
        fetch('/api/cecelia/projects'),
      ]);
      const overviewJson = await overviewRes.json();
      const projectsJson = await projectsRes.json();
      if (overviewJson.success) setRuns(overviewJson.recent_runs || []);
      if (projectsJson.success) setProjectsInfo(projectsJson.projects || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const getHours = (range: TimeRange) => {
    switch (range) {
      case '24h': return 24;
      case '72h': return 72;
      case '7d': return 168;
      case '30d': return 720;
    }
  };

  const filteredRuns = runs.filter(r => {
    const cutoff = Date.now() - getHours(timeRange) * 60 * 60 * 1000;
    return new Date(r.started_at).getTime() >= cutoff;
  });

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

  // 按项目聚合
  const projectStats = new Map<string, { info?: ProjectInfo; running: number; completed: number; failed: number; total: number }>();
  projectsInfo.forEach(p => projectStats.set(p.name, { info: p, running: 0, completed: 0, failed: 0, total: 0 }));
  filteredRuns.forEach(r => {
    let p = projectStats.get(r.project);
    if (!p) {
      p = { running: 0, completed: 0, failed: 0, total: 0 };
      projectStats.set(r.project, p);
    }
    p.total++;
    if (r.status === 'running') p.running++;
    if (r.status === 'completed') p.completed++;
    if (r.status === 'failed') p.failed++;
  });

  // 热门项目（按任务数排序）
  const hotProjects = Array.from(projectStats.entries())
    .filter(([, v]) => v.total > 0)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6);

  // 关键进展：最近完成和失败的任务
  const recentCompleted = [...completedRuns].sort((a, b) =>
    new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  ).slice(0, 3);
  const recentFailed = [...failedRuns].sort((a, b) =>
    new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  ).slice(0, 2);

  if (loading && !runs.length) {
    return (
      <div className="min-h-screen bg-[#191919] flex items-center justify-center">
        <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#191919]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight">Engine</h1>
            <p className="text-gray-500 mt-1">自动化开发工作流</p>
          </div>
          <button onClick={loadData} className="p-3 text-gray-500 hover:text-white rounded-xl hover:bg-white/5 transition">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 时间选择 + 统计横条 */}
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
              <Zap className="w-5 h-5 text-white" />
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

        {/* 热门项目 - 卡片式 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Folder className="w-5 h-5 text-orange-400" />
            <h2 className="text-xl font-semibold text-white">热门项目</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {hotProjects.map(([name, { info, running, completed, failed, total }]) => (
              <Link
                key={name}
                to={`/cecelia/project/${encodeURIComponent(name)}`}
                className="bg-[#202020] rounded-2xl border border-[#303030] p-5 hover:border-[#404040] transition group"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white font-semibold text-lg truncate">{name}</span>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-white transition" />
                </div>
                {info?.description && (
                  <p className="text-xs text-gray-500 mb-4 line-clamp-2">{info.description}</p>
                )}
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-white font-bold text-xl">{total}</span>
                    <span className="text-gray-500 ml-1 text-xs">任务</span>
                  </div>
                  {running > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                      <span className="text-blue-400 font-medium">{running}</span>
                      <span className="text-gray-500 text-xs">进行中</span>
                    </div>
                  )}
                  {completed > 0 && (
                    <div>
                      <span className="text-green-400 font-medium">{completed}</span>
                      <span className="text-gray-500 ml-1 text-xs">完成</span>
                    </div>
                  )}
                  {failed > 0 && (
                    <div>
                      <span className="text-red-400 font-medium">{failed}</span>
                      <span className="text-gray-500 ml-1 text-xs">失败</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 关键进展 - 列表形式 */}
        {filteredRuns.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-semibold text-white">关键进展</h2>
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
                      {/* 项目 */}
                      <div className="flex-shrink-0 text-xs text-gray-500">
                        {run.project}
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
