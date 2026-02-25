import { useState, useEffect, useRef, useCallback } from 'react';
import { Brain, Send, Phone, PhoneOff, Mic, Volume2, Zap, Clock, ChevronRight, Activity } from 'lucide-react';
import { useCecelia } from '@/contexts/CeceliaContext';
import { useRealtimeVoice } from '@features/core/shared/hooks/useRealtimeVoice';

interface Desire {
  id: string;
  type: string;
  content: string;
  urgency: number;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  task_type: string;
  priority: string;
  status: string;
}

interface StatusData {
  tasksQueued: number;
  tasksInProgress: number;
  tickActionsToday: number;
  lastDispatch: string | null;
  dispatchRate: number;
}

const ALERTNESS_CONF = {
  0: { label: 'SLEEPING', color: '#64748b', pulse: false },
  1: { label: 'CALM',     color: '#22c55e', pulse: false },
  2: { label: 'AWARE',    color: '#3b82f6', pulse: true  },
  3: { label: 'ALERT',    color: '#f59e0b', pulse: true  },
  4: { label: 'PANIC',    color: '#ef4444', pulse: true  },
} as const;

const THINKING_PHASES = ['感知中', '思考中', '深思中'];

const ROUTE_ALIASES: Record<string, string> = {
  'okr': '/okr', '目标': '/okr',
  'projects': '/projects', '项目': '/projects',
  'tasks': '/work/tasks', '任务': '/work/tasks',
  'work': '/work', '工作': '/work',
  'today': '/today', '今天': '/today',
};

const QUICK_PROMPTS = [
  '你今天打算做什么？',
  '现在有哪些优先任务？',
  '最近有没有遇到问题？',
  '系统健康状况如何？',
];

const URGENT_ACTIONS = [
  { label: '暂停所有任务', prompt: '请暂停所有正在进行的任务' },
  { label: '触发一次 Tick', prompt: '请手动触发一次 Tick 循环' },
  { label: '查看任务队列', prompt: '请告诉我当前任务队列的情况' },
];

// ── 辅助组件 ──────────────────────────────────────────────

function StatRow({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 0' }}>
      <div style={{ color: color ?? 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{icon}</div>
      <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: color ?? 'rgba(255,255,255,0.65)' }}>{value}</span>
    </div>
  );
}

function ClickBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        padding: '7px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
        background: 'rgba(255,255,255,0.03)',
        color: 'rgba(255,255,255,0.55)', fontSize: 11.5, lineHeight: 1.4,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.12)';
        (e.currentTarget as HTMLButtonElement).style.color = '#a78bfa';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)';
        (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)';
      }}
    >
      <span style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {label}
      </span>
      <ChevronRight size={11} style={{ flexShrink: 0, opacity: 0.4 }} />
    </button>
  );
}

// ── 左侧状态面板 ──────────────────────────────────────────

function StatusPanel({ alertnessLevel, desires, status }: {
  alertnessLevel: number;
  desires: Desire[];
  status: StatusData;
}) {
  const aC = ALERTNESS_CONF[alertnessLevel as keyof typeof ALERTNESS_CONF] ?? ALERTNESS_CONF[1];

  return (
    <div style={{
      width: 196, flexShrink: 0,
      borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column',
      background: '#060610',
    }}>
      {/* section: 系统状态 */}
      <div style={{ padding: '11px 13px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>系统状态</span>
      </div>
      <div style={{ padding: '4px 13px 8px' }}>
        {/* alertness */}
        <div style={{ padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: aC.color, flexShrink: 0,
              ...(aC.pulse ? { animation: 'pulse 2s ease-in-out infinite' } : {}),
            }} />
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)' }}>警觉度</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: aC.color, letterSpacing: '0.06em' }}>
              {aC.label}
            </span>
          </div>
        </div>
        <StatRow icon={<Clock size={11} />} label="任务队列" value={status.tasksQueued} color={status.tasksQueued > 5 ? '#f59e0b' : undefined} />
        <StatRow icon={<Activity size={11} />} label="进行中" value={status.tasksInProgress} color={status.tasksInProgress > 0 ? '#3b82f6' : undefined} />
        <StatRow icon={<Zap size={11} />} label="今日 Actions" value={status.tickActionsToday} />
      </div>

      {/* section: 内心欲望 */}
      <div style={{ padding: '9px 13px 7px', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>内心欲望</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 9px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {desires.length === 0 ? (
          <div style={{ paddingTop: 20, textAlign: 'center', fontSize: 10.5, color: 'rgba(255,255,255,0.16)' }}>平静无欲</div>
        ) : desires.map(d => (
          <div key={d.id} style={{
            borderRadius: 5, padding: '6px 8px',
            background: d.urgency >= 8 ? 'rgba(239,68,68,0.05)' : d.urgency >= 5 ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.018)',
            borderLeft: `2px solid ${d.urgency >= 8 ? 'rgba(239,68,68,0.5)' : d.urgency >= 5 ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.06)'}`,
          }}>
            <p style={{
              fontSize: 10.5, color: 'rgba(255,255,255,0.42)', lineHeight: 1.45,
              margin: '0 0 2px',
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {d.content}
            </p>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.16)' }}>{d.type} · {d.urgency}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '6px 13px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 5 }}>
        <Zap size={9} style={{ color: 'rgba(167,139,250,0.28)' }} />
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)' }}>{desires.length} 件</span>
      </div>
    </div>
  );
}

// ── 右侧决策面板 ──────────────────────────────────────────

function DecisionPanel({ queuedTasks, onSend }: {
  queuedTasks: Task[];
  onSend: (text: string) => void;
}) {
  const PRIORITY_COLOR: Record<string, string> = {
    P0: '#ef4444', P1: '#f59e0b', P2: '#3b82f6', P3: '#6b7280',
  };

  return (
    <div style={{
      width: 226, flexShrink: 0,
      borderLeft: '1px solid rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column',
      background: '#060610',
    }}>
      {/* section: 等待任务 */}
      <div style={{ padding: '11px 13px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>等待队列</span>
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto', padding: '6px 9px', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
        {queuedTasks.length === 0 ? (
          <div style={{ paddingTop: 14, textAlign: 'center', fontSize: 10.5, color: 'rgba(255,255,255,0.16)' }}>队列为空</div>
        ) : queuedTasks.slice(0, 8).map(t => (
          <button
            key={t.id}
            onClick={() => onSend(`这个任务怎么样？「${t.title}」`)}
            style={{
              width: '100%', textAlign: 'left',
              padding: '6px 9px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.025)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.025)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
              <span style={{
                fontSize: 8.5, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                background: `${PRIORITY_COLOR[t.priority] ?? '#6b7280'}22`,
                color: PRIORITY_COLOR[t.priority] ?? '#6b7280',
                letterSpacing: '0.04em',
              }}>
                {t.priority}
              </span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)' }}>{t.task_type}</span>
            </div>
            <p style={{
              margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4,
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {t.title}
            </p>
          </button>
        ))}
      </div>

      {/* section: 快捷提问 */}
      <div style={{ padding: '9px 13px 7px', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>快捷提问</span>
      </div>
      <div style={{ padding: '6px 9px', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
        {QUICK_PROMPTS.map(p => (
          <ClickBtn key={p} label={p} onClick={() => onSend(p)} />
        ))}
      </div>

      {/* section: 紧急操作 */}
      <div style={{ padding: '9px 13px 7px', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(239,68,68,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>紧急操作</span>
      </div>
      <div style={{ padding: '6px 9px', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
        {URGENT_ACTIONS.map(a => (
          <button
            key={a.label}
            onClick={() => onSend(a.prompt)}
            style={{
              width: '100%', textAlign: 'left',
              padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.1)', cursor: 'pointer',
              background: 'rgba(239,68,68,0.04)',
              color: 'rgba(239,68,68,0.55)', fontSize: 11.5,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)';
              (e.currentTarget as HTMLButtonElement).style.color = '#f87171';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.04)';
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(239,68,68,0.55)';
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────

export default function CeceliaPage() {
  const {
    messages, addMessage, input, setInput, sending, setSending, generateId,
    currentRoute, frontendTools, executeFrontendTool, getPageContext,
  } = useCecelia();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openingFiredRef = useRef(false);

  const [desires, setDesires] = useState<Desire[]>([]);
  const [alertnessLevel, setAlertnessLevel] = useState(1);
  const [thinkingPhase, setThinkingPhase] = useState(0);
  const [msgDepth, setMsgDepth] = useState<Map<string, number>>(new Map());
  const [queuedTasks, setQueuedTasks] = useState<Task[]>([]);
  const [status, setStatus] = useState<StatusData>({
    tasksQueued: 0, tasksInProgress: 0, tickActionsToday: 0, lastDispatch: null, dispatchRate: 0,
  });

  // scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // cycle thinking phase while sending
  useEffect(() => {
    if (!sending) { setThinkingPhase(0); return; }
    const t = setInterval(() => setThinkingPhase(p => (p + 1) % 3), 1500);
    return () => clearInterval(t);
  }, [sending]);

  // poll alertness
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/brain/alertness');
        if (r.ok) { const d = await r.json(); setAlertnessLevel(d.level ?? 1); }
      } catch { /* silent */ }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  // poll desires
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/brain/desires?status=pending&limit=10');
        if (!r.ok) return;
        const d = await r.json();
        setDesires(Array.isArray(d) ? d : (d.desires || []));
      } catch { /* silent */ }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  // poll queued tasks (right panel)
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/brain/tasks?status=queued&limit=20');
        if (!r.ok) return;
        const d = await r.json();
        setQueuedTasks(Array.isArray(d) ? d : (d.tasks || []));
      } catch { /* silent */ }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  // poll system status (left panel stats)
  useEffect(() => {
    const load = async () => {
      try {
        const [fullRes, inProgressRes] = await Promise.all([
          fetch('/api/brain/status/full'),
          fetch('/api/brain/tasks?status=in_progress&limit=50'),
        ]);
        const inProgressData = inProgressRes.ok ? await inProgressRes.json() : [];
        const inProgressCount = Array.isArray(inProgressData) ? inProgressData.length : (inProgressData.tasks?.length ?? 0);

        if (fullRes.ok) {
          const d = await fullRes.json();
          setStatus({
            tasksQueued: d.task_queue?.queued ?? 0,
            tasksInProgress: inProgressCount,
            tickActionsToday: d.tick_stats?.actions_today ?? 0,
            lastDispatch: d.task_queue?.last_dispatch ?? null,
            dispatchRate: d.tick_stats?.dispatch_rate_1h ?? 0,
          });
        }
      } catch { /* silent */ }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  // proactive opening — Cecelia speaks first
  useEffect(() => {
    if (messages.length > 0 || openingFiredRef.current) return;
    openingFiredRef.current = true;

    const fire = async () => {
      setSending(true);
      try {
        const r = await fetch('/api/orchestrator/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: '你好',
            messages: [],
            context: {
              currentRoute,
              pageContext: getPageContext(),
              opening: true,
              availableTools: frontendTools.map(t => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              })),
            },
          }),
        });
        const data = await r.json();
        if (data.reply) {
          const id = generateId();
          addMessage({ id, role: 'assistant', content: data.reply });
          if (data.routing_level !== undefined) {
            setMsgDepth(prev => new Map(prev).set(id, data.routing_level));
          }
        }
      } catch { /* silent */ } finally {
        setSending(false);
      }
    };

    setTimeout(fire, 700);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = overrideText ?? input.trim();
    if (!text || sending) return;
    if (!overrideText) setInput('');
    setSending(true);
    addMessage({ id: generateId(), role: 'user', content: text });

    try {
      const lower = text.toLowerCase();
      if (/打开|去|转|看|进入|切换|跳转|navigate|open|go/i.test(lower)) {
        for (const [alias, route] of Object.entries(ROUTE_ALIASES).sort((a, b) => b[0].length - a[0].length)) {
          if (lower.includes(alias)) {
            const result = await executeFrontendTool('navigate', { path: route });
            addMessage({ id: generateId(), role: 'assistant', content: result, toolCall: { name: 'navigate', result } });
            return;
          }
        }
      }

      const r = await fetch('/api/orchestrator/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          messages: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          context: {
            currentRoute,
            pageContext: getPageContext(),
            availableTools: frontendTools.map(t => ({
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            })),
          },
        }),
      });
      const data = await r.json();
      if (data.reply) {
        const id = generateId();
        addMessage({ id, role: 'assistant', content: data.reply });
        if (data.routing_level !== undefined) {
          setMsgDepth(prev => new Map(prev).set(id, data.routing_level));
        }
      } else if (data.error) {
        addMessage({ id: generateId(), role: 'assistant', content: `⚠️ ${data.error}` });
      }
    } catch {
      addMessage({ id: generateId(), role: 'assistant', content: '发生错误，请重试' });
    } finally {
      setSending(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, sending, messages, currentRoute, frontendTools]);

  // voice
  const realtime = useRealtimeVoice({
    onTranscript: useCallback((text: string) => {
      if (text.trim()) handleSend(text.trim());
    }, [handleSend]),
  });

  const aC = ALERTNESS_CONF[alertnessLevel as keyof typeof ALERTNESS_CONF] ?? ALERTNESS_CONF[1];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', background: '#09090f' }}>

      {/* ── 左侧状态面板 ── */}
      <StatusPanel
        alertnessLevel={alertnessLevel}
        desires={desires}
        status={status}
      />

      {/* ── 中间对话面板 ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* presence header */}
        <div style={{
          padding: '10px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#0a0a12', flexShrink: 0,
        }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: -5, borderRadius: 11, background: aC.color, opacity: 0.14, filter: 'blur(9px)' }} />
            <div style={{
              position: 'relative', width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg,rgba(18,12,36,0.95),rgba(48,18,88,0.6))',
              border: `1px solid ${aC.color}38`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Brain size={15} style={{ color: aC.color }} />
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', letterSpacing: '-0.01em' }}>Cecelia</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%', background: aC.color,
                ...(aC.pulse ? { animation: 'pulse 2s ease-in-out infinite' } : {}),
              }} />
              <span style={{ fontSize: 10, color: aC.color, fontWeight: 500, letterSpacing: '0.05em' }}>{aC.label}</span>
              {desires.length > 0 && (
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.26)' }}>· {desires.length} 件心事</span>
              )}
            </div>
          </div>

          {realtime.isConnected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', animation: 'pulse 1s infinite' }} />
              {realtime.isRecording && <Mic size={11} style={{ color: '#10b981' }} />}
              {realtime.isPlaying && <Volume2 size={11} style={{ color: '#10b981' }} />}
              <span style={{ fontSize: 10, color: '#10b981' }}>语音</span>
            </div>
          )}
        </div>

        {/* messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map(msg => {
              const depth = msgDepth.get(msg.id) ?? -1;
              const isDeep = depth >= 2;
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-start' }}>

                  {msg.role === 'assistant' && (
                    <div style={{
                      width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                      marginRight: 8, marginTop: 2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isDeep
                        ? 'linear-gradient(135deg,rgba(44,12,90,0.85),rgba(90,36,180,0.35))'
                        : 'rgba(24,16,44,0.75)',
                      border: `1px solid ${isDeep ? 'rgba(167,139,250,0.22)' : 'rgba(255,255,255,0.05)'}`,
                    }}>
                      <Brain size={11} style={{ color: isDeep ? '#c4b5fd' : 'rgba(196,181,253,0.42)' }} />
                    </div>
                  )}

                  <div style={{
                    maxWidth: '75%',
                    borderRadius: msg.role === 'user' ? '13px 13px 4px 13px' : '13px 13px 13px 4px',
                    fontSize: 13.5, lineHeight: 1.65,
                    padding: '9px 13px', wordBreak: 'break-word',
                    ...(msg.role === 'user'
                      ? {
                          background: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
                          color: '#fff',
                          boxShadow: '0 4px 14px rgba(124,58,237,0.16)',
                        }
                      : isDeep
                        ? {
                            background: 'rgba(16,10,30,0.96)',
                            color: '#e0d8f0',
                            border: '1px solid rgba(139,92,246,0.16)',
                            boxShadow: '0 0 28px rgba(139,92,246,0.07)',
                          }
                        : {
                            background: 'rgba(14,12,26,0.82)',
                            color: '#c4ccdc',
                            border: '1px solid rgba(255,255,255,0.04)',
                          }
                    ),
                  }}>
                    {msg.toolCall && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)', marginBottom: 5 }}>
                        → {msg.toolCall.name}
                      </div>
                    )}
                    <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                    {msg.role === 'assistant' && depth >= 0 && (
                      <div style={{ marginTop: 5, fontSize: 9, letterSpacing: '0.06em', color: isDeep ? 'rgba(167,139,250,0.42)' : 'rgba(255,255,255,0.16)' }}>
                        {depth === 0 ? '· 感知' : depth === 1 ? '· 思考' : '· 深思'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* thinking indicator */}
            {sending && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(24,16,44,0.75)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <Brain size={11} style={{ color: 'rgba(196,181,253,0.42)' }} />
                </div>
                <div style={{
                  padding: '9px 13px',
                  background: 'rgba(14,12,26,0.82)',
                  borderRadius: '13px 13px 13px 4px',
                  border: '1px solid rgba(255,255,255,0.04)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <div style={{ display: 'flex', gap: 3.5 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: 4.5, height: 4.5, borderRadius: '50%',
                        background: i === thinkingPhase ? '#a78bfa' : 'rgba(167,139,250,0.18)',
                        transition: 'background 0.4s ease',
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 10, color: 'rgba(167,139,250,0.5)', letterSpacing: '0.05em' }}>
                    {THINKING_PHASES[thinkingPhase]}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* input bar */}
        <div style={{ padding: '11px 15px', borderTop: '1px solid rgba(255,255,255,0.05)', background: '#0a0a12', flexShrink: 0 }}>
          {realtime.error && (
            <p style={{ fontSize: 11, color: '#f87171', margin: '0 0 6px' }}>{realtime.error}</p>
          )}
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <button
              onClick={realtime.isConnected ? realtime.disconnect : realtime.connect}
              style={{
                padding: '7px 9px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: realtime.isConnected ? 'rgba(239,68,68,0.65)' : 'rgba(255,255,255,0.04)',
                color: realtime.isConnected ? '#fff' : 'rgba(255,255,255,0.28)',
                flexShrink: 0, transition: 'all 0.2s',
              }}
            >
              {realtime.isConnected ? <PhoneOff size={12} /> : <Phone size={12} />}
            </button>

            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={desires.length > 0 ? `她有 ${desires.length} 件事在心里...` : '和 Cecelia 说话...'}
              disabled={realtime.isConnected || sending}
              style={{
                flex: 1, padding: '9px 13px', borderRadius: 8,
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#e2e8f0', fontSize: 13, outline: 'none',
                opacity: (realtime.isConnected || sending) ? 0.4 : 1,
              }}
            />

            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || sending || realtime.isConnected}
              style={{
                padding: '7px 9px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: input.trim() && !sending && !realtime.isConnected
                  ? 'rgba(110,40,220,0.8)'
                  : 'rgba(255,255,255,0.04)',
                color: input.trim() && !sending && !realtime.isConnected
                  ? '#fff'
                  : 'rgba(255,255,255,0.2)',
                flexShrink: 0, transition: 'all 0.2s',
              }}
            >
              <Send size={12} />
            </button>
          </div>
        </div>

      </div>

      {/* ── 右侧决策面板 ── */}
      <DecisionPanel queuedTasks={queuedTasks} onSend={handleSend} />

    </div>
  );
}
