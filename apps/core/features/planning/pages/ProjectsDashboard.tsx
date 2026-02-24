/**
 * Projects Dashboard - 按 Area → KR → Project → Initiative 层级展示
 * 数据源: /api/tasks/goals + /api/tasks/projects + /api/tasks/tasks
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderKanban,
  RefreshCw,
  Target,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  Circle,
  ListTodo,
  Layers,
  GitBranch,
} from 'lucide-react';
import { useCeceliaPage } from '@/contexts/CeceliaContext';

// ── Types ────────────────────────────────────────────

interface Goal {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  progress: number;
  parent_id: string | null;
}

interface Project {
  id: string;
  name: string;
  type: string;
  status: string;
  description?: string;
  parent_id?: string | null;
  kr_id?: string | null;
  goal_id?: string | null;
}

interface Task {
  id: string;
  title: string;
  status: string;
  project_id?: string | null;
  goal_id?: string | null;
}

// ── Helpers ──────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2 };

function sortByPriority<T extends { priority: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
  );
}

const ACTIVE_STATUSES = new Set(['active', 'planning', 'in_progress']);
const ARCHIVED_STATUSES = new Set(['archived']);

// ── Badge 组件 ───────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const cls =
    priority === 'P0'
      ? 'bg-red-100 text-red-700 border border-red-200'
      : priority === 'P1'
      ? 'bg-amber-100 text-amber-700 border border-amber-200'
      : 'bg-slate-100 text-slate-600 border border-slate-200';
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${cls}`}>{priority}</span>
  );
}

function StatusDot({ status }: { status: string }) {
  if (status === 'active' || status === 'in_progress') {
    return <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />;
  }
  if (status === 'completed') {
    return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  }
  if (status === 'inactive' || status === 'pending') {
    return <Circle className="w-4 h-4 text-slate-400" />;
  }
  return <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />;
}

function StatusLabel({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'active',
    in_progress: 'active',
    planning: 'planning',
    completed: 'completed',
    inactive: 'inactive',
    archived: 'archived',
    pending: 'pending',
  };
  const cls =
    ACTIVE_STATUSES.has(status)
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'completed'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-slate-100 text-slate-600';
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${cls}`}>
      {map[status] ?? status}
    </span>
  );
}

// ── Initiative 行 ─────────────────────────────────────

function InitiativeRow({
  initiative,
  queuedCount,
  inProgressCount,
}: {
  initiative: Project;
  queuedCount: number;
  inProgressCount: number;
}) {
  const totalActiveTasks = queuedCount + inProgressCount;

  return (
    <Link
      to={`/work/projects/${initiative.id}`}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 rounded-lg transition-colors group"
    >
      {/* 层级装饰 */}
      <div className="flex items-center gap-1 shrink-0 ml-6">
        <div className="w-4 h-px bg-slate-300" />
        <GitBranch className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </div>

      {/* 状态指示 */}
      <StatusDot status={initiative.status} />

      {/* 名称 */}
      <span className="flex-1 text-sm text-slate-700 group-hover:text-blue-700 transition-colors truncate">
        {initiative.name}
      </span>

      {/* 右侧信息 */}
      <div className="flex items-center gap-2 shrink-0">
        <StatusLabel status={initiative.status} />
        {totalActiveTasks > 0 && (
          <div className="flex items-center gap-1 text-xs text-amber-600">
            <ListTodo className="w-3 h-3" />
            <span>
              {inProgressCount > 0 && `${inProgressCount} 进行`}
              {inProgressCount > 0 && queuedCount > 0 && ' / '}
              {queuedCount > 0 && `${queuedCount} 排队`}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Project 块 ────────────────────────────────────────

function ProjectBlock({
  project,
  initiatives,
  tasksByInitiative,
}: {
  project: Project;
  initiatives: Project[];
  tasksByInitiative: Record<string, Task[]>;
}) {
  const [expanded, setExpanded] = useState(initiatives.some((i) => ACTIVE_STATUSES.has(i.status)));

  const activeInitiatives = initiatives.filter((i) => ACTIVE_STATUSES.has(i.status)).length;
  const totalTasks = initiatives.reduce((s, i) => s + (tasksByInitiative[i.id]?.length || 0), 0);

  return (
    <div className="ml-4 border-l-2 border-slate-200 pl-3 mb-2">
      {/* Project 头 */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 py-2 text-left hover:bg-slate-50 rounded-lg px-2 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        )}
        <FolderKanban className="w-4 h-4 text-blue-500 shrink-0" />
        <span className="font-medium text-slate-700 text-sm truncate">{project.name}</span>
        <div className="flex items-center gap-1.5 ml-auto shrink-0 text-xs text-slate-400">
          {activeInitiatives > 0 && (
            <span className="text-emerald-600">{activeInitiatives} 活跃</span>
          )}
          <span>{initiatives.length} initiatives</span>
          {totalTasks > 0 && <span>{totalTasks} 任务</span>}
        </div>
      </button>

      {/* Initiatives */}
      {expanded && (
        <div className="mt-1 space-y-0.5">
          {initiatives.length === 0 ? (
            <p className="text-xs text-slate-400 pl-10 py-1">暂无 initiative</p>
          ) : (
            [...initiatives]
              .sort((a, b) => {
                const aActive = ACTIVE_STATUSES.has(a.status) ? 0 : 1;
                const bActive = ACTIVE_STATUSES.has(b.status) ? 0 : 1;
                return aActive - bActive || a.name.localeCompare(b.name);
              })
              .map((initiative) => {
                const its = tasksByInitiative[initiative.id] || [];
                const queued = its.filter((t) => t.status === 'queued').length;
                const inProg = its.filter((t) => t.status === 'in_progress').length;
                return (
                  <InitiativeRow
                    key={initiative.id}
                    initiative={initiative}
                    queuedCount={queued}
                    inProgressCount={inProg}
                  />
                );
              })
          )}
        </div>
      )}
    </div>
  );
}

// ── KR 区块 ──────────────────────────────────────────

function KRSection({
  kr,
  projects,
  initiativesByProject,
  tasksByInitiative,
}: {
  kr: Goal;
  projects: Project[];
  initiativesByProject: Record<string, Project[]>;
  tasksByInitiative: Record<string, Task[]>;
}) {
  const [expanded, setExpanded] = useState(kr.status === 'in_progress');

  const totalInits = projects.reduce(
    (s, p) => s + (initiativesByProject[p.id]?.length || 0),
    0
  );

  return (
    <div className="ml-4 border-l-2 border-blue-100 pl-3 mb-3">
      {/* KR 头 */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 py-2 text-left hover:bg-blue-50 rounded-lg px-2 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-blue-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-blue-400 shrink-0" />
        )}
        <Target className="w-4 h-4 text-blue-500 shrink-0" />
        <span className="text-sm font-medium text-slate-700 truncate">{kr.title}</span>
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <PriorityBadge priority={kr.priority} />
          <span className="text-xs text-slate-400">
            {projects.length} projects · {totalInits} inits
          </span>
        </div>
      </button>

      {/* Projects */}
      {expanded && (
        <div className="mt-1 space-y-1">
          {projects.length === 0 ? (
            <p className="text-xs text-slate-400 pl-8 py-1">暂无关联项目</p>
          ) : (
            projects.map((p) => (
              <ProjectBlock
                key={p.id}
                project={p}
                initiatives={initiativesByProject[p.id] || []}
                tasksByInitiative={tasksByInitiative}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Area 卡片 ─────────────────────────────────────────

function AreaCard({
  area,
  krs,
  projectsByKR,
  initiativesByProject,
  tasksByInitiative,
}: {
  area: Goal;
  krs: Goal[];
  projectsByKR: Record<string, Project[]>;
  initiativesByProject: Record<string, Project[]>;
  tasksByInitiative: Record<string, Task[]>;
}) {
  const [expanded, setExpanded] = useState(area.priority === 'P0' || area.status === 'in_progress');

  const totalInits = krs.reduce(
    (s, kr) =>
      s +
      (projectsByKR[kr.id] || []).reduce(
        (ss, p) => ss + (initiativesByProject[p.id]?.length || 0),
        0
      ),
    0
  );

  const activeInits = krs.reduce(
    (s, kr) =>
      s +
      (projectsByKR[kr.id] || []).reduce(
        (ss, p) =>
          ss + (initiativesByProject[p.id] || []).filter((i) => ACTIVE_STATUSES.has(i.status)).length,
        0
      ),
    0
  );

  const borderCls =
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
    <div className={`bg-white rounded-xl border ${borderCls} overflow-hidden shadow-sm`}>
      {/* Area 头 */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className={`w-full flex items-center gap-3 px-5 py-4 ${headerBg} hover:opacity-90 transition-opacity text-left`}
      >
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
        )}
        <Layers className="w-5 h-5 text-slate-600 shrink-0" />
        <span className="font-semibold text-slate-900 flex-1 truncate">{area.title}</span>
        <div className="flex items-center gap-2 shrink-0">
          <PriorityBadge priority={area.priority} />
          <span className="text-xs text-slate-500">{krs.length} KRs</span>
          {activeInits > 0 && (
            <span className="text-xs text-emerald-600 font-medium">{activeInits} 活跃</span>
          )}
          <span className="text-xs text-slate-400">{totalInits} initiatives</span>
        </div>
      </button>

      {/* KR 列表 */}
      {expanded && (
        <div className="px-4 py-3 space-y-1">
          {krs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">该 Area 下暂无 KR</p>
          ) : (
            sortByPriority(krs).map((kr) => (
              <KRSection
                key={kr.id}
                kr={kr}
                projects={projectsByKR[kr.id] || []}
                initiativesByProject={initiativesByProject}
                tasksByInitiative={tasksByInitiative}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── 主组件 ───────────────────────────────────────────

export default function ProjectsDashboard() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [goalsRes, projectsRes, tasksRes] = await Promise.all([
        fetch('/api/tasks/goals'),
        fetch('/api/tasks/projects'),
        fetch('/api/tasks/tasks?limit=500'),
      ]);
      const [goalsData, projectsData, tasksData] = await Promise.all([
        goalsRes.json(),
        projectsRes.json(),
        tasksRes.json(),
      ]);
      setGoals(Array.isArray(goalsData) ? goalsData : []);
      setAllProjects(Array.isArray(projectsData) ? projectsData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cecelia 集成
  const { register, unregisterPage } = useCeceliaPage(
    'projects',
    'Projects Dashboard',
    () => allProjects,
    () => ({ loading }),
    { refresh: fetchData },
    () => `${allProjects.filter((p) => p.type === 'initiative').length} initiatives`
  );
  useEffect(() => {
    register();
    return () => unregisterPage();
  }, [register, unregisterPage, allProjects, loading]);

  // 数据构建
  const { areaOkrs, krs, projects, initiatives, projectsByKR, initiativesByProject, tasksByInitiative } =
    useMemo(() => {
      const areaOkrs = sortByPriority(goals.filter((g) => g.type === 'area_okr'));
      const krs = goals.filter((g) => g.type === 'kr');

      // 只显示非 archived 的 project 和 initiative
      const projects = allProjects.filter(
        (p) => p.type === 'project' && !ARCHIVED_STATUSES.has(p.status)
      );
      const initiatives = allProjects.filter(
        (p) => p.type === 'initiative' && !ARCHIVED_STATUSES.has(p.status)
      );

      const projectMap: Record<string, Project> = {};
      for (const p of projects) projectMap[p.id] = p;

      // Project → KR 映射（通过 kr_id 或 goal_id）
      const projectsByKR: Record<string, Project[]> = {};
      for (const p of projects) {
        const krId = p.kr_id || p.goal_id;
        if (krId) {
          if (!projectsByKR[krId]) projectsByKR[krId] = [];
          projectsByKR[krId].push(p);
        }
      }

      // Initiative → Project 映射（通过 parent_id）
      const initiativesByProject: Record<string, Project[]> = {};
      for (const i of initiatives) {
        const parentId = i.parent_id;
        if (parentId) {
          if (!initiativesByProject[parentId]) initiativesByProject[parentId] = [];
          initiativesByProject[parentId].push(i);
        }
      }

      // Task → Initiative 映射（通过 project_id）
      const tasksByInitiative: Record<string, Task[]> = {};
      for (const t of tasks) {
        if (t.project_id) {
          if (!tasksByInitiative[t.project_id]) tasksByInitiative[t.project_id] = [];
          tasksByInitiative[t.project_id].push(t);
        }
      }

      return { areaOkrs, krs, projects, initiatives, projectsByKR, initiativesByProject, tasksByInitiative };
    }, [goals, allProjects, tasks]);

  // 统计
  const stats = useMemo(() => ({
    areas: areaOkrs.length,
    activeInits: initiatives.filter((i) => ACTIVE_STATUSES.has(i.status)).length,
    totalInits: initiatives.length,
    queuedTasks: tasks.filter((t) => t.status === 'queued').length,
  }), [areaOkrs, initiatives, tasks]);

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
            <FolderKanban className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">项目层级</h1>
            <p className="text-sm text-slate-500">按 Area → KR → Project → Initiative 展示</p>
          </div>
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
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 统计行 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: 'Areas',
            value: stats.areas,
            icon: <Layers className="w-5 h-5 text-violet-600" />,
            bg: 'bg-violet-100',
          },
          {
            label: '活跃 Initiatives',
            value: stats.activeInits,
            icon: <Clock className="w-5 h-5 text-emerald-600" />,
            bg: 'bg-emerald-100',
          },
          {
            label: '全部 Initiatives',
            value: stats.totalInits,
            icon: <GitBranch className="w-5 h-5 text-blue-600" />,
            bg: 'bg-blue-100',
          },
          {
            label: '排队任务',
            value: stats.queuedTasks,
            icon: <ListTodo className="w-5 h-5 text-amber-600" />,
            bg: 'bg-amber-100',
          },
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

      {/* Area 卡片 */}
      {loading ? (
        <div className="space-y-4">
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
      ) : (
        <div className="space-y-4">
          {areaOkrs.map((area) => {
            const areaKRs = sortByPriority(krs.filter((k) => k.parent_id === area.id));
            // 构建 projectsByKR（只用该 area 的 KR）
            const localProjectsByKR: Record<string, Project[]> = {};
            for (const kr of areaKRs) {
              localProjectsByKR[kr.id] = projectsByKR[kr.id] || [];
            }

            // 只展示有 KR 或有 project 的 area
            if (areaKRs.length === 0 && Object.keys(localProjectsByKR).length === 0) {
              return (
                <div
                  key={area.id}
                  className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center gap-3 opacity-50"
                >
                  <Layers className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-500 text-sm">{area.title}</span>
                  <PriorityBadge priority={area.priority} />
                  <span className="text-xs text-slate-400 ml-auto">暂无 KR/Project</span>
                </div>
              );
            }

            return (
              <AreaCard
                key={area.id}
                area={area}
                krs={areaKRs}
                projectsByKR={localProjectsByKR}
                initiativesByProject={initiativesByProject}
                tasksByInitiative={tasksByInitiative}
              />
            );
          })}

          {/* 未归属 area 的 initiatives */}
          {(() => {
            const areaKRIds = new Set(krs.filter((k) => k.parent_id && areaOkrs.some((a) => a.id === k.parent_id)).map((k) => k.id));
            // 找出 project 不在任何 KR 下的 initiatives
            const linkedProjectIds = new Set(
              Object.values(projectsByKR).flat().map((p) => p.id)
            );
            const orphanInitiatives = (
              allProjects.filter(
                (p) =>
                  p.type === 'initiative' &&
                  !ARCHIVED_STATUSES.has(p.status) &&
                  p.parent_id &&
                  !linkedProjectIds.has(p.parent_id)
              )
            );
            if (orphanInitiatives.length === 0) return null;
            return (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden opacity-70">
                <div className="px-5 py-3 bg-slate-50 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-500">
                    未归属层级的 Initiatives ({orphanInitiatives.length})
                  </span>
                </div>
                <div className="px-4 py-2 space-y-0.5">
                  {orphanInitiatives.map((i) => {
                    const its = tasksByInitiative[i.id] || [];
                    return (
                      <InitiativeRow
                        key={i.id}
                        initiative={i}
                        queuedCount={its.filter((t) => t.status === 'queued').length}
                        inProgressCount={its.filter((t) => t.status === 'in_progress').length}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
