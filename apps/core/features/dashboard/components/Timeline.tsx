import { Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { OverviewData } from '../hooks/useSSE';

interface Props {
  overview: OverviewData | null;
}

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  running: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  completed: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  failed: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  pending: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'running': return <Loader2 size={14} className="animate-spin" color="#3b82f6" />;
    case 'completed': return <CheckCircle2 size={14} color="#22c55e" />;
    case 'failed': return <XCircle size={14} color="#ef4444" />;
    default: return <Clock size={14} color="#94a3b8" />;
  }
}

export default function Timeline({ overview }: Props) {
  if (!overview) {
    return (
      <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(255,255,255,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Clock size={16} />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>Timeline</span>
        </div>
        <div style={{ fontSize: '13px', color: '#64748b' }}>Loading...</div>
      </div>
    );
  }

  const runs = overview.recent_runs || [];

  return (
    <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(255,255,255,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={16} />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>Timeline</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#64748b' }}>
          <span>{overview.running} running</span>
          <span>{overview.completed} done</span>
          <span>{overview.failed} failed</span>
        </div>
      </div>

      {runs.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#475569', textAlign: 'center', padding: '20px 0' }}>No recent runs</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {runs.slice(0, 8).map(run => {
            const style = STATUS_STYLES[run.status] || STATUS_STYLES.pending;
            const progress = run.total_checkpoints > 0
              ? Math.round((run.completed_checkpoints / run.total_checkpoints) * 100)
              : 0;
            return (
              <div key={run.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: style.bg }}>
                <StatusIcon status={run.status} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {run.prd_title || run.feature_branch}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{run.project}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <div style={{ width: '48px', height: '4px', borderRadius: '2px', background: 'rgba(148,163,184,0.2)', overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', borderRadius: '2px', background: style.color, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b', minWidth: '28px', textAlign: 'right' }}>{progress}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
