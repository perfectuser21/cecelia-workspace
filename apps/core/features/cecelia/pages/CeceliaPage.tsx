import { useState, useEffect, useRef, useCallback } from 'react';
import { Brain, Send, Phone, PhoneOff, Mic, Volume2, Zap, Clock, Activity, CheckCircle, XCircle, MessageSquare, AlertCircle, Pencil } from 'lucide-react';
import { useCecelia } from '@/contexts/CeceliaContext';
import { useRealtimeVoice } from '@features/core/shared/hooks/useRealtimeVoice';

// ── Types ─────────────────────────────────────────────────

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
  description?: string;
}

interface StatusData {
  tasksQueued: number;
  tasksInProgress: number;
  tickActionsToday: number;
  lastDispatch: string | null;
}

// ── Constants ─────────────────────────────────────────────

const ALERTNESS_CONF = {
  0: { label: 'SLEEPING', color: '#64748b', pulse: false },
  1: { label: 'CALM',     color: '#22c55e', pulse: false },
  2: { label: 'AWARE',    color: '#3b82f6', pulse: true  },
  3: { label: 'ALERT',    color: '#f59e0b', pulse: true  },
  4: { label: 'PANIC',    color: '#ef4444', pulse: true  },
} as const;

const PRIORITY_COLOR: Record<string, string> = {
  P0: '#ef4444', P1: '#f59e0b', P2: '#3b82f6', P3: '#6b7280',
};

const ROUTE_ALIASES: Record<string, string> = {
  'okr': '/okr', '目标': '/okr',
  'projects': '/projects', '项目': '/projects',
  'tasks': '/work/tasks', '任务': '/work/tasks',
  'work': '/work', '工作': '/work',
};

// ── 左侧状态面板 ───────────────────────────────────────────

function StatusPanel({ alertnessLevel, desires, status }: {
  alertnessLevel: number;
  desires: Desire[];
  status: StatusData;
}) {
  const aC = ALERTNESS_CONF[alertnessLevel as keyof typeof ALERTNESS_CONF] ?? ALERTNESS_CONF[1];
  return (
    <div style={{
      width: 156, flexShrink: 0, background: '#060610',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* 警觉度 */}
      <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>系统状态</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: aC.color, flexShrink: 0, ...(aC.pulse ? { animation: 'pulse 2s ease-in-out infinite' } : {}) }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: aC.color, letterSpacing: '0.06em' }}>{aC.label}</span>
        </div>
        {[
          { icon: <Clock size={9} />, label: '队列', val: status.tasksQueued, hi: status.tasksQueued > 5 ? '#f59e0b' : undefined },
          { icon: <Activity size={9} />, label: '进行中', val: status.tasksInProgress, hi: status.tasksInProgress > 0 ? '#3b82f6' : undefined },
          { icon: <Zap size={9} />, label: '今日', val: status.tickActionsToday },
        ].map(({ icon, label, val, hi }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 0' }}>
            <span style={{ color: hi ?? 'rgba(255,255,255,0.25)' }}>{icon}</span>
            <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)', flex: 1 }}>{label}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: hi ?? 'rgba(255,255,255,0.55)' }}>{val}</span>
          </div>
        ))}
      </div>

      {/* 欲望 */}
      <div style={{ padding: '8px 12px 5px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>内心欲望</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '5px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {desires.length === 0
          ? <div style={{ paddingTop: 16, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.14)' }}>平静</div>
          : desires.map(d => (
            <div key={d.id} style={{
              borderRadius: 4, padding: '5px 7px',
              background: d.urgency >= 8 ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.015)',
              borderLeft: `2px solid ${d.urgency >= 8 ? 'rgba(239,68,68,0.45)' : d.urgency >= 5 ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.05)'}`,
            }}>
              <p style={{ margin: 0, fontSize: 9.5, color: 'rgba(255,255,255,0.38)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {d.content}
              </p>
            </div>
          ))
        }
      </div>
      <div style={{ padding: '5px 12px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Zap size={8} style={{ color: 'rgba(167,139,250,0.28)' }} />
        <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.16)' }}>{desires.length} 件</span>
      </div>
    </div>
  );
}

// ── 焦点卡（中间上半）─────────────────────────────────────

function FocusCard({ task, userNote, onNoteChange, onAction }: {
  task: Task | null;
  userNote: string;
  onNoteChange: (v: string) => void;
  onAction: (action: string, task: Task) => void;
}) {
  if (!task) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'rgba(255,255,255,0.12)' }}>
        <Brain size={32} style={{ opacity: 0.2 }} />
        <p style={{ fontSize: 12, margin: 0 }}>点击下方任务，开始协作</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 18px', gap: 12, minHeight: 0 }}>
      {/* 任务标题 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
            background: `${PRIORITY_COLOR[task.priority] ?? '#6b7280'}22`,
            color: PRIORITY_COLOR[task.priority] ?? '#6b7280',
            letterSpacing: '0.04em',
          }}>{task.priority}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 4 }}>{task.task_type}</span>
        </div>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.4 }}>{task.title}</h2>
        {task.description && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>{task.description}</p>
        )}
      </div>

      {/* 我的想法 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Pencil size={10} style={{ color: 'rgba(167,139,250,0.5)' }} />
          <span style={{ fontSize: 9.5, color: 'rgba(167,139,250,0.5)', letterSpacing: '0.06em', fontWeight: 600, textTransform: 'uppercase' }}>我的想法</span>
        </div>
        <textarea
          value={userNote}
          onChange={e => onNoteChange(e.target.value)}
          placeholder="写下你的想法、意见、补充要求..."
          style={{
            flex: 1, resize: 'none', outline: 'none',
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8, padding: '10px 12px',
            color: '#c4ccdc', fontSize: 12.5, lineHeight: 1.6,
            fontFamily: 'inherit', minHeight: 80,
          }}
        />
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => onAction('dispatch', task)}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'rgba(34,197,94,0.15)', color: '#4ade80', fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(34,197,94,0.25)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(34,197,94,0.15)'; }}
        >
          <CheckCircle size={12} />派发
        </button>
        <button
          onClick={() => onAction('ask', task)}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'rgba(124,58,237,0.15)', color: '#a78bfa', fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.28)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.15)'; }}
        >
          <MessageSquare size={12} />问一问
        </button>
        <button
          onClick={() => onAction('pause', task)}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'rgba(245,158,11,0.12)', color: '#fbbf24', fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.22)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.12)'; }}
        >
          <AlertCircle size={12} />暂缓
        </button>
        <button
          onClick={() => onAction('abandon', task)}
          style={{
            padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'rgba(239,68,68,0.08)', color: 'rgba(239,68,68,0.55)', fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.18)';
            (e.currentTarget as HTMLButtonElement).style.color = '#f87171';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(239,68,68,0.55)';
          }}
        >
          <XCircle size={12} />
        </button>
      </div>
    </div>
  );
}

// ── 任务网格（中间下半）────────────────────────────────────

function TaskGrid({ tasks, selectedId, onSelect }: {
  tasks: Task[];
  selectedId: string | null;
  onSelect: (t: Task) => void;
}) {
  return (
    <div style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ padding: '8px 18px 5px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>等待队列</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: 10 }}>{tasks.length}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '4px 18px 12px', overflowX: 'auto' }}>
        {tasks.length === 0 ? (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.16)', padding: '8px 0' }}>暂无等待任务</div>
        ) : tasks.slice(0, 12).map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            style={{
              flexShrink: 0, width: 160,
              padding: '8px 11px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left',
              background: selectedId === t.id ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.028)',
              borderBottom: selectedId === t.id ? '2px solid rgba(124,58,237,0.5)' : '2px solid transparent',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (selectedId !== t.id) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.055)'; }}
            onMouseLeave={e => { if (selectedId !== t.id) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.028)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <span style={{
                fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                background: `${PRIORITY_COLOR[t.priority] ?? '#6b7280'}20`,
                color: PRIORITY_COLOR[t.priority] ?? '#6b7280',
              }}>{t.priority}</span>
              <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.2)' }}>{t.task_type}</span>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {t.title}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 右侧对话面板 ───────────────────────────────────────────

function ChatPanel({ messages, sending, thinkingPhase, input, setInput, handleSend, realtime, desires }: {
  messages: any[];
  sending: boolean;
  thinkingPhase: number;
  input: string;
  setInput: (v: string) => void;
  handleSend: (text?: string) => void;
  realtime: any;
  desires: Desire[];
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div style={{
      width: 240, flexShrink: 0, background: '#060610',
      borderLeft: '1px solid rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* 头部 */}
      <div style={{ padding: '10px 13px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Brain size={13} style={{ color: 'rgba(167,139,250,0.6)' }} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: '#c4ccdc' }}>Cecelia</span>
        {desires.length > 0 && (
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', marginLeft: 'auto' }}>{desires.length} 件心事</span>
        )}
        {realtime.isConnected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#10b981', animation: 'pulse 1s infinite' }} />
            {realtime.isRecording && <Mic size={9} style={{ color: '#10b981' }} />}
            {realtime.isPlaying && <Volume2 size={9} style={{ color: '#10b981' }} />}
          </div>
        )}
      </div>

      {/* 消息列表 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 4px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 5 }}>
              {msg.role === 'assistant' && (
                <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, background: 'rgba(24,16,44,0.75)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Brain size={9} style={{ color: 'rgba(196,181,253,0.5)' }} />
                </div>
              )}
              <div style={{
                maxWidth: '84%',
                borderRadius: msg.role === 'user' ? '10px 10px 3px 10px' : '10px 10px 10px 3px',
                fontSize: 11.5, lineHeight: 1.55, padding: '7px 10px', wordBreak: 'break-word',
                ...(msg.role === 'user'
                  ? { background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff' }
                  : { background: 'rgba(14,12,26,0.85)', color: '#b8c2d4', border: '1px solid rgba(255,255,255,0.04)' }
                ),
              }}>
                {msg.toolCall && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', marginBottom: 3 }}>→ {msg.toolCall.name}</div>}
                <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
              </div>
            </div>
          ))}

          {sending && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5 }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, background: 'rgba(24,16,44,0.75)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Brain size={9} style={{ color: 'rgba(196,181,253,0.42)' }} />
              </div>
              <div style={{ padding: '6px 10px', background: 'rgba(14,12,26,0.85)', borderRadius: '10px 10px 10px 3px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: i === thinkingPhase ? '#a78bfa' : 'rgba(167,139,250,0.18)', transition: 'background 0.4s' }} />
                  ))}
                </div>
                <span style={{ fontSize: 9.5, color: 'rgba(167,139,250,0.5)' }}>
                  {['感知中', '思考中', '深思中'][thinkingPhase]}
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入框 */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        {realtime.error && <p style={{ fontSize: 10, color: '#f87171', margin: '0 0 5px' }}>{realtime.error}</p>}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <button
            onClick={realtime.isConnected ? realtime.disconnect : realtime.connect}
            style={{ padding: '6px 7px', borderRadius: 7, border: 'none', cursor: 'pointer', background: realtime.isConnected ? 'rgba(239,68,68,0.55)' : 'rgba(255,255,255,0.04)', color: realtime.isConnected ? '#fff' : 'rgba(255,255,255,0.25)', flexShrink: 0 }}
          >
            {realtime.isConnected ? <PhoneOff size={10} /> : <Phone size={10} />}
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="问 Cecelia..."
            disabled={realtime.isConnected || sending}
            style={{
              flex: 1, padding: '7px 10px', borderRadius: 7,
              background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
              color: '#e2e8f0', fontSize: 11.5, outline: 'none',
              opacity: (realtime.isConnected || sending) ? 0.4 : 1,
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending || realtime.isConnected}
            style={{
              padding: '6px 7px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: input.trim() && !sending && !realtime.isConnected ? 'rgba(110,40,220,0.8)' : 'rgba(255,255,255,0.04)',
              color: input.trim() && !sending && !realtime.isConnected ? '#fff' : 'rgba(255,255,255,0.18)',
              flexShrink: 0,
            }}
          >
            <Send size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────

export default function CeceliaPage() {
  const {
    messages, addMessage, input, setInput, sending, setSending, generateId,
    currentRoute, frontendTools, executeFrontendTool, getPageContext,
  } = useCecelia();

  const openingFiredRef = useRef(false);

  const [desires, setDesires] = useState<Desire[]>([]);
  const [alertnessLevel, setAlertnessLevel] = useState(1);
  const [thinkingPhase, setThinkingPhase] = useState(0);
  const [queuedTasks, setQueuedTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [userNote, setUserNote] = useState('');
  const [status, setStatus] = useState<StatusData>({
    tasksQueued: 0, tasksInProgress: 0, tickActionsToday: 0, lastDispatch: null,
  });

  // thinking cycle
  useEffect(() => {
    if (!sending) { setThinkingPhase(0); return; }
    const t = setInterval(() => setThinkingPhase(p => (p + 1) % 3), 1500);
    return () => clearInterval(t);
  }, [sending]);

  // poll alertness
  useEffect(() => {
    const load = async () => {
      try { const r = await fetch('/api/brain/alertness'); if (r.ok) { const d = await r.json(); setAlertnessLevel(d.level ?? 1); } } catch { /* silent */ }
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

  // poll queued tasks
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/brain/tasks?status=queued&limit=20');
        if (!r.ok) return;
        const d = await r.json();
        const tasks = Array.isArray(d) ? d : (d.tasks || []);
        setQueuedTasks(tasks);
        // 如果没有选中的任务，默认选第一个
        if (!selectedTask && tasks.length > 0) setSelectedTask(tasks[0]);
      } catch { /* silent */ }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // poll status
  useEffect(() => {
    const load = async () => {
      try {
        const [fullRes, ipRes] = await Promise.all([
          fetch('/api/brain/status/full'),
          fetch('/api/brain/tasks?status=in_progress&limit=50'),
        ]);
        const ipData = ipRes.ok ? await ipRes.json() : [];
        const ipCount = Array.isArray(ipData) ? ipData.length : (ipData.tasks?.length ?? 0);
        if (fullRes.ok) {
          const d = await fullRes.json();
          setStatus({ tasksQueued: d.task_queue?.queued ?? 0, tasksInProgress: ipCount, tickActionsToday: d.tick_stats?.actions_today ?? 0, lastDispatch: d.task_queue?.last_dispatch ?? null });
        }
      } catch { /* silent */ }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  // proactive opening
  useEffect(() => {
    if (messages.length > 0 || openingFiredRef.current) return;
    openingFiredRef.current = true;
    const fire = async () => {
      setSending(true);
      try {
        const r = await fetch('/api/orchestrator/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: '你好', messages: [], context: { currentRoute, pageContext: getPageContext(), opening: true, availableTools: frontendTools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })) } }),
        });
        const data = await r.json();
        if (data.reply) addMessage({ id: generateId(), role: 'assistant', content: data.reply });
      } catch { /* silent */ } finally { setSending(false); }
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
      if (/打开|去|进入|切换|navigate|open|go/i.test(lower)) {
        for (const [alias, route] of Object.entries(ROUTE_ALIASES).sort((a, b) => b[0].length - a[0].length)) {
          if (lower.includes(alias)) {
            const result = await executeFrontendTool('navigate', { path: route });
            addMessage({ id: generateId(), role: 'assistant', content: result, toolCall: { name: 'navigate', result } });
            return;
          }
        }
      }
      const r = await fetch('/api/orchestrator/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, messages: messages.slice(-10).map(m => ({ role: m.role, content: m.content })), context: { currentRoute, pageContext: getPageContext(), availableTools: frontendTools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })) } }),
      });
      const data = await r.json();
      if (data.reply) addMessage({ id: generateId(), role: 'assistant', content: data.reply });
      else if (data.error) addMessage({ id: generateId(), role: 'assistant', content: `⚠️ ${data.error}` });
    } catch {
      addMessage({ id: generateId(), role: 'assistant', content: '发生错误，请重试' });
    } finally { setSending(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, sending, messages, currentRoute, frontendTools]);

  // 点操作按钮 → 构造消息发到聊天
  const handleAction = useCallback((action: string, task: Task) => {
    const noteCtx = userNote.trim() ? `\n\n我的想法：${userNote.trim()}` : '';
    const msgs: Record<string, string> = {
      dispatch: `请派发任务「${task.title}」（${task.priority} / ${task.task_type}）${noteCtx}`,
      pause:    `请暂缓任务「${task.title}」，稍后再处理${noteCtx}`,
      abandon:  `请放弃任务「${task.title}」${noteCtx}`,
      ask:      `关于任务「${task.title}」（${task.priority} / ${task.task_type}）：${noteCtx || '\n请解释一下这个任务的背景和目的'}`,
    };
    handleSend(msgs[action] ?? msgs.ask);
    if (action !== 'ask') setUserNote('');
  }, [userNote, handleSend]);

  const realtime = useRealtimeVoice({
    onUserSpeech: useCallback((text: string) => { if (text.trim()) handleSend(text.trim()); }, [handleSend]),
  });

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', background: '#09090f' }}>

      {/* 左：状态面板 */}
      <StatusPanel alertnessLevel={alertnessLevel} desires={desires} status={status} />

      {/* 中：协作板 */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#0a0a13' }}>
        {/* 协作板标题 */}
        <div style={{ padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>协作板</span>
          {selectedTask && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 10 }}>
              {selectedTask.priority} · {selectedTask.task_type}
            </span>
          )}
        </div>

        {/* 焦点卡 */}
        <FocusCard
          task={selectedTask}
          userNote={userNote}
          onNoteChange={setUserNote}
          onAction={handleAction}
        />

        {/* 任务网格 */}
        <TaskGrid
          tasks={queuedTasks}
          selectedId={selectedTask?.id ?? null}
          onSelect={t => { setSelectedTask(t); setUserNote(''); }}
        />
      </div>

      {/* 右：对话面板 */}
      <ChatPanel
        messages={messages}
        sending={sending}
        thinkingPhase={thinkingPhase}
        input={input}
        setInput={setInput}
        handleSend={handleSend}
        realtime={realtime}
        desires={desires}
      />
    </div>
  );
}
