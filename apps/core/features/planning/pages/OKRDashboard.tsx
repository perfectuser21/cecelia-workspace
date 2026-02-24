/**
 * OKR Dashboard - 按 Area → KR 层级展示 OKR 数据
 * 数据源: /api/tasks/goals (type=area_okr 和 type=kr)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Target,
  TrendingUp,
  Circle,
  CheckCircle2,
  Clock,
  FolderKanban,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────

interface Goal {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  progress: number;
  type: string;
  parent_id: string | null;
  weight: number;
}

// ── Helpers ──────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2 };

function sortByPriority<T extends { priority: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
  );
}

// ── Badge 组件 ───────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const cls =
    priority === 'P0'
      ? 'bg-red-100 text-red-700 border border-red-200'
      : priority === 'P1'
      ? 'bg-amber-100 text-amber-700 border border-amber-200'
      : 'bg-slate-100 text-slate-600 border border-slate-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    in_progress: {
      cls: 'bg-blue-100 text-blue-700',
      label: '进行中',
      icon: <Clock className="w-3 h-3" />,
    },
    completed: {
      cls: 'bg-emerald-100 text-emerald-700',
      label: '已完成',
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    pending: {
      cls: 'bg-slate-100 text-slate-600',
      label: '待开始',
      icon: <Circle className="w-3 h-3" />,
    },
  };
  const c = cfg[status] ?? cfg['pending'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${c.cls}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

// ── Progress Bar ─────────────────────────────────────

function ProgressBar({ progress, className = '' }: { progress: number; className?: string }) {
  const pct = Math.min(100, Math.max(0, progress));
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-blue-500' : 'bg-amber-500';
  return (
    <div className={`w-full bg-slate-200 rounded-full h-1.5 ${className}`}>
      <div
        className={`${color} h-1.5 rounded-full transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── KR Row ───────────────────────────────────────────

function KRRow({
  kr,
  projectCount,
}: {
  kr: Goal;
  projectCount: number;
}) {
  return (
    <div className="flex items-start gap-3 py-3 px-4 hover:bg-slate-50 rounded-lg transition-colors">
      {/* 连线装饰 */}
      <div className="flex flex-col items-center mt-1 shrink-0">
        <div className="w-px h-3 bg-slate-200" />
        <div className="w-2 h-2 rounded-full bg-slate-300 border border-slate-400" />
        <div className="w-px flex-1 bg-slate-200 min-h-[4px]" />
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <span className="text-sm font-medium text-slate-800 leading-snug">{kr.title}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <PriorityBadge priority={kr.priority} />
            <StatusBadge status={kr.status} />
          </div>
        </div>

        {/* Progress + project 数量 */}
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2">
            <ProgressBar progress={kr.progress} className="max-w-[200px]" />
            <span className="text-xs text-slate-500 shrink-0">{kr.progress}%</span>
          </div>
          {projectCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-violet-600">
              <FolderKanban className="w-3 h-3" />
              <span>{projectCount} 个项目</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Area Card ─────────────────────────────────────────

function AreaCard({
  area,
  krs,
  projectCountByKR,
}: {
  area: Goal;
  krs: Goal[];
  projectCountByKR: Record<string, number>;
}) {
  const [expanded, setExpanded] = useState(
    area.status === 'in_progress' || area.priority === 'P0'
  );

  const avgProgress =
    krs.length > 0
      ? Math.round(krs.reduce((s, k) => s + (k.progress || 0), 0) / krs.length)
      : area.progress || 0;

  const activeKRs = krs.filter((k) => k.status === 'in_progress').length;

  const borderColor =
    area.priority === 'P0'
      ? 'border-red-200'
      : area.priority === 'P1'
      ? 'border-amber-200'
      : 'border-slate-200';

  const headerBg =
    area.priority === 'P0'
      ? 'bg-red-50'
      : area.priority === 'P1'
      ? 'bg-amber-50'
      : 'bg-slate-50';

  return (
    <div className={`bg-white rounded-xl border ${borderColor} overflow-hidden shadow-sm`}>
      {/* Area 头部 */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className={`w-full flex items-start gap-3 px-5 py-4 ${headerBg} hover:opacity-90 transition-opacity text-left`}
      >
        <div className="mt-0.5">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-slate-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h3 className="font-semibold text-slate-900 text-base leading-snug">{area.title}</h3>
            <PriorityBadge priority={area.priority} />
            <StatusBadge status={area.status} />
          </div>

          <div className="flex items-center gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              <span>{krs.length} 个 KR</span>
            </div>
            {activeKRs > 0 && (
              <div className="flex items-center gap-1.5 text-blue-600">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{activeKRs} 个进行中</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <ProgressBar progress={avgProgress} className="w-20" />
              <span>{avgProgress}%</span>
            </div>
          </div>
        </div>
      </button>

      {/* KR 列表 */}
      {expanded && (
        <div className="px-3 py-2 divide-y divide-slate-100">
          {krs.length > 0 ? (
            sortByPriority(krs).map((kr) => (
              <KRRow
                key={kr.id}
                kr={kr}
                projectCount={projectCountByKR[kr.id] || 0}
              />
            ))
          ) : (
            <div className="py-4 text-center text-sm text-slate-400">
              该 Area 下暂无 KR
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 主组件 ───────────────────────────────────────────

export default function OKRDashboard() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<{ id: string; kr_id: string | null; goal_id: string | null; type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [goalsRes, projectsRes] = await Promise.all([
        fetch('/api/tasks/goals'),
        fetch('/api/tasks/projects'),
      ]);
      if (!goalsRes.ok) throw new Error(`goals: ${goalsRes.status}`);
      if (!projectsRes.ok) throw new Error(`projects: ${projectsRes.status}`);

      const [goalsData, projectsData] = await Promise.all([
        goalsRes.json(),
        projectsRes.json(),
      ]);

      setGoals(Array.isArray(goalsData) ? goalsData : []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 数据处理
  const areaOkrs = sortByPriority(goals.filter((g) => g.type === 'area_okr'));
  const krs = goals.filter((g) => g.type === 'kr');

  // KR → project 数量映射（通过 kr_id 或 goal_id 关联）
  const projectCountByKR: Record<string, number> = {};
  for (const p of projects) {
    if (p.type === 'project') {
      const linkedKRId = p.kr_id || p.goal_id;
      if (linkedKRId) {
        projectCountByKR[linkedKRId] = (projectCountByKR[linkedKRId] || 0) + 1;
      }
    }
  }

  // 汇总统计
  const totalKRs = krs.length;
  const activeKRs = krs.filter((k) => k.status === 'in_progress').length;
  const completedKRs = krs.filter((k) => k.status === 'completed').length;
  const avgProgress =
    krs.length > 0
      ? Math.round(krs.reduce((s, k) => s + (k.progress || 0), 0) / krs.length)
      : 0;

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse"
          >
            <div className="h-5 bg-slate-200 rounded w-2/3 mb-3" />
            <div className="h-3 bg-slate-200 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700">
          <p className="font-semibold mb-1">加载失败</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchData}
            className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">OKR 总览</h1>
          <p className="text-sm text-slate-500 mt-0.5">按 Area → KR 层级展示所有目标</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-slate-400">
              {lastRefresh.toLocaleTimeString('zh-CN')}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 统计行 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Areas', value: areaOkrs.length, icon: <Target className="w-5 h-5 text-violet-600" />, bg: 'bg-violet-100' },
          { label: '总 KR 数', value: totalKRs, icon: <TrendingUp className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-100' },
          { label: '进行中', value: activeKRs, icon: <Clock className="w-5 h-5 text-amber-600" />, bg: 'bg-amber-100' },
          { label: '平均进度', value: `${avgProgress}%`, icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-100' },
        ].map(({ label, value, icon, bg }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3"
          >
            <div className={`p-2 ${bg} rounded-lg`}>{icon}</div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-sm text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Area 卡片列表 */}
      <div className="space-y-4">
        {areaOkrs.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>暂无 Area OKR 数据</p>
          </div>
        ) : (
          areaOkrs.map((area) => {
            const areaKRs = krs.filter((k) => k.parent_id === area.id);
            return (
              <AreaCard
                key={area.id}
                area={area}
                krs={areaKRs}
                projectCountByKR={projectCountByKR}
              />
            );
          })
        )}

        {/* 未分组 KR（parent_id 不在 area_okrs 里的） */}
        {(() => {
          const areaIds = new Set(areaOkrs.map((a) => a.id));
          const ungroupedKRs = krs.filter(
            (k) => !k.parent_id || !areaIds.has(k.parent_id)
          );
          if (ungroupedKRs.length === 0) return null;
          return (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm opacity-70">
              <div className="px-5 py-3 bg-slate-50 flex items-center gap-2">
                <Target className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-500">
                  未归属 Area 的 KR ({ungroupedKRs.length})
                </span>
              </div>
              <div className="px-3 py-2 divide-y divide-slate-100">
                {ungroupedKRs.map((kr) => (
                  <KRRow key={kr.id} kr={kr} projectCount={projectCountByKR[kr.id] || 0} />
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
