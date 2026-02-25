import { useState, useEffect, useRef, useCallback } from 'react';
import { Brain, Send, Phone, PhoneOff, Mic, Volume2, Maximize2, Minimize2, Clock, Activity, Zap, CheckCircle, MessageSquare, AlertCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
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
}

// ── Constants ─────────────────────────────────────────────

const ALERTNESS_CONF = {
  0: { label: 'SLEEP', color: '#64748b' },
  1: { label: 'CALM',  color: '#22c55e' },
  2: { label: 'AWARE', color: '#3b82f6' },
  3: { label: 'ALERT', color: '#f59e0b' },
  4: { label: 'PANIC', color: '#ef4444' },
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

// ── 工具：提取 desire 第一段作为摘要 ──────────────────────

function extractSummary(content: string, maxLen = 120): string {
  const clean = content
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  const firstPara = clean.split('\n').find(l => l.trim().length > 10) || clean;
  return firstPara.length > maxLen ? firstPara.slice(0, maxLen) + '...' : firstPara;
}

// ── 汇报卡片：Cecelia 主动沟通 ──────────────────────────

function DesireCard({ desire, onAction }: {
  desire: Desire;
  onAction: (action: string, desire: Desire) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const summary = extractSummary(desire.content);
  const isLong = desire.content.length > 150;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderLeft: `3px solid ${desire.urgency >= 8 ? '#ef4444' : desire.urgency >= 5 ? '#f59e0b' : 'rgba(167,139,250,0.4)'}`,
      borderRadius: 12, padding: '16px 20px', transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 7, flexShrink: 0,
          background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Brain size={12} style={{ color: 'rgba(167,139,250,0.7)' }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(167,139,250,0.6)' }}>Cecelia 想跟您说</span>
        {desire.urgency >= 7 && (
          <span style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 10, marginLeft: 'auto' }}>
            紧急
          </span>
        )}
      </div>

      <p style={{
        margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7,
        ...(!expanded && isLong ? { overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const } : {}),
      }}>
        {expanded ? desire.content.replace(/\*\*/g, '').replace(/^#+\s*/gm, '') : summary}
      </p>

      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0 0',
            color: 'rgba(167,139,250,0.45)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {expanded ? <><ChevronUp size={12} />收起</> : <><ChevronDown size={12} />展开全文</>}
        </button>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={() => onAction('ack', desire)} style={btnStyle('rgba(255,255,255,0.06)', 'rgba(255,255,255,0.4)')}>
          <CheckCircle size={12} />已了解
        </button>
        <button onClick={() => onAction('ask', desire)} style={btnStyle('rgba(124,58,237,0.12)', '#a78bfa')}>
          <MessageSquare size={12} />详细说说
        </button>
        <button onClick={() => onAction('act', desire)} style={btnStyle('rgba(34,197,94,0.12)', '#4ade80')}>
          <Zap size={12} />处理一下
        </button>
      </div>
    </div>
  );
}

// ── 任务卡片：需要您确认 ─────────────────────────────────

function TaskCard({ task, onAction }: {
  task: Task;
  onAction: (action: string, task: Task) => void;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderLeft: `3px solid ${PRIORITY_COLOR[task.priority] ?? '#6b7280'}55`,
      borderRadius: 12, padding: '16px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
          background: `${PRIORITY_COLOR[task.priority] ?? '#6b7280'}18`,
          color: PRIORITY_COLOR[task.priority] ?? '#6b7280',
        }}>{task.priority}</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 5 }}>
          {task.task_type}
        </span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', marginLeft: 'auto' }}>需要您确认</span>
      </div>

      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.5 }}>
        {task.title}
      </h3>
      {task.description && (
        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
          {task.description.length > 100 ? task.description.slice(0, 100) + '...' : task.description}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button onClick={() => onAction('dispatch', task)} style={btnStyle('rgba(34,197,94,0.12)', '#4ade80')}>
          <CheckCircle size={12} />派发吧
        </button>
        <button onClick={() => onAction('pause', task)} style={btnStyle('rgba(245,158,11,0.1)', '#fbbf24')}>
          <AlertCircle size={12} />再等等
        </button>
        <button onClick={() => onAction('ask', task)} style={btnStyle('rgba(124,58,237,0.12)', '#a78bfa')}>
          <MessageSquare size={12} />问一下
        </button>
        <button onClick={() => onAction('abandon', task)} style={btnStyle('rgba(239,68,68,0.06)', 'rgba(239,68,68,0.45)')}>
          <XCircle size={12} />
        </button>
      </div>
    </div>
  );
}

// ── 对话气泡 ─────────────────────────────────────────────

function ChatBubble({ msg }: { msg: { id: string; role: string; content: string; toolCall?: any } }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
      {!isUser && (
        <div style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Brain size={12} style={{ color: 'rgba(167,139,250,0.6)' }} />
        </div>
      )}
      <div style={{
        maxWidth: '75%',
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        fontSize: 13.5, lineHeight: 1.65, padding: '10px 14px', wordBreak: 'break-word',
        ...(isUser
          ? { background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff' }
          : { background: 'rgba(255,255,255,0.03)', color: '#c4ccdc', border: '1px solid rgba(255,255,255,0.06)' }
        ),
      }}>
        {msg.toolCall && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>→ {msg.toolCall.name}</div>}
        <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
      </div>
    </div>
  );
}

// ── 按钮样式工具 ────────────────────────────────────────

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: bg, color, fontSize: 12, fontWeight: 500,
    display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
  };
}

// ── 主组件 ───────────────────────────────────────────────

export default function CeceliaPage() {
  const {
    messages, addMessage, input, setInput, sending, setSending, generateId,
    currentRoute, frontendTools, executeFrontendTool, getPageContext,
  } = useCecelia();

  const openingFiredRef = useRef(false);
  const feedEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [desires, setDesires] = useState<Desire[]>([]);
  const [alertnessLevel, setAlertnessLevel] = useState(1);
  const [thinkingPhase, setThinkingPhase] = useState(0);
  const [queuedTasks, setQueuedTasks] = useState<Task[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [status, setStatus] = useState<StatusData>({ tasksQueued: 0, tasksInProgress: 0, tickActionsToday: 0 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && fullscreen) setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  useEffect(() => {
    if (!sending) { setThinkingPhase(0); return; }
    const t = setInterval(() => setThinkingPhase(p => (p + 1) % 3), 1500);
    return () => clearInterval(t);
  }, [sending]);

  // 只在用户主动发消息后才滚动到底部（跳过 opening message）
  const userHasInteracted = useRef(false);
  useEffect(() => {
    if (messages.some(m => m.role === 'user')) userHasInteracted.current = true;
    if (userHasInteracted.current) feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    const load = async () => { try { const r = await fetch('/api/brain/alertness'); if (r.ok) { const d = await r.json(); setAlertnessLevel(d.level ?? 1); } } catch { /* */ } };
    load(); const t = setInterval(load, 30_000); return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = async () => { try { const r = await fetch('/api/brain/desires?status=pending&limit=10'); if (!r.ok) return; const d = await r.json(); setDesires(Array.isArray(d) ? d : (d.desires || [])); } catch { /* */ } };
    load(); const t = setInterval(load, 30_000); return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = async () => { try { const r = await fetch('/api/brain/tasks?status=queued&limit=8'); if (!r.ok) return; const d = await r.json(); setQueuedTasks(Array.isArray(d) ? d : (d.tasks || [])); } catch { /* */ } };
    load(); const t = setInterval(load, 60_000); return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [fullRes, ipRes] = await Promise.all([fetch('/api/brain/status/full'), fetch('/api/brain/tasks?status=in_progress&limit=50')]);
        const ipData = ipRes.ok ? await ipRes.json() : [];
        const ipCount = Array.isArray(ipData) ? ipData.length : (ipData.tasks?.length ?? 0);
        if (fullRes.ok) { const d = await fullRes.json(); setStatus({ tasksQueued: d.task_queue?.queued ?? 0, tasksInProgress: ipCount, tickActionsToday: d.tick_stats?.actions_today ?? 0 }); }
      } catch { /* */ }
    };
    load(); const t = setInterval(load, 60_000); return () => clearInterval(t);
  }, []);

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
      } catch { /* */ } finally { setSending(false); }
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
      else if (data.error) addMessage({ id: generateId(), role: 'assistant', content: `\u26a0\ufe0f ${data.error}` });
    } catch {
      addMessage({ id: generateId(), role: 'assistant', content: '\u53d1\u751f\u9519\u8bef\uff0c\u8bf7\u91cd\u8bd5' });
    } finally { setSending(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, sending, messages, currentRoute, frontendTools]);

  const handleDesireAction = useCallback((action: string, desire: Desire) => {
    const summary = extractSummary(desire.content, 80);
    const msgs: Record<string, string> = {
      ack: `好的，我知道了：「${summary}」`,
      ask: `关于这件事能详细说说吗？「${summary}」`,
      act: `这件事需要处理，请帮我分析一下下一步：「${summary}」`,
    };
    handleSend(msgs[action] ?? msgs.ask);
  }, [handleSend]);

  const handleTaskAction = useCallback((action: string, task: Task) => {
    const msgs: Record<string, string> = {
      dispatch: `请派发任务「${task.title}」（${task.priority} / ${task.task_type}）`,
      pause: `请暂缓任务「${task.title}」`,
      abandon: `请放弃任务「${task.title}」`,
      ask: `关于任务「${task.title}」（${task.priority} / ${task.task_type}），请解释一下背景和目的`,
    };
    handleSend(msgs[action] ?? msgs.ask);
  }, [handleSend]);

  const realtime = useRealtimeVoice({
    onUserSpeech: useCallback((text: string) => { if (text.trim()) handleSend(text.trim()); }, [handleSend]),
  });

  const aC = ALERTNESS_CONF[alertnessLevel as keyof typeof ALERTNESS_CONF] ?? ALERTNESS_CONF[1];

  const containerStyle: React.CSSProperties = fullscreen
    ? { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: '#09090f' }
    : { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: '#09090f' };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{
        flexShrink: 0, padding: '0 24px', height: 52,
        display: 'flex', alignItems: 'center', gap: 16,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.01)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Brain size={15} style={{ color: 'rgba(167,139,250,0.7)' }} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>Cecelia</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: aC.color }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: aC.color }}>{aC.label}</span>
          </div>
          <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} style={{ color: 'rgba(255,255,255,0.25)' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Q{status.tasksQueued}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Activity size={11} style={{ color: status.tasksInProgress > 0 ? '#3b82f6' : 'rgba(255,255,255,0.25)' }} />
            <span style={{ fontSize: 11, color: status.tasksInProgress > 0 ? '#60a5fa' : 'rgba(255,255,255,0.4)' }}>{status.tasksInProgress}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Zap size={11} style={{ color: 'rgba(255,255,255,0.25)' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{status.tickActionsToday}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {realtime.isConnected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 4 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', animation: 'pulse 1s infinite' }} />
              {realtime.isRecording && <Mic size={11} style={{ color: '#10b981' }} />}
              {realtime.isPlaying && <Volume2 size={11} style={{ color: '#10b981' }} />}
            </div>
          )}
          <button
            onClick={() => setFullscreen(!fullscreen)}
            style={{
              padding: 6, borderRadius: 7, border: 'none', cursor: 'pointer',
              background: fullscreen ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
              color: fullscreen ? '#a78bfa' : 'rgba(255,255,255,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title={fullscreen ? '退出全屏 (Esc)' : '全屏'}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Briefing Feed */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 680, padding: '24px 20px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {desires.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Cecelia 想跟您说</span>
                <span style={{ fontSize: 10, color: 'rgba(167,139,250,0.35)', background: 'rgba(167,139,250,0.08)', padding: '1px 7px', borderRadius: 10 }}>{desires.length}</span>
              </div>
              {desires.slice(0, 5).map(d => <DesireCard key={d.id} desire={d} onAction={handleDesireAction} />)}
            </>
          )}

          {queuedTasks.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 4px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>需要您确认的任务</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.04)', padding: '1px 7px', borderRadius: 10 }}>{status.tasksQueued}</span>
              </div>
              {queuedTasks.map(t => <TaskCard key={t.id} task={t} onAction={handleTaskAction} />)}
            </>
          )}

          {desires.length === 0 && queuedTasks.length === 0 && messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.12)' }}>
              <Brain size={40} style={{ opacity: 0.15, marginBottom: 12 }} />
              <p style={{ fontSize: 13, margin: 0 }}>一切安好，暂无需要汇报的事项</p>
            </div>
          )}

          {messages.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 4px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>对话</span>
              </div>
              {messages.map(msg => <ChatBubble key={msg.id} msg={msg} />)}
            </>
          )}

          {sending && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Brain size={12} style={{ color: 'rgba(167,139,250,0.5)' }} />
              </div>
              <div style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '14px 14px 14px 4px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i === thinkingPhase ? '#a78bfa' : 'rgba(167,139,250,0.15)', transition: 'background 0.4s' }} />)}
                </div>
                <span style={{ fontSize: 11, color: 'rgba(167,139,250,0.45)' }}>{['感知中', '思考中', '深思中'][thinkingPhase]}</span>
              </div>
            </div>
          )}

          <div ref={feedEndRef} />
        </div>
      </div>

      {/* Bottom Chat Input */}
      <div style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 680, padding: '12px 20px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={realtime.isConnected ? realtime.disconnect : realtime.connect}
            style={{ padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', flexShrink: 0, background: realtime.isConnected ? 'rgba(239,68,68,0.55)' : 'rgba(255,255,255,0.04)', color: realtime.isConnected ? '#fff' : 'rgba(255,255,255,0.3)' }}
          >
            {realtime.isConnected ? <PhoneOff size={14} /> : <Phone size={14} />}
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="跟 Cecelia 说点什么..."
            disabled={realtime.isConnected || sending}
            style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#e2e8f0', fontSize: 13.5, outline: 'none', opacity: (realtime.isConnected || sending) ? 0.4 : 1 }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending || realtime.isConnected}
            style={{ padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', flexShrink: 0, background: input.trim() && !sending && !realtime.isConnected ? 'rgba(110,40,220,0.8)' : 'rgba(255,255,255,0.04)', color: input.trim() && !sending && !realtime.isConnected ? '#fff' : 'rgba(255,255,255,0.2)' }}
          >
            <Send size={14} />
          </button>
        </div>
        {realtime.error && <p style={{ fontSize: 10, color: '#f87171', textAlign: 'center', margin: '0 0 8px' }}>{realtime.error}</p>}
      </div>
    </div>
  );
}
