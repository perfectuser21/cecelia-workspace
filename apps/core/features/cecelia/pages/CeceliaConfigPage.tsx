import { useState, useEffect, useCallback } from 'react';
import { Brain, Cpu, Zap, Lock, ChevronDown, Check, RefreshCw, AlertCircle } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface ModelInfo {
  id: string;
  name: string;
  provider: 'anthropic' | 'minimax' | 'openai';
  tier: 'premium' | 'standard' | 'fast';
  deprecated?: boolean;
}

interface AgentInfo {
  id: string;
  name: string;
  description: string;
  layer: 'brain' | 'executor';
  allowed_models: string[];
  recommended_model: string;
  fixed_provider: string | null;
}

interface ActiveProfile {
  id: string;
  name: string;
  config: {
    thalamus: { model: string; provider: string };
    cortex: { model: string; provider: string };
    executor: {
      model_map: Record<string, Record<string, string | null>>;
      fixed_provider: Record<string, string>;
      default_provider: string;
    };
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

const PROVIDER_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  anthropic: { bg: 'rgba(251,146,60,0.12)', text: '#fb923c', dot: '#fb923c' },
  minimax:   { bg: 'rgba(96,165,250,0.12)',  text: '#60a5fa', dot: '#60a5fa' },
  openai:    { bg: 'rgba(52,211,153,0.12)',  text: '#34d399', dot: '#34d399' },
};

const TIER_DOTS: Record<string, string> = {
  premium:  '#f59e0b',
  standard: '#818cf8',
  fast:     '#34d399',
};

function getExecutorModel(agentId: string, profile: ActiveProfile): string {
  const modelMap = profile.config.executor.model_map[agentId];
  if (!modelMap) return '';
  const fixedProvider = profile.config.executor.fixed_provider?.[agentId];
  const provider = fixedProvider || profile.config.executor.default_provider;
  return modelMap[provider] || Object.values(modelMap).find(v => v) || '';
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface ModelDropdownProps {
  value: string;
  options: ModelInfo[];
  allModels: ModelInfo[];
  onChange: (modelId: string) => void;
  saving?: boolean;
  saved?: boolean;
  disabled?: boolean;
}

function ModelDropdown({ value, options, allModels, onChange, saving, saved, disabled }: ModelDropdownProps) {
  const [open, setOpen] = useState(false);
  const current = allModels.find(m => m.id === value);
  const provider = current?.provider;
  const ps = provider ? PROVIDER_STYLES[provider] : PROVIDER_STYLES.anthropic;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', borderRadius: 8,
          background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${disabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)'}`,
          cursor: disabled ? 'default' : 'pointer',
          transition: 'all 0.15s', minWidth: 200,
        }}
      >
        {current && (
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
            padding: '2px 6px', borderRadius: 4,
            background: ps.bg, color: ps.text }}>
            {current.provider.toUpperCase()}
          </span>
        )}
        <span style={{ fontSize: 12, color: disabled ? 'rgba(255,255,255,0.3)' : '#e2e8f0', flex: 1, textAlign: 'left' }}>
          {current?.name || value || '—'}
        </span>
        {current && (
          <div style={{ width: 6, height: 6, borderRadius: '50%',
            background: TIER_DOTS[current.tier] || '#666', flexShrink: 0 }} />
        )}
        {saving ? (
          <RefreshCw size={11} style={{ color: '#a78bfa', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
        ) : saved ? (
          <Check size={11} style={{ color: '#34d399', flexShrink: 0 }} />
        ) : !disabled ? (
          <ChevronDown size={11} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
        ) : null}
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 9 }}
          />
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 10,
            background: '#161622', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, overflow: 'hidden', minWidth: '100%',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}>
            {options.filter(m => !m.deprecated).map(m => {
              const mps = PROVIDER_STYLES[m.provider];
              const isSelected = m.id === value;
              return (
                <button
                  key={m.id}
                  onClick={() => { onChange(m.id); setOpen(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', background: isSelected ? 'rgba(139,92,246,0.12)' : 'transparent',
                    border: 'none', cursor: 'pointer', transition: 'background 0.1s',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.06em',
                    padding: '2px 5px', borderRadius: 3, background: mps.bg, color: mps.text, flexShrink: 0 }}>
                    {m.provider.slice(0, 2).toUpperCase()}
                  </span>
                  <span style={{ fontSize: 12, color: isSelected ? '#c4b5fd' : '#cbd5e1', flex: 1, textAlign: 'left' }}>
                    {m.name}
                  </span>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: TIER_DOTS[m.tier] || '#666', flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

interface AgentRowProps {
  agent: AgentInfo;
  currentModel: string;
  allModels: ModelInfo[];
  onSave: (agentId: string, modelId: string) => Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
}

function AgentRow({ agent, currentModel, allModels, onSave, disabled, disabledReason }: AgentRowProps) {
  const [model, setModel] = useState(currentModel);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setModel(currentModel); }, [currentModel]);

  const allowedModels = allModels.filter(m => agent.allowed_models.includes(m.id));

  async function handleChange(modelId: string) {
    if (modelId === model) return;
    setModel(modelId);
    setSaving(true);
    setError('');
    try {
      await onSave(agent.id, modelId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message || '保存失败');
      setModel(currentModel);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', borderRadius: 10,
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.05)',
      transition: 'border-color 0.15s',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>{agent.name}</span>
          {agent.fixed_provider && (
            <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
              background: 'rgba(251,146,60,0.1)', color: 'rgba(251,146,60,0.7)',
              letterSpacing: '0.06em' }}>
              FIXED
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{agent.description}</span>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <AlertCircle size={10} style={{ color: '#f87171' }} />
            <span style={{ fontSize: 10, color: '#f87171' }}>{error}</span>
          </div>
        )}
      </div>

      {disabled ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', borderRadius: 8,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            minWidth: 200,
          }}>
            <Lock size={10} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', flex: 1 }}>
              {currentModel ? allModels.find(m => m.id === currentModel)?.name || currentModel : '—'}
            </span>
          </div>
          {disabledReason && (
            <span style={{ fontSize: 10, padding: '3px 7px', borderRadius: 5,
              background: 'rgba(139,92,246,0.1)', color: 'rgba(167,139,250,0.6)',
              border: '1px solid rgba(139,92,246,0.15)', whiteSpace: 'nowrap' }}>
              {disabledReason}
            </span>
          )}
        </div>
      ) : (
        <ModelDropdown
          value={model}
          options={allowedModels}
          allModels={allModels}
          onChange={handleChange}
          saving={saving}
          saved={saved}
        />
      )}
    </div>
  );
}

// ── Section ────────────────────────────────────────────────────────────────

function Section({ icon, title, subtitle, children }: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: 8,
          background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.15)' }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function CeceliaConfigPage() {
  const [profile, setProfile] = useState<ActiveProfile | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [profileRes, modelsRes] = await Promise.all([
        fetch('/api/brain/model-profiles/active'),
        fetch('/api/brain/model-profiles/models'),
      ]);
      const profileData = await profileRes.json();
      const modelsData = await modelsRes.json();
      if (profileData.success) {
        setProfile(profileData.profile);
        setProfileName(profileData.profile.name);
      }
      if (modelsData.success) {
        setModels(modelsData.models || []);
        setAgents(modelsData.agents || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = useCallback(async (agentId: string, modelId: string) => {
    const res = await fetch('/api/brain/model-profiles/active/agent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId, model_id: modelId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '更新失败');
    // refresh profile
    const freshRes = await fetch('/api/brain/model-profiles/active');
    const freshData = await freshRes.json();
    if (freshData.success) setProfile(freshData.profile);
  }, []);

  const brainAgents = agents.filter(a => a.layer === 'brain');
  const execAgents = agents.filter(a => a.layer === 'executor');

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', background: '#09090f' }}>
        <RefreshCw size={20} style={{ color: 'rgba(167,139,250,0.4)', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', background: '#09090f', overflowY: 'auto' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 24px 40px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: -4,
                background: 'rgba(139,92,246,0.2)', borderRadius: 10, filter: 'blur(6px)' }} />
              <div style={{ position: 'relative', padding: 8,
                background: 'linear-gradient(135deg,#1e1b4b,rgba(124,58,237,0.3))',
                borderRadius: 10, border: '1px solid rgba(139,92,246,0.3)' }}>
                <Brain size={16} style={{ color: '#c4b5fd' }} />
              </div>
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Cecelia 配置</h1>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0 }}>模型 · 层级 · 偏好</p>
            </div>
            {profileName && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 8,
                background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa' }} />
                <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 500 }}>{profileName}</span>
              </div>
            )}
          </div>
        </div>

        {profile && (
          <>
            {/* 大脑层 */}
            <Section
              icon={<Brain size={13} style={{ color: '#a78bfa' }} />}
              title="大脑层"
              subtitle="核心决策 · 实时可切换"
            >
              {brainAgents.map(agent => {
                const currentModel = agent.id === 'thalamus'
                  ? profile.config.thalamus.model
                  : agent.id === 'cortex'
                    ? profile.config.cortex.model
                    : '';
                return (
                  <AgentRow
                    key={agent.id}
                    agent={agent}
                    currentModel={currentModel}
                    allModels={models}
                    onSave={handleSave}
                  />
                );
              })}
            </Section>

            {/* 内置层（硬编码，待接入） */}
            <Section
              icon={<Lock size={13} style={{ color: '#a78bfa' }} />}
              title="内置层"
              subtitle="暂时硬编码 · 配置接入中"
            >
              <AgentRow
                agent={{
                  id: 'reflection',
                  name: 'L3 反思层',
                  description: '定期深度反思 · 生成洞察',
                  layer: 'brain',
                  allowed_models: ['claude-opus-4-20250514'],
                  recommended_model: 'claude-opus-4-20250514',
                  fixed_provider: 'anthropic',
                }}
                currentModel="claude-opus-4-20250514"
                allModels={models}
                onSave={handleSave}
                disabled
                disabledReason="配置接入中"
              />
              <AgentRow
                agent={{
                  id: 'mouth',
                  name: '嘴巴层',
                  description: '对话生成 · 外部接口',
                  layer: 'brain',
                  allowed_models: ['claude-sonnet-4-6-20251001'],
                  recommended_model: 'claude-sonnet-4-6-20251001',
                  fixed_provider: 'anthropic',
                }}
                currentModel="claude-sonnet-4-6-20251001"
                allModels={[
                  ...models,
                  { id: 'claude-sonnet-4-6-20251001', name: 'Sonnet 4.6', provider: 'anthropic', tier: 'standard' },
                ]}
                onSave={handleSave}
                disabled
                disabledReason="配置接入中"
              />
            </Section>

            {/* 执行者层 */}
            <Section
              icon={<Cpu size={13} style={{ color: '#a78bfa' }} />}
              title="执行者层"
              subtitle="专家 agent · 独立配置"
            >
              {execAgents.map(agent => {
                const currentModel = getExecutorModel(agent.id, profile);
                return (
                  <AgentRow
                    key={agent.id}
                    agent={agent}
                    currentModel={currentModel}
                    allModels={models}
                    onSave={handleSave}
                  />
                );
              })}
            </Section>

            {/* 图例 */}
            <div style={{ marginTop: 8, padding: '12px 14px', borderRadius: 10,
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>图例</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {[
                  { color: TIER_DOTS.premium, label: 'Premium' },
                  { color: TIER_DOTS.standard, label: 'Standard' },
                  { color: TIER_DOTS.fast, label: 'Fast' },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{label}</span>
                  </div>
                ))}
                {Object.entries(PROVIDER_STYLES).map(([p, s]) => (
                  <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                      background: s.bg, color: s.text, letterSpacing: '0.06em' }}>
                      {p.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{p}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 提示 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16 }}>
              <Zap size={11} style={{ color: 'rgba(167,139,250,0.4)', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                修改立即生效，下次 Brain tick 将使用新模型
              </span>
            </div>
          </>
        )}

        {!profile && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingTop: 48 }}>
            <AlertCircle size={24} style={{ color: 'rgba(248,113,113,0.4)' }} />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>无法加载配置，请检查 Brain 是否运行</span>
            <button
              onClick={loadData}
              style={{ marginTop: 8, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: 12, cursor: 'pointer' }}
            >
              重试
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
