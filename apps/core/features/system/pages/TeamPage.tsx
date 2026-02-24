import { useEffect, useState } from 'react';
import { Bot, Users, Puzzle, AlertCircle, Loader2, Brain, Building2, X, ChevronRight, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  fetchStaff,
  fetchSkillsRegistry,
  type Team,
  type AreaConfig,
  type SkillItem,
  type Worker,
} from '../api/staffApi';

// ── Model badge ───────────────────────────────────────────────

function ModelBadge({ provider, name }: { provider: string | null; name: string | null }) {
  if (!provider || !name) {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">未配置</span>;
  }
  const colors: Record<string, string> = {
    anthropic: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
    minimax:   'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    openai:    'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  };
  const short = name.replace('claude-', '').replace('-20250514', '').replace('MiniMax-', '');
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[provider] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
      {short}
    </span>
  );
}

// ── Worker card ───────────────────────────────────────────────

function WorkerCard({ worker, onClick }: { worker: Worker; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {worker.name}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{worker.role}</div>
        </div>
        <div className="flex items-center gap-1 text-gray-300 dark:text-gray-600 group-hover:text-blue-400 transition-colors">
          <Bot size={15} />
          <ChevronRight size={13} />
        </div>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{worker.description}</p>
      <div className="flex items-center justify-between">
        <ModelBadge provider={worker.model.provider} name={worker.model.name} />
        {worker.skill && <span className="text-xs text-gray-400 font-mono">{worker.skill}</span>}
      </div>
    </button>
  );
}

// ── Worker detail panel ───────────────────────────────────────

function WorkerPanel({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const navigate = useNavigate();
  const providers = Object.entries(worker.model.full_map || {});

  return (
    <>
      <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-lg text-gray-900 dark:text-gray-100">{worker.name}</div>
              <div className="text-sm text-gray-500">{worker.role}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">描述</div>
            <p className="text-sm text-gray-700 dark:text-gray-300">{worker.description}</p>
          </div>

          {worker.skill && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Skill</div>
              <span className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-700 dark:text-gray-300">
                {worker.skill}
              </span>
            </div>
          )}

          {worker.abilities && worker.abilities.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Abilities ({worker.abilities.length})
              </div>
              <div className="space-y-2">
                {worker.abilities.map(ab => (
                  <div key={ab.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{ab.name}</div>
                    {ab.description && <div className="text-xs text-gray-500 mt-0.5">{ab.description}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">模型分配</div>
            {providers.length > 0 ? (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Provider</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Model</th>
                      <th className="px-3 py-2 w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {providers.map(([prov, model]) => (
                      <tr key={prov} className={model ? '' : 'opacity-40'}>
                        <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">{prov}</td>
                        <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300">
                          {model ? model.replace('claude-', '').replace('-20250514', '').replace('MiniMax-', '') : '—'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {prov === worker.model.provider && (
                            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400">未配置</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => { onClose(); navigate('/system/model-profile'); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Settings size={15} />
            编辑模型配置
          </button>
        </div>
      </div>
    </>
  );
}

// ── Skill card ────────────────────────────────────────────────

function SkillCard({ item }: { item: SkillItem }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          <Puzzle size={13} className="text-blue-400" />
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
  const [teams, setTeams]               = useState<Team[]>([]);
  const [areas, setAreas]               = useState<Record<string, AreaConfig>>({});
  const [totalWorkers, setTotalWorkers] = useState(0);
  const [skills, setSkills]             = useState<SkillItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [selected, setSelected]         = useState<Worker | null>(null);

  useEffect(() => {
    Promise.all([fetchStaff(), fetchSkillsRegistry()])
      .then(([staff, registry]) => {
        setTeams(staff.teams);
        setAreas(staff.areas || {});
        setTotalWorkers(staff.total_workers);
        setSkills(registry.skills);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-gray-400" size={32} />
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-2 text-red-500 p-8">
      <AlertCircle size={20} /><span>{error}</span>
    </div>
  );

  const areaIds = Object.keys(areas).length > 0
    ? Object.keys(areas)
    : [...new Set(teams.map(t => t.area).filter(Boolean) as string[])];

  const groupByDept = (areaId: string) => {
    const areaTeams = teams.filter(t => t.area === areaId);
    const map: Record<string, Team[]> = {};
    for (const t of areaTeams) {
      const dept = t.department || t.name;
      if (!map[dept]) map[dept] = [];
      map[dept].push(t);
    }
    return map;
  };

  const areaIcon = (id: string) =>
    id === 'cecelia'
      ? <Brain size={18} className="text-purple-500" />
      : <Building2 size={18} className="text-blue-500" />;

  return (
    <div className="p-6 space-y-10">

      {/* ── Team ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <Users size={22} className="text-gray-500" />
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Team</h2>
            <p className="text-xs text-gray-500">{totalWorkers} workers · 点击卡片查看详情</p>
          </div>
        </div>

        <div className="space-y-8">
          {areaIds.map(areaId => {
            const area = areas[areaId];
            const deptMap = groupByDept(areaId);
            if (!Object.keys(deptMap).length) return null;
            return (
              <div key={areaId}>
                <div className="flex items-center gap-2 mb-4">
                  {areaIcon(areaId)}
                  <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                    {area?.name || areaId}
                  </h3>
                  {area?.description && (
                    <span className="text-xs text-gray-400">{area.description}</span>
                  )}
                </div>
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
                          {workers.map(w => (
                            <WorkerCard key={w.id} worker={w} onClick={() => setSelected(w)} />
                          ))}
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

      {/* ── Skills ──────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <Puzzle size={22} className="text-gray-500" />
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Skills</h2>
            <p className="text-xs text-gray-500">{skills.length} registered</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {skills.map(item => <SkillCard key={item.id} item={item} />)}
        </div>
      </section>

      {/* ── Detail panel ──────────────────────────────── */}
      {selected && <WorkerPanel worker={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
