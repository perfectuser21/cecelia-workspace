import { useEffect, useState } from 'react';
import { Bot, Users, Puzzle, AlertCircle, Loader2, Brain, Building2 } from 'lucide-react';
import {
  fetchStaff,
  fetchSkillsRegistry,
  type Team,
  type AreaConfig,
  type SkillItem,
} from '../api/staffApi';

// ── Worker card helpers ────────────────────────────────────────

function ModelBadge({ provider, name }: { provider: string | null; name: string | null }) {
  if (!provider || !name) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
        未配置
      </span>
    );
  }
  const colors: Record<string, string> = {
    anthropic: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
    minimax: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    openai: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  };
  const short = name.replace('claude-', '').replace('-20250514', '').replace('MiniMax-', '');
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[provider] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
      {short}
    </span>
  );
}

function WorkerCard({ worker }: { worker: Team['workers'][number] }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">{worker.name}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{worker.role}</div>
        </div>
        <Bot size={16} className="text-gray-400 mt-0.5 shrink-0" />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{worker.description}</p>
      <div className="flex items-center justify-between">
        <ModelBadge provider={worker.model.provider} name={worker.model.name} />
        {worker.skill && <span className="text-xs text-gray-400 font-mono">{worker.skill}</span>}
      </div>
    </div>
  );
}

// ── Skill card ────────────────────────────────────────────────

function SkillCard({ item }: { item: SkillItem }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          {item.type === 'agent'
            ? <Bot size={14} className="text-purple-400" />
            : <Puzzle size={14} className="text-blue-400" />}
          {item.name || item.id}
        </div>
        <span className="text-xs text-gray-400 font-mono">v{item.version}</span>
      </div>
      {item.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{item.description}</p>
      )}
      <div className="mt-3 text-xs font-mono text-gray-400">{item.id}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function TeamPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [areas, setAreas] = useState<Record<string, AreaConfig>>({});
  const [totalWorkers, setTotalWorkers] = useState(0);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [agents, setAgents] = useState<SkillItem[]>([]);
  const [skillTab, setSkillTab] = useState<'skills' | 'agents'>('skills');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchStaff(), fetchSkillsRegistry()])
      .then(([staff, registry]) => {
        setTeams(staff.teams);
        setAreas(staff.areas || {});
        setTotalWorkers(staff.total_workers);
        setSkills(registry.skills);
        setAgents(registry.agents);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-500 p-8">
        <AlertCircle size={20} />
        <span>{error}</span>
      </div>
    );
  }

  // Group teams by area → department
  const areaIds = Object.keys(areas).length > 0
    ? Object.keys(areas)
    : [...new Set(teams.map(t => t.area).filter(Boolean) as string[])];

  const groupByDept = (areaId: string) => {
    const areaTeams = teams.filter(t => t.area === areaId);
    const deptMap: Record<string, Team[]> = {};
    for (const team of areaTeams) {
      const dept = team.department || team.name;
      if (!deptMap[dept]) deptMap[dept] = [];
      deptMap[dept].push(team);
    }
    return deptMap;
  };

  const areaIcon = (areaId: string) =>
    areaId === 'cecelia' ? <Brain size={18} className="text-purple-500" /> : <Building2 size={18} className="text-blue-500" />;

  const skillItems = skillTab === 'skills' ? skills : agents;

  return (
    <div className="p-6 space-y-10">

      {/* ── Team ────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <Users size={22} className="text-gray-600 dark:text-gray-400" />
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Team</h2>
            <p className="text-xs text-gray-500">{totalWorkers} workers</p>
          </div>
        </div>

        <div className="space-y-8">
          {areaIds.map(areaId => {
            const area = areas[areaId];
            const deptMap = groupByDept(areaId);
            if (Object.keys(deptMap).length === 0) return null;
            return (
              <div key={areaId}>
                {/* Area header */}
                <div className="flex items-center gap-2 mb-4">
                  {areaIcon(areaId)}
                  <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                    {area?.name || areaId}
                  </h3>
                  {area?.description && (
                    <span className="text-xs text-gray-400">{area.description}</span>
                  )}
                </div>

                {/* Departments */}
                <div className="pl-4 space-y-6 border-l-2 border-gray-100 dark:border-gray-800">
                  {Object.entries(deptMap).map(([dept, deptTeams]) => {
                    const workers = deptTeams.flatMap(t => t.workers);
                    return (
                      <div key={dept}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{dept}</span>
                          <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">
                            {workers.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {workers.map(w => <WorkerCard key={w.id} worker={w} />)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Skills ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <Puzzle size={22} className="text-gray-600 dark:text-gray-400" />
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Skills Registry</h2>
            <p className="text-xs text-gray-500">{skills.length} skills · {agents.length} agents</p>
          </div>
        </div>

        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 mb-4">
          {(['skills', 'agents'] as const).map(t => (
            <button
              key={t}
              onClick={() => setSkillTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                skillTab === t
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t === 'skills' ? `Skills (${skills.length})` : `Agents (${agents.length})`}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {skillItems.map(item => <SkillCard key={item.id} item={item} />)}
        </div>
      </section>
    </div>
  );
}
