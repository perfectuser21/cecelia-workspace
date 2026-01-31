import { Link2, CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import type { OverviewData, TaskStep } from '../hooks/useSSE';

interface Props {
  overview: OverviewData | null;
}

const STEP_NAMES = ['PRD', 'Detect', 'Branch', 'DoD', 'Code', 'Test', 'Quality', 'PR', 'CI', 'Learning', 'Cleanup'];

function StepIcon({ status }: { status: string }) {
  switch (status) {
    case 'done': return <CheckCircle2 size={12} color="#22c55e" />;
    case 'in_progress': return <Loader2 size={12} className="animate-spin" color="#3b82f6" />;
    case 'failed': return <XCircle size={12} color="#ef4444" />;
    default: return <Circle size={12} color="#475569" />;
  }
}

export default function TaskChain({ overview }: Props) {
  if (!overview) {
    return (
      <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(255,255,255,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Link2 size={16} />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>Task Chain</span>
        </div>
        <div style={{ fontSize: '13px', color: '#64748b' }}>Loading...</div>
      </div>
    );
  }

  const activeRuns = (overview.recent_runs || []).filter(r => r.status === 'running');

  if (activeRuns.length === 0) {
    return (
      <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(255,255,255,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Link2 size={16} />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>Task Chain</span>
        </div>
        <div style={{ fontSize: '13px', color: '#475569', textAlign: 'center', padding: '20px 0' }}>No active tasks</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(255,255,255,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Link2 size={16} />
        <span style={{ fontSize: '14px', fontWeight: 500 }}>Task Chain</span>
        <span style={{ fontSize: '11px', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
          {activeRuns.length} active
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {activeRuns.slice(0, 3).map(run => {
          const steps: TaskStep[] = run.steps || STEP_NAMES.map((name, i) => ({
            id: i + 1,
            name,
            status: run.current_step
              ? i + 1 < run.current_step ? 'done'
                : i + 1 === run.current_step ? 'in_progress'
                : 'pending'
              : 'pending',
          }));

          return (
            <div key={run.id} style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.2)', background: 'rgba(59,130,246,0.03)' }}>
              <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {run.prd_title || run.feature_branch}
              </div>
              {run.current_action && (
                <div style={{ fontSize: '11px', color: '#3b82f6', marginBottom: '8px' }}>{run.current_action}</div>
              )}
              <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                {steps.map((step, i) => (
                  <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
                    <div
                      title={`${step.name}: ${step.status}`}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <StepIcon status={step.status} />
                    </div>
                    {i < steps.length - 1 && (
                      <div style={{
                        width: '8px',
                        height: '1px',
                        background: step.status === 'done' ? '#22c55e' : 'rgba(148,163,184,0.3)',
                      }} />
                    )}
                  </div>
                ))}
              </div>
              {run.pr_url && (
                <div style={{ fontSize: '11px', marginTop: '6px' }}>
                  <a href={run.pr_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>
                    View PR
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
