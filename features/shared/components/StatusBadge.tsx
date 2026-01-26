/**
 * Shared status badge component
 */
import { getStatusBgColor, getStatusLabel } from '../utils/statusHelpers';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const bgColorClass = getStatusBgColor(status);
  const label = getStatusLabel(status);

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColorClass} ${className}`}
    >
      {label}
    </span>
  );
}
