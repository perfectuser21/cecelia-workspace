import { Monitor, Circle } from 'lucide-react';
import type { SeatsData } from '../hooks/useSSE';

interface Props {
  seats: SeatsData | null;
}

export default function SeatsPanel({ seats }: Props) {
  if (!seats) {
    return (
      <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(255,255,255,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Monitor size={16} />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>Seats</span>
        </div>
        <div style={{ fontSize: '13px', color: '#64748b' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(255,255,255,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Monitor size={16} />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>Seats</span>
        </div>
        <span style={{ fontSize: '12px', color: '#64748b' }}>{seats.active}/{seats.total} active</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(seats.total, 4)}, 1fr)`, gap: '8px' }}>
        {Array.from({ length: seats.total }, (_, i) => {
          const slot = seats.slots.find(s => s.slot === i + 1);
          const isActive = !!slot;
          return (
            <div
              key={i}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: `1px solid ${isActive ? 'rgba(34,197,94,0.3)' : 'rgba(148,163,184,0.15)'}`,
                background: isActive ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Circle size={8} fill={isActive ? '#22c55e' : '#475569'} color={isActive ? '#22c55e' : '#475569'} />
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Slot {i + 1}</span>
              </div>
              {isActive && slot && (
                <>
                  <div style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {slot.title || slot.mode}
                  </div>
                  {slot.duration && (
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{slot.duration}</div>
                  )}
                </>
              )}
              {!isActive && (
                <div style={{ fontSize: '11px', color: '#475569' }}>Idle</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
