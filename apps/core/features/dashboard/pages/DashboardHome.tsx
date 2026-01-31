import { useState, useEffect } from 'react';
import { LayoutDashboard, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useSSE } from '../hooks/useSSE';
import SeatsPanel from '../components/SeatsPanel';
import Timeline from '../components/Timeline';
import TaskChain from '../components/TaskChain';

interface Area {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  notion_page_id: string | null;
}

export default function DashboardHome() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const sse = useSSE();

  useEffect(() => {
    fetch('/api/areas')
      .then(res => res.json())
      .then(data => {
        setAreas(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <LayoutDashboard size={24} />
        <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>Dashboard</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {sse.connected ? (
            <Wifi size={14} color="#22c55e" />
          ) : (
            <WifiOff size={14} color="#ef4444" />
          )}
          <span style={{ fontSize: '11px', color: sse.connected ? '#22c55e' : '#ef4444' }}>
            {sse.connected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Real-time panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <SeatsPanel seats={sse.seats} />
        <TaskChain overview={sse.overview} />
      </div>
      <div style={{ marginBottom: '24px' }}>
        <Timeline overview={sse.overview} />
      </div>

      {/* Areas section */}
      <h2 style={{ fontSize: '16px', fontWeight: 500, color: '#64748b', marginBottom: '16px' }}>Areas (PARA)</h2>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '16px',
        }}>
          {areas.map(area => (
            <div
              key={area.id}
              style={{
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                background: 'rgba(255, 255, 255, 0.03)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(148, 163, 184, 0.4)';
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(255, 255, 255, 0.06)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(148, 163, 184, 0.2)';
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(255, 255, 255, 0.03)';
              }}
            >
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>{area.icon}</div>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>{area.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
