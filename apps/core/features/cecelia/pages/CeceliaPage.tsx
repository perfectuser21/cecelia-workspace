import React, { useState, useEffect, useCallback } from 'react';

interface Desire {
  id: string;
  type: 'warn' | 'inform' | 'propose' | 'celebrate' | 'question';
  content: string;
  urgency: number;
  status: 'pending' | 'expressed';
  created_at: string;
}

interface DesireStats {
  pending: number | string;
  pending_warns: number | string;
  pending_decisions: number | string;
  total: number | string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getUrgencyColor(urgency: number): string {
  if (urgency >= 9) return 'rgba(255,60,0,0.9)';
  if (urgency >= 5) return 'rgba(255,170,0,0.9)';
  return 'rgba(0,255,150,0.9)';
}

function getUrgencyStroke(urgency: number): string {
  if (urgency >= 9) return 'rgba(255,60,0,0.8)';
  if (urgency >= 5) return 'rgba(255,150,0,0.7)';
  return 'rgba(0,255,150,0.6)';
}

function getUrgencyGlow(urgency: number): string {
  if (urgency >= 9) return '0 0 20px rgba(255,60,0,0.5), 0 0 40px rgba(255,60,0,0.25)';
  if (urgency >= 5) return '0 0 18px rgba(255,150,0,0.4), 0 0 36px rgba(255,150,0,0.2)';
  return '0 0 16px rgba(0,255,150,0.4), 0 0 32px rgba(0,255,150,0.2)';
}

function getStatusLabel(maxUrgency: number): string {
  if (maxUrgency >= 10) return 'CRITICAL ALERT';
  if (maxUrgency >= 7) return 'ATTENTION REQUIRED';
  return 'MONITORING';
}

const TYPE_COLOR: Record<string, string> = {
  warn: '#ff4444',
  inform: '#00aaff',
  propose: '#aa44ff',
  celebrate: '#ffdd00',
  question: '#00ffcc',
};

const TYPE_LABEL: Record<string, string> = {
  warn: 'WARN',
  inform: 'INFO',
  propose: 'PROPOSE',
  celebrate: 'CELEBRATE',
  question: 'QUERY',
};

// SVG 头像组件
function CeceliaAvatar({ maxUrgency, orbitAngle }: { maxUrgency: number; orbitAngle: number }) {
  const stroke = getUrgencyStroke(maxUrgency);
  const glow = getUrgencyGlow(maxUrgency);

  // 轨道点位置
  const orbitR = 88;
  const dotX = 100 + orbitR * Math.cos((orbitAngle * Math.PI) / 180);
  const dotY = 100 + orbitR * Math.sin((orbitAngle * Math.PI) / 180);
  const dot2X = 100 + orbitR * Math.cos(((orbitAngle + 180) * Math.PI) / 180);
  const dot2Y = 100 + orbitR * Math.sin(((orbitAngle + 180) * Math.PI) / 180);

  // 内圈轨道点
  const innerR = 78;
  const iDotX = 100 + innerR * Math.cos(((orbitAngle * 1.5 + 90) * Math.PI) / 180);
  const iDotY = 100 + innerR * Math.sin(((orbitAngle * 1.5 + 90) * Math.PI) / 180);

  const strokeFaint = stroke.replace('0.8', '0.15').replace('0.7', '0.12').replace('0.6', '0.1');
  const strokeMid = stroke.replace('0.8', '0.35').replace('0.7', '0.28').replace('0.6', '0.22');
  const strokeDim = stroke.replace('0.8', '0.5').replace('0.7', '0.4').replace('0.6', '0.35');

  return (
    <svg
      viewBox="0 0 200 200"
      width="220"
      height="220"
      style={{ filter: `drop-shadow(${glow})`, overflow: 'visible' }}
    >
      <defs>
        <radialGradient id="headGlow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor={strokeFaint} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id="cheekL" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={stroke.replace('0.8', '0.12').replace('0.7', '0.1').replace('0.6', '0.08')} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id="cheekR" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={stroke.replace('0.8', '0.12').replace('0.7', '0.1').replace('0.6', '0.08')} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* 最外圈轨道 */}
      <circle cx="100" cy="100" r="93" fill="none" stroke={strokeFaint} strokeWidth="0.5" strokeDasharray="3,12" />

      {/* 外轨道 */}
      <circle cx="100" cy="100" r="88" fill="none" stroke={strokeMid} strokeWidth="0.8" strokeDasharray="6,14" />

      {/* 轨道运动点 */}
      <circle cx={dotX} cy={dotY} r="3" fill={stroke} style={{ filter: `drop-shadow(0 0 4px ${stroke})` }} />
      <circle cx={dot2X} cy={dot2Y} r="2" fill={strokeDim} />

      {/* 内轨道 */}
      <circle cx="100" cy="100" r="78" fill="none" stroke={strokeFaint} strokeWidth="0.6" strokeDasharray="4,10" />
      <circle cx={iDotX} cy={iDotY} r="2.5" fill={strokeDim} style={{ filter: `drop-shadow(0 0 3px ${stroke})` }} />

      {/* 头部主圆 */}
      <circle cx="100" cy="100" r="64" fill="rgba(0,8,4,0.94)" stroke={stroke} strokeWidth="1.5" />
      <circle cx="100" cy="100" r="64" fill="url(#headGlow)" />

      {/* 发型区域 */}
      <path
        d="M 55 76 Q 68 40 100 38 Q 132 40 145 76"
        fill="rgba(0,12,6,0.95)"
        stroke={strokeMid}
        strokeWidth="1"
      />
      {/* 刘海线条 */}
      <path d="M 60 76 Q 80 65 100 68 Q 120 65 140 76" fill="none" stroke={strokeFaint} strokeWidth="0.8" />

      {/* 耳朵 */}
      <ellipse cx="36" cy="103" rx="5" ry="7" fill="rgba(0,8,4,0.9)" stroke={strokeDim} strokeWidth="0.8" />
      <ellipse cx="164" cy="103" rx="5" ry="7" fill="rgba(0,8,4,0.9)" stroke={strokeDim} strokeWidth="0.8" />

      {/* 颈部 */}
      <line x1="93" y1="158" x2="107" y2="158" stroke={strokeMid} strokeWidth="1" />
      <line x1="90" y1="162" x2="110" y2="162" stroke={strokeFaint} strokeWidth="0.8" />

      {/* 肩部轮廓 */}
      <path d="M 52 178 Q 68 160 90 162 Q 100 165 110 162 Q 132 160 148 178" fill="none" stroke={strokeMid} strokeWidth="0.8" />

      {/* 左眉毛 */}
      <path d="M 74 88 Q 82 85 90 87" fill="none" stroke={strokeDim} strokeWidth="1.3" strokeLinecap="round" />

      {/* 右眉毛 */}
      <path d="M 110 87 Q 118 85 126 88" fill="none" stroke={strokeDim} strokeWidth="1.3" strokeLinecap="round" />

      {/* 左眼 */}
      <ellipse cx="82" cy="97" rx="6" ry="4" fill={strokeFaint} />
      <circle cx="82" cy="97" r="3.8" fill={stroke} style={{ filter: `drop-shadow(0 0 5px ${stroke})` }} />
      <circle cx="84" cy="95" r="1.4" fill="rgba(255,255,255,0.85)" />
      {/* 左睫毛 */}
      <line x1="75" y1="94" x2="78" y2="92.5" stroke={strokeDim} strokeWidth="0.8" />
      <line x1="82" y1="92" x2="82" y2="90" stroke={strokeDim} strokeWidth="0.8" />
      <line x1="87" y1="93" x2="90" y2="91.5" stroke={strokeDim} strokeWidth="0.8" />

      {/* 右眼 */}
      <ellipse cx="118" cy="97" rx="6" ry="4" fill={strokeFaint} />
      <circle cx="118" cy="97" r="3.8" fill={stroke} style={{ filter: `drop-shadow(0 0 5px ${stroke})` }} />
      <circle cx="120" cy="95" r="1.4" fill="rgba(255,255,255,0.85)" />
      {/* 右睫毛 */}
      <line x1="110" y1="91.5" x2="113" y2="93" stroke={strokeDim} strokeWidth="0.8" />
      <line x1="118" y1="92" x2="118" y2="90" stroke={strokeDim} strokeWidth="0.8" />
      <line x1="122" y1="92.5" x2="125" y2="94" stroke={strokeDim} strokeWidth="0.8" />

      {/* 鼻子 */}
      <path d="M 97 108 L 94 118 L 106 118" fill="none" stroke={strokeFaint} strokeWidth="0.8" strokeLinejoin="round" />
      <circle cx="94" cy="118" r="1" fill={strokeFaint} />
      <circle cx="106" cy="118" r="1" fill={strokeFaint} />

      {/* 嘴 */}
      <path
        d="M 87 127 Q 100 135 113 127"
        fill="none"
        stroke={strokeDim}
        strokeWidth="1.6"
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 3px ${stroke})` }}
      />
      <circle cx="87" cy="127" r="1.5" fill={strokeMid} />
      <circle cx="113" cy="127" r="1.5" fill={strokeMid} />

      {/* 脸颊光晕 */}
      <ellipse cx="71" cy="112" rx="11" ry="7" fill="url(#cheekL)" />
      <ellipse cx="129" cy="112" rx="11" ry="7" fill="url(#cheekR)" />

      {/* 顶部十字准星 */}
      <line x1="100" y1="18" x2="100" y2="30" stroke={strokeDim} strokeWidth="1" />
      <line x1="94" y1="24" x2="106" y2="24" stroke={strokeDim} strokeWidth="1" />

      {/* 底部标识 */}
      <line x1="86" y1="180" x2="114" y2="180" stroke={strokeFaint} strokeWidth="0.6" />
      <circle cx="100" cy="180" r="2" fill={strokeMid} />
    </svg>
  );
}

export default function CeceliaPage(): React.ReactElement {
  const [desires, setDesires] = useState<Desire[]>([]);
  const [stats, setStats] = useState<DesireStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [orbitAngle, setOrbitAngle] = useState(0);
  const [scanLine, setScanLine] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [dRes, sRes] = await Promise.all([
        fetch('/api/brain/desires?status=all&limit=20'),
        fetch('/api/brain/desires/stats'),
      ]);

      if (dRes.ok) {
        const data = await dRes.json();
        const list: Desire[] = Array.isArray(data) ? data : (data.desires || data.items || []);
        list.sort((a, b) => b.urgency - a.urgency);
        setDesires(list);
      }

      if (sRes.ok) {
        const sData = await sRes.json();
        setStats(sData);
      }

      setError(null);
    } catch (e) {
      setError('SIGNAL LOST — ' + String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setOrbitAngle(prev => (prev + 0.4) % 360);
    }, 16);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setScanLine(prev => (prev + 1.5) % 100);
    }, 30);
    return () => clearInterval(t);
  }, []);

  const pending = desires.filter(d => d.status === 'pending').length;
  const total = desires.length;
  const maxUrgency = desires.length > 0 ? Math.max(...desires.map(d => d.urgency)) : 0;

  const avatarColor = getUrgencyColor(maxUrgency);
  const statusLabel = getStatusLabel(maxUrgency);

  const timeStr = now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const dateStr = now.toLocaleDateString('en-CA');

  return (
    <div
      style={{
        position: 'fixed',
        top: '64px',       /* 顶部导航栏高度 */
        left: '256px',     /* 侧边栏宽度（展开态） */
        right: 0,
        bottom: 0,
        background: '#060a08',
        color: '#c8ffee',
        fontFamily: '"Courier New", Courier, monospace',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 5,
      }}
    >
      {/* 背景网格 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0,255,136,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,136,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* 扫描线 */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          top: `${scanLine}%`,
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(0,255,136,0.1), transparent)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* 顶部 Header */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          borderBottom: '1px solid rgba(0,255,136,0.15)',
          padding: '12px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(0,8,4,0.85)',
          backdropFilter: 'blur(8px)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: avatarColor,
              boxShadow: `0 0 8px ${avatarColor}`,
              animation: 'pulse 2s ease-in-out infinite',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: '13px',
              fontWeight: '700',
              letterSpacing: '0.45em',
              color: avatarColor,
              textShadow: `0 0 12px ${avatarColor}`,
            }}
          >
            C E C E L I A
          </span>
          <span style={{ fontSize: '10px', color: 'rgba(0,255,136,0.35)', letterSpacing: '0.1em' }}>
            DESIRE ENGINE v1.91
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#00ff88', letterSpacing: '0.08em', fontVariantNumeric: 'tabular-nums' }}>
              {timeStr}
            </div>
            <div style={{ fontSize: '9px', color: 'rgba(0,255,136,0.4)', marginTop: '1px' }}>
              {dateStr}
            </div>
          </div>

          <button
            onClick={fetchData}
            style={{
              background: 'rgba(0,255,136,0.06)',
              border: '1px solid rgba(0,255,136,0.25)',
              color: '#00ff88',
              padding: '5px 12px',
              fontSize: '10px',
              cursor: 'pointer',
              letterSpacing: '0.12em',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,255,136,0.14)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,255,136,0.06)')}
          >
            SYNC
          </button>
        </div>
      </div>

      {/* 主体：左右分栏 */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {/* 左栏：Cecelia 形象（40%） */}
        <div
          style={{
            width: '40%',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            borderRight: '1px solid rgba(0,255,136,0.12)',
            padding: '40px 24px',
            gap: '20px',
            background: 'rgba(0,5,3,0.6)',
          }}
        >
          {/* 头像区域 */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* 背景光晕 */}
            <div
              style={{
                position: 'absolute',
                width: '270px',
                height: '270px',
                borderRadius: '50%',
                background: `radial-gradient(circle, ${getUrgencyStroke(maxUrgency).replace('0.8', '0.07').replace('0.7', '0.06').replace('0.6', '0.05')} 0%, transparent 70%)`,
                animation: 'breathe 4s ease-in-out infinite',
              }}
            />
            <CeceliaAvatar maxUrgency={maxUrgency} orbitAngle={orbitAngle} />
          </div>

          {/* 名字 */}
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.7em',
              color: avatarColor,
              textShadow: `0 0 14px ${avatarColor}`,
              fontWeight: '700',
              textAlign: 'center',
            }}
          >
            C E C E L I A
          </div>

          {/* 状态 */}
          <div
            style={{
              fontSize: '10px',
              letterSpacing: '0.25em',
              color: maxUrgency >= 7 ? avatarColor : 'rgba(0,255,136,0.45)',
              animation: maxUrgency >= 9 ? 'blink 1.4s step-end infinite' : 'none',
              textAlign: 'center',
            }}
          >
            {statusLabel}
          </div>

          {/* 分隔线 */}
          <div
            style={{
              width: '80px',
              height: '1px',
              background: `linear-gradient(90deg, transparent, ${avatarColor}, transparent)`,
            }}
          />

          {/* PENDING / TOTAL */}
          <div style={{ display: 'flex', gap: '40px', textAlign: 'center' }}>
            <div>
              <div
                style={{
                  fontSize: '30px',
                  fontWeight: '900',
                  color: '#ffaa00',
                  textShadow: '0 0 10px rgba(255,170,0,0.5)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {stats ? Number(stats.pending) : pending}
              </div>
              <div style={{ fontSize: '9px', color: 'rgba(0,255,136,0.38)', letterSpacing: '0.15em', marginTop: '5px' }}>
                PENDING
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: '30px',
                  fontWeight: '900',
                  color: '#00ccff',
                  textShadow: '0 0 10px rgba(0,200,255,0.4)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {stats ? Number(stats.total) : total}
              </div>
              <div style={{ fontSize: '9px', color: 'rgba(0,255,136,0.38)', letterSpacing: '0.15em', marginTop: '5px' }}>
                TOTAL
              </div>
            </div>
          </div>

          {/* 底部系统信息 */}
          <div
            style={{
              fontSize: '9px',
              color: 'rgba(0,255,136,0.2)',
              letterSpacing: '0.1em',
              textAlign: 'center',
              lineHeight: 1.9,
              marginTop: '4px',
            }}
          >
            <div>AUTO-SYNC 30s</div>
            <div>BRAIN API :5221 PROXY</div>
            <div style={{ marginTop: '2px' }}>
              {error ? (
                <span style={{ color: 'rgba(255,68,68,0.6)' }}>OFFLINE</span>
              ) : loading ? (
                <span style={{ color: 'rgba(0,255,136,0.25)' }}>CONNECTING...</span>
              ) : (
                <span style={{ color: 'rgba(0,255,136,0.32)' }}>ONLINE</span>
              )}
            </div>
          </div>
        </div>

        {/* 右栏：意识流（60%） */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* 右栏顶部栏 */}
          <div
            style={{
              padding: '14px 24px 12px',
              borderBottom: '1px solid rgba(0,255,136,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: '10px', color: 'rgba(0,255,136,0.38)', letterSpacing: '0.22em' }}>
              DESIRE STREAM — SORTED BY URGENCY
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(0,255,136,0.45)', letterSpacing: '0.08em' }}>
              PENDING:{' '}
              <span style={{ color: '#ffaa00', fontWeight: '700' }}>
                {stats ? Number(stats.pending) : pending}
              </span>
              {'  /  '}
              TOTAL:{' '}
              <span style={{ color: '#00ccff', fontWeight: '700' }}>
                {stats ? Number(stats.total) : total}
              </span>
            </div>
          </div>

          {/* 列表滚动区 */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px 24px 24px',
            }}
          >
            {loading && (
              <div style={{ color: 'rgba(0,255,136,0.35)', fontSize: '12px', padding: '60px 0', textAlign: 'center', letterSpacing: '0.2em' }}>
                SCANNING CONSCIOUSNESS...
              </div>
            )}

            {error && (
              <div style={{
                border: '1px solid rgba(255,68,68,0.35)',
                background: 'rgba(255,68,68,0.05)',
                padding: '14px 16px',
                fontSize: '12px',
                color: '#ff6666',
                margin: '12px 0',
                letterSpacing: '0.05em',
              }}>
                {error}
              </div>
            )}

            {!loading && !error && desires.length === 0 && (
              <div style={{
                color: 'rgba(0,255,136,0.22)',
                fontSize: '12px',
                padding: '80px 0',
                textAlign: 'center',
                letterSpacing: '0.22em',
              }}>
                NO ACTIVE DESIRES DETECTED
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {desires.map((desire, idx) => (
                <DesireRow key={desire.id} desire={desire} isLast={idx === desires.length - 1} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0.15; }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.6; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,136,0.18); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(0,255,136,0.32); }
      `}</style>
    </div>
  );
}

function DesireRow({ desire, isLast }: { desire: Desire; isLast: boolean }) {
  const isExpressed = desire.status === 'expressed';
  const isWarn = desire.type === 'warn';
  const isUrgent = desire.urgency >= 9;

  const leftBarColor = isWarn
    ? (desire.urgency >= 9 ? '#ff2222' : '#ff7700')
    : (desire.type === 'inform' ? '#00aaff' : (TYPE_COLOR[desire.type] || '#00ff88'));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        opacity: isExpressed ? 0.4 : 1,
        animation: 'fadeIn 0.25s ease-out',
        borderBottom: isLast ? 'none' : '1px solid rgba(0,255,136,0.07)',
        padding: '12px 0',
      }}
    >
      {/* 左侧竖线 */}
      <div
        style={{
          width: '3px',
          alignSelf: 'stretch',
          minHeight: '40px',
          background: leftBarColor,
          flexShrink: 0,
          marginRight: '16px',
          borderRadius: '2px',
          opacity: isExpressed ? 0.55 : 1,
          boxShadow: isUrgent ? `0 0 6px ${leftBarColor}` : 'none',
        }}
      />

      {/* Urgency 数字 */}
      <div
        style={{
          minWidth: '34px',
          textAlign: 'center',
          flexShrink: 0,
          marginRight: '14px',
        }}
      >
        <div
          style={{
            fontSize: '22px',
            fontWeight: '900',
            color: getUrgencyColor(desire.urgency),
            textShadow: `0 0 8px ${getUrgencyColor(desire.urgency)}88`,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {desire.urgency}
        </div>
        <div style={{ fontSize: '7px', color: 'rgba(0,255,136,0.22)', letterSpacing: '0.1em', marginTop: '2px' }}>
          URG
        </div>
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
          <span
            style={{
              background: `${TYPE_COLOR[desire.type] || '#00ff88'}14`,
              border: `1px solid ${TYPE_COLOR[desire.type] || '#00ff88'}44`,
              color: TYPE_COLOR[desire.type] || '#00ff88',
              fontSize: '9px',
              padding: '1px 6px',
              letterSpacing: '0.15em',
              fontWeight: 'bold',
              flexShrink: 0,
            }}
          >
            {TYPE_LABEL[desire.type] || desire.type.toUpperCase()}
          </span>
          {isExpressed && (
            <span style={{ fontSize: '8px', color: 'rgba(0,255,136,0.22)', letterSpacing: '0.12em' }}>
              EXPRESSED
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: '12px',
            color: isExpressed ? 'rgba(200,255,238,0.42)' : 'rgba(200,255,238,0.82)',
            lineHeight: 1.5,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            wordBreak: 'break-word',
          }}
        >
          {desire.content}
        </div>
      </div>

      {/* 时间戳 */}
      <div
        style={{
          fontSize: '9px',
          color: 'rgba(0,255,136,0.25)',
          flexShrink: 0,
          marginLeft: '12px',
          textAlign: 'right',
          letterSpacing: '0.04em',
          paddingTop: '2px',
          whiteSpace: 'nowrap',
        }}
      >
        {timeAgo(desire.created_at)}
      </div>
    </div>
  );
}
