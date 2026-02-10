import { CheckCircle2, Clock, AlertCircle, FileText, Link2, Layers } from 'lucide-react';
import type { PRPlan } from '../api/pr-plans.api';

interface PRPlanCardProps {
  prPlan: PRPlan;
  isBlocked: boolean;
  dependencyTitles?: string[];  // Titles of dependent PR Plans
  onClick?: () => void;
}

export default function PRPlanCard({ prPlan, isBlocked, dependencyTitles, onClick }: PRPlanCardProps) {
  const getStatusIcon = () => {
    if (isBlocked) {
      return <AlertCircle className="w-5 h-5 text-amber-500" />;
    }

    switch (prPlan.status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'planning':
        return <FileText className="w-5 h-5 text-slate-400" />;
      case 'cancelled':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <FileText className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusText = () => {
    if (isBlocked) return 'Blocked';
    return prPlan.status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getComplexityColor = () => {
    switch (prPlan.complexity) {
      case 'small':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'large':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300';
    }
  };

  const tasksProgress = prPlan.tasks_count
    ? `${prPlan.tasks_completed || 0}/${prPlan.tasks_count}`
    : '0/0';

  return (
    <div
      className={`
        rounded-lg border p-4 transition-all
        ${isBlocked
          ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 opacity-60'
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
        }
        ${onClick ? 'cursor-pointer hover:shadow-md' : ''}
      `}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          {getStatusIcon()}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                #{prPlan.sequence}
              </span>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {prPlan.title}
              </h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full ${getComplexityColor()}`}>
                {prPlan.complexity}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                isBlocked
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
                  : prPlan.status === 'completed'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
                  : prPlan.status === 'in_progress'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                  : 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300'
              }`}>
                {getStatusText()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dependencies */}
      {dependencyTitles && dependencyTitles.length > 0 && (
        <div className="mb-3 flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
          <Link2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-medium">Depends on:</span>{' '}
            <span>{dependencyTitles.join(', ')}</span>
          </div>
        </div>
      )}

      {/* Tasks Progress */}
      {prPlan.tasks_count !== undefined && prPlan.tasks_count > 0 && (
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Layers className="w-4 h-4" />
          <span>Tasks: {tasksProgress}</span>
          {prPlan.tasks_count > 0 && (
            <div className="flex-1 max-w-[100px]">
              <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{
                    width: `${((prPlan.tasks_completed || 0) / prPlan.tasks_count) * 100}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* DoD Preview */}
      {prPlan.dod && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
            {prPlan.dod}
          </p>
        </div>
      )}
    </div>
  );
}
