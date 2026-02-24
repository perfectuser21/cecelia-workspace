import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Brain, Send, RefreshCw, Phone, PhoneOff, Mic, Volume2,
  AlertTriangle, CheckCircle, Clock, Zap, Navigation
} from 'lucide-react';
import { useCecelia } from '@/contexts/CeceliaContext';
import { useRealtimeVoice } from '@features/core/shared/hooks/useRealtimeVoice';

// --------------- helpers ---------------
interface Desire {
  id: string;
  type: string;
  content: string;
  urgency: number;
  created_at: string;
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function urgencyStyle(u: number) {
  if (u >= 8) return { dot: '#ef4444', border: 'border-red-500/25', bg: 'bg-red-500/8', label: 'text-red-400' };
  if (u >= 5) return { dot: '#f59e0b', border: 'border-amber-500/25', bg: 'bg-amber-500/8', label: 'text-amber-400' };
  return { dot: '#22c55e', border: 'border-green-500/20', bg: 'bg-green-500/5', label: 'text-green-400' };
}

// --------------- route aliases (same as CeceliaChat) ---------------
const ROUTE_ALIASES: Record<string, string> = {
  'okr': '/okr', '目标': '/okr',
  'projects': '/projects', '项目': '/projects',
  'tasks': '/work/tasks', '任务': '/work/tasks',
  'work': '/work', '工作': '/work',
  'today': '/today', '今天': '/today',
};

// --------------- main page ---------------
export default function CeceliaPage() {
  const {
    messages, addMessage, input, setInput, sending, setSending, generateId,
    currentRoute, frontendTools, executeFrontendTool, getPageContext,
  } = useCecelia();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [desires, setDesires] = useState<Desire[]>([]);
  const [desiresLoading, setDesiresLoading] = useState(true);

  // scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // load desires
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/brain/desires?status=pending&limit=8');
        if (!res.ok) return;
        const data = await res.json();
        setDesires(Array.isArray(data) ? data : (data.desires || []));
      } catch { /* silent */ } finally {
        setDesiresLoading(false);
      }
    }
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const realtime = useRealtimeVoice({
    onTranscript: useCallback((text: string) => {
      if (text.trim()) sendMessage(text.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  });

  async function sendMessage(overrideText?: string) {
    const text = overrideText ?? input.trim();
    if (!text || sending) return;
    if (!overrideText) setInput('');
    setSending(true);
    addMessage({ id: generateId(), role: 'user', content: text });

    try {
      // check frontend commands first
      const lowerMsg = text.toLowerCase();
      const hasNavIntent = /打开|去|转|看|进入|切换|跳转|navigate|open|go/i.test(lowerMsg);
      if (hasNavIntent) {
        for (const [alias, route] of Object.entries(ROUTE_ALIASES).sort((a, b) => b[0].length - a[0].length)) {
          if (lowerMsg.includes(alias)) {
            const result = await executeFrontendTool('navigate', { path: route });
            addMessage({ id: generateId(), role: 'assistant', content: result, toolCall: { name: 'navigate', result } });
            setSending(false);
            return;
          }
        }
      }

      const res = await fetch('/api/orchestrator/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          messages: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          context: {
            currentRoute,
            pageContext: getPageContext(),
            availableTools: frontendTools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })),
          },
        }),
      });
      const data = await res.json();
      if (data.reply) {
        addMessage({ id: generateId(), role: 'assistant', content: data.reply });
      } else if (data.error) {
        addMessage({ id: generateId(), role: 'assistant', content: `⚠️ ${data.error}` });
      }
    } catch {
      addMessage({ id: generateId(), role: 'assistant', content: '发生错误，请重试' });
    } finally {
      setSending(false);
    }
  }

  const highUrgency = desires.some(d => d.urgency >= 8);

  return (
    <div style={{ display: 'flex', height: '100%', background: '#09090f' }}>

      {/* ── Left sidebar: desires ── */}
      <div style={{
        width: 240, flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        background: '#0c0c14',
      }}>
        {/* header */}
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Brain size={13} style={{ color: '#a78bfa' }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              内心状态
            </span>
            {highUrgency && <AlertTriangle size={11} style={{ color: '#ef4444', marginLeft: 'auto' }} />}
          </div>
        </div>

        {/* list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {desiresLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 24 }}>
              <RefreshCw size={14} style={{ color: 'rgba(167,139,250,0.4)', animation: 'spin 1s linear infinite' }} />
            </div>
          )}
          {!desiresLoading && desires.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 24 }}>
              <CheckCircle size={16} style={{ color: 'rgba(34,197,94,0.4)' }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>无待处理欲望</span>
            </div>
          )}
          {desires.map(d => {
            const s = urgencyStyle(d.urgency);
            return (
              <div key={d.id} style={{
                borderRadius: 8,
                border: `1px solid ${s.dot}22`,
                background: `${s.dot}08`,
                padding: '8px 10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: s.dot }}>
                    {d.type}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 700 }}>
                    {d.urgency}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {d.content}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
                  <Clock size={9} style={{ color: 'rgba(255,255,255,0.2)' }} />
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>{timeAgo(d.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* footer */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Zap size={11} style={{ color: 'rgba(167,139,250,0.5)' }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{desires.length} 欲望</span>
          </div>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
        </div>
      </div>

      {/* ── Main: chat ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* chat header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#0c0c14',
          flexShrink: 0,
        }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(139,92,246,0.3)', borderRadius: 8, filter: 'blur(4px)' }} />
            <div style={{ position: 'relative', padding: 7, background: 'linear-gradient(135deg,#374151,rgba(124,58,237,0.2),#1f2937)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
              <Brain size={14} style={{ color: '#c4b5fd' }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>Cecelia</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>AI 管家</div>
          </div>
          {realtime.isConnected && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulse 1s infinite' }} />
              {realtime.isRecording && <Mic size={12} style={{ color: '#10b981' }} />}
              {realtime.isPlaying && <Volume2 size={12} style={{ color: '#10b981' }} />}
              <span style={{ fontSize: 10, color: '#10b981' }}>语音连接中</span>
            </div>
          )}
        </div>

        {/* messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}>
          {messages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', inset: -8, background: 'rgba(139,92,246,0.15)', borderRadius: '50%', filter: 'blur(12px)' }} />
                <Brain size={32} style={{ position: 'relative', color: 'rgba(167,139,250,0.5)' }} />
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', margin: 0 }}>和 Cecelia 说点什么吧</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {['今天状态怎么样', '有什么担忧', '任务队列如何'].map(q => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    style={{
                      padding: '5px 12px', borderRadius: 20, border: '1px solid rgba(139,92,246,0.3)',
                      background: 'rgba(139,92,246,0.08)', color: 'rgba(167,139,250,0.8)',
                      fontSize: 11, cursor: 'pointer',
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && (
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#374151,rgba(124,58,237,0.3))', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 8, marginTop: 2 }}>
                    <Brain size={11} style={{ color: '#c4b5fd' }} />
                  </div>
                )}
                <div style={{
                  maxWidth: '72%', borderRadius: 12, fontSize: 13, lineHeight: 1.6,
                  padding: '8px 12px', wordBreak: 'break-word',
                  ...(msg.role === 'user'
                    ? { background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', boxShadow: '0 4px 12px rgba(124,58,237,0.25)' }
                    : { background: 'rgba(30,30,46,0.8)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.06)' }
                  ),
                }}>
                  {msg.toolCall && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, opacity: 0.6, marginBottom: 4 }}>
                      <Navigation size={10} />
                      <span>{msg.toolCall.name}</span>
                    </div>
                  )}
                  {msg.content}
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#374151,rgba(124,58,237,0.3))', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                  <Brain size={11} style={{ color: '#c4b5fd' }} />
                </div>
                <div style={{ padding: '8px 14px', background: 'rgba(30,30,46,0.8)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <RefreshCw size={13} style={{ color: '#a78bfa', animation: 'spin 1s linear infinite' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* input bar */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', background: '#0c0c14', flexShrink: 0 }}>
          {realtime.error && <p style={{ fontSize: 11, color: '#f87171', marginBottom: 6 }}>{realtime.error}</p>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={realtime.isConnected ? realtime.disconnect : realtime.connect}
              style={{
                padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: realtime.isConnected ? 'rgba(239,68,68,0.8)' : 'rgba(16,185,129,0.7)',
                color: '#fff', flexShrink: 0,
              }}
            >
              {realtime.isConnected ? <PhoneOff size={14} /> : <Phone size={14} />}
            </button>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="和 Cecelia 说话..."
              disabled={realtime.isConnected}
              style={{
                flex: 1, padding: '9px 14px', borderRadius: 10,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#e2e8f0', fontSize: 13, outline: 'none',
                opacity: realtime.isConnected ? 0.4 : 1,
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || sending || realtime.isConnected}
              style={{
                padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: input.trim() && !sending && !realtime.isConnected ? '#7c3aed' : 'rgba(255,255,255,0.06)',
                color: input.trim() && !sending && !realtime.isConnected ? '#fff' : 'rgba(255,255,255,0.25)',
                flexShrink: 0, transition: 'all 0.15s',
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
