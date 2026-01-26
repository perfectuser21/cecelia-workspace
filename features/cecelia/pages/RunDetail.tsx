/**
 * RunDetail Page v16
 * 开始/结束时间 + Checkpoint 进度条 + Dev 流程进度条
 * 颜色：绿色=完成，蓝色+黄点=当前，灰色=待做
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, ExternalLink, GitBranch, Check, Loader2, XCircle, History, ChevronRight, Clock, Zap, DollarSign, Calendar } from 'lucide-react';

interface Step {
  id: number;
  name: string;
  status: 'pending' | 'in_progress' | 'done' | 'failed';
}

interface Checkpoint {
  id: string;
  name?: string;
  status: 'pending' | 'in_progress' | 'done' | 'failed';
}

interface TaskRun {
  id: string;
  project: string;
  feature_branch: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_checkpoints: number;
  completed_checkpoints: number;
  current_step?: number;
  current_action?: string;
  pr_url?: string;
  prd_title?: string;
  prd_summary?: string;
  started_at?: string;
  updated_at?: string;
  steps?: Step[];
  checkpoints_detail?: Checkpoint[];
  token_usage?: number;
}

const TOKEN_PRICE_PER_1K = 0.015;

export default function RunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<TaskRun | null>(null);
  const [apiCheckpoints, setApiCheckpoints] = useState<Checkpoint[]>([]);
  const [relatedRuns, setRelatedRuns] = useState<TaskRun[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!runId) return;
    try {
      const res = await fetch(`/api/cecelia/runs/${runId}`);
      const json = await res.json();
      if (json.success) {
        setRun(json.run);
        // API 返回的 checkpoints 在顶层
        if (json.checkpoints) {
          setApiCheckpoints(json.checkpoints.map((cp: { checkpoint_id: string; name?: string; status: string }) => ({
            id: cp.checkpoint_id,
            name: cp.name,
            status: cp.status as 'pending' | 'in_progress' | 'done' | 'failed',
          })));
        }

        if (json.run?.project) {
          const overviewRes = await fetch('/api/cecelia/overview?limit=100');
          const overviewJson = await overviewRes.json();
          if (overviewJson.success) {
            const branch = json.run.feature_branch || '';
            const featureKeywords = extractFeatureKeywords(branch);
            const related = overviewJson.recent_runs.filter((r: TaskRun) => {
              if (r.id === runId) return false;
              if (r.project !== json.run.project) return false;
              return featureKeywords.some(kw =>
                r.feature_branch?.toLowerCase().includes(kw.toLowerCase())
              );
            });
            setRelatedRuns(related.slice(0, 5));
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const extractFeatureKeywords = (branch: string): string[] => {
    const cleaned = branch
      .replace(/^(cp-|feature\/|feat\/|fix\/)/, '')
      .replace(/^\d+-/, '')
      .replace(/-\d+$/, '');
    const parts = cleaned.split(/[-_]/);
    return parts.filter(p => p.length > 2 && !/^\d+$/.test(p));
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [runId]);

  // 计算运行时长
  const getDuration = () => {
    if (!run?.started_at) return null;
    const start = new Date(run.started_at).getTime();
    const end = run.updated_at ? new Date(run.updated_at).getTime() : Date.now();
    const diff = end - start;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#191919] flex items-center justify-center">
        <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-[#191919]">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Link to="/cecelia" className="text-gray-400 hover:text-white flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Engine 工作台
          </Link>
          <div className="text-gray-500 text-center py-12">任务不存在</div>
        </div>
      </div>
    );
  }

  // 从 API 获取数据
  const steps = run.steps || [];

  // 使用 API 返回的 checkpoints，或者根据 total_checkpoints 构建
  const checkpoints = apiCheckpoints.length > 0 ? apiCheckpoints : (() => {
    const total = run.total_checkpoints || 6;
    const completed = run.completed_checkpoints || 0;
    return Array.from({ length: total }, (_, i) => ({
      id: `CP-0${i + 1}`,
      name: undefined,
      status: i < completed ? 'done' as const : 'pending' as const,
    }));
  })();

  // 计算进度
  const completedSteps = steps.filter(s => s.status === 'done').length;
  const currentStepIndex = steps.findIndex(s => s.status === 'in_progress');
  const currentStep = currentStepIndex >= 0 ? steps[currentStepIndex] : null;

  const completedCps = checkpoints.filter(cp => cp.status === 'done').length;
  const currentCpIndex = checkpoints.findIndex(cp => cp.status === 'in_progress');
  const currentCp = currentCpIndex >= 0 ? checkpoints[currentCpIndex] : null;

  // 格式化时间
  const formatTime = (isoString?: string) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };
  const startTime = formatTime(run.started_at);
  const endTime = (run.status === 'completed' || run.status === 'failed') ? formatTime(run.updated_at) : null;

  // Token 和成本
  const tokens = run.token_usage || 0;
  const estimatedTokens = 50000; // 估算
  const displayTokens = tokens > 0 ? tokens : estimatedTokens;
  const cost = (displayTokens / 1000) * TOKEN_PRICE_PER_1K;
  const duration = getDuration();

  return (
    <div className="min-h-screen bg-[#191919]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* 导航 */}
        <div className="flex items-center justify-between mb-6">
          <Link to={`/cecelia/project/${encodeURIComponent(run.project)}`} className="text-gray-400 hover:text-white flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> {run.project}
          </Link>
          <button onClick={fetchData} className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-white/5">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 任务头部 */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            {run.status === 'running' && <span className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />}
            {run.status === 'completed' && <span className="w-3 h-3 bg-green-500 rounded-full" />}
            {run.status === 'failed' && <span className="w-3 h-3 bg-red-500 rounded-full" />}
            {run.status === 'pending' && <span className="w-3 h-3 bg-gray-500 rounded-full" />}
            <h1 className="text-3xl font-bold text-white tracking-tight">{run.prd_title || run.feature_branch}</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400 mt-2">
            <span className="flex items-center gap-1"><GitBranch className="w-4 h-4" />{run.feature_branch}</span>
            {run.pr_url && (
              <a href={run.pr_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                <ExternalLink className="w-4 h-4" /> Pull Request
              </a>
            )}
          </div>
        </div>

        {/* 统计信息 - 两行布局 */}
        <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] rounded-2xl p-5 border border-[#2a2a4a] mb-8">
          {/* 第一行：时间信息 */}
          <div className="flex items-center gap-6 mb-4 pb-4 border-b border-[#303030]">
            {/* 开始时间 */}
            {startTime && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <span className="text-gray-400 text-sm">开始</span>
                <span className="text-cyan-400 font-medium">{startTime}</span>
              </div>
            )}
            {/* 结束时间 */}
            {endTime && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-400" />
                <span className="text-gray-400 text-sm">结束</span>
                <span className="text-orange-400 font-medium">{endTime}</span>
              </div>
            )}
            {/* 运行时长 */}
            {duration && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-gray-400 text-sm">时长</span>
                <span className="text-white font-medium">{duration}</span>
              </div>
            )}
          </div>
          {/* 第二行：Token 和成本 */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              <span className="text-gray-400 text-sm">Tokens</span>
              <span className="text-purple-400 font-medium">
                {tokens > 0 ? (tokens > 1000000 ? `${(tokens / 1000000).toFixed(1)}M` : `${(tokens / 1000).toFixed(0)}K`) : '~50K'}
              </span>
              {tokens === 0 && <span className="text-gray-600 text-xs">(估算)</span>}
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-yellow-400" />
              <span className="text-gray-400 text-sm">成本</span>
              <span className="text-yellow-400 font-medium">${cost.toFixed(2)}</span>
              {tokens === 0 && <span className="text-gray-600 text-xs">(估算)</span>}
            </div>
            {run.status === 'running' && currentStep && (
              <div className="flex items-center gap-2 ml-auto">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                <span className="text-blue-400 font-medium">Step {currentStep.id}: {currentStep.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Checkpoints Chain */}
        {checkpoints.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Checkpoints</h2>
              <span className="text-sm text-gray-500">{completedCps}/{checkpoints.length} 完成</span>
            </div>
            <div className="bg-[#202020] rounded-2xl border border-[#303030] p-6">
              {/* 进度条 */}
              <div className="mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 bg-[#404040] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
                      style={{ width: `${checkpoints.length > 0 ? (completedCps / checkpoints.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-400 w-16 text-right">{Math.round(checkpoints.length > 0 ? (completedCps / checkpoints.length) * 100 : 0)}%</span>
                </div>
              </div>
              <div className="flex items-center">
                {checkpoints.map((cp, i) => {
                  const isDone = cp.status === 'done';
                  const isCurrent = cp.status === 'in_progress';
                  const isFailed = cp.status === 'failed';

                  return (
                    <div key={cp.id} className="flex items-center flex-1">
                      <div className="flex flex-col items-center">
                        {/* 节点 */}
                        <div className={`relative w-16 h-16 rounded-full flex items-center justify-center ${
                          isDone ? 'bg-green-500' :
                          isCurrent ? 'bg-blue-500' :
                          isFailed ? 'bg-red-500' :
                          'bg-[#303030]'
                        }`}>
                          {/* 黄色当前指示器 */}
                          {isCurrent && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full border-2 border-[#202020] flex items-center justify-center animate-pulse">
                              <span className="text-xs text-black font-bold">!</span>
                            </div>
                          )}
                          {isDone && <Check className="w-8 h-8 text-white" />}
                          {isCurrent && <Loader2 className="w-8 h-8 text-white animate-spin" />}
                          {isFailed && <XCircle className="w-8 h-8 text-white" />}
                          {!isDone && !isCurrent && !isFailed && (
                            <span className="text-gray-500 font-bold text-xl">{i + 1}</span>
                          )}
                        </div>
                        {/* 标签 */}
                        <div className="mt-3 text-center">
                          <div className={`text-sm font-mono font-semibold ${
                            isDone ? 'text-green-400' :
                            isCurrent ? 'text-blue-400' :
                            isFailed ? 'text-red-400' :
                            'text-gray-600'
                          }`}>{cp.id}</div>
                          {cp.name && (
                            <div className={`text-xs mt-1 max-w-[100px] leading-tight ${
                              isCurrent ? 'text-white font-medium' :
                              isDone ? 'text-gray-400' :
                              'text-gray-600'
                            }`}>{cp.name}</div>
                          )}
                        </div>
                      </div>
                      {/* 连接线 */}
                      {i < checkpoints.length - 1 && (
                        <div className={`flex-1 h-1 mx-3 rounded ${isDone ? 'bg-green-500' : 'bg-[#303030]'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Dev 流程 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Dev 流程</h2>
            <span className="text-sm text-gray-500">{completedSteps}/{steps.length || 9} 完成</span>
          </div>
          <div className="bg-[#202020] rounded-2xl border border-[#303030] p-6">
            {/* 进度条 */}
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-[#404040] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
                    style={{ width: `${(steps.length || 9) > 0 ? (completedSteps / (steps.length || 9)) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm text-gray-400 w-16 text-right">{Math.round((steps.length || 9) > 0 ? (completedSteps / (steps.length || 9)) * 100 : 0)}%</span>
              </div>
            </div>
            <div className="flex items-center">
              {(steps.length > 0 ? steps : [
                { id: 1, name: 'PRD', status: 'pending' },
                { id: 2, name: 'DoD', status: 'pending' },
                { id: 3, name: 'Branch', status: 'pending' },
                { id: 4, name: 'Code', status: 'pending' },
                { id: 5, name: 'Test', status: 'pending' },
                { id: 6, name: 'Local', status: 'pending' },
                { id: 7, name: 'PR', status: 'pending' },
                { id: 8, name: 'QA', status: 'pending' },
                { id: 9, name: 'Merge', status: 'pending' },
              ] as Step[]).map((step, i, arr) => {
                const isDone = step.status === 'done';
                const isCurrent = step.status === 'in_progress';
                const isFailed = step.status === 'failed';

                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      {/* 节点 */}
                      <div className={`relative w-12 h-12 rounded-full flex items-center justify-center ${
                        isDone ? 'bg-green-500' :
                        isCurrent ? 'bg-blue-500' :
                        isFailed ? 'bg-red-500' :
                        'bg-[#303030]'
                      }`}>
                        {/* 黄色当前指示器 */}
                        {isCurrent && (
                          <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-yellow-400 rounded-full border-2 border-[#202020] animate-pulse" />
                        )}
                        {isDone && <Check className="w-6 h-6 text-white" />}
                        {isCurrent && <Loader2 className="w-6 h-6 text-white animate-spin" />}
                        {isFailed && <XCircle className="w-6 h-6 text-white" />}
                        {!isDone && !isCurrent && !isFailed && (
                          <span className="text-gray-500 font-medium">{step.id}</span>
                        )}
                      </div>
                      {/* 标签 */}
                      <span className={`mt-2 text-xs font-medium ${
                        isDone ? 'text-green-400' :
                        isCurrent ? 'text-blue-400' :
                        isFailed ? 'text-red-400' :
                        'text-gray-600'
                      }`}>{step.name}</span>
                    </div>
                    {/* 连接线 */}
                    {i < arr.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 rounded ${isDone ? 'bg-green-500' : 'bg-[#303030]'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 当前动作 */}
        {run.status === 'running' && run.current_action && (
          <div className="mb-8 bg-blue-500/10 border border-blue-500/30 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <div>
                <div className="text-sm text-blue-300 mb-1">当前动作</div>
                <div className="text-white">{run.current_action}</div>
              </div>
            </div>
          </div>
        )}

        {/* 完成/失败状态 */}
        {run.status === 'completed' && (
          <div className="mb-8 bg-green-500/10 border border-green-500/30 rounded-2xl p-5 flex items-center gap-3">
            <Check className="w-6 h-6 text-green-400" />
            <div>
              <div className="text-green-300 font-medium">任务已完成</div>
              <div className="text-sm text-gray-400 mt-1">所有步骤已通过</div>
            </div>
          </div>
        )}
        {run.status === 'failed' && (
          <div className="mb-8 bg-red-500/10 border border-red-500/30 rounded-2xl p-5 flex items-center gap-3">
            <XCircle className="w-6 h-6 text-red-400" />
            <div>
              <div className="text-red-300 font-medium">任务执行失败</div>
              {run.current_action && <div className="text-sm text-gray-400 mt-1">{run.current_action}</div>}
            </div>
          </div>
        )}

        {/* 同一 Feature 的其他任务 */}
        {relatedRuns.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-white">同一 Feature 的其他任务</h2>
            </div>
            <div className="bg-[#202020] rounded-2xl border border-[#303030] overflow-hidden">
              {relatedRuns.map((r, i) => (
                <Link
                  key={r.id}
                  to={`/cecelia/runs/${r.id}`}
                  className={`flex items-center justify-between px-5 py-4 hover:bg-white/5 transition ${
                    i < relatedRuns.length - 1 ? 'border-b border-[#303030]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {r.status === 'running' && <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />}
                    {r.status === 'completed' && <Check className="w-4 h-4 text-green-400" />}
                    {r.status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                    <span className={r.status === 'completed' ? 'text-gray-300' : 'text-white'}>
                      {r.prd_title || r.feature_branch}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
