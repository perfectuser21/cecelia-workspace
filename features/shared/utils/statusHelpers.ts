/**
 * Status helpers for consistent status display across features
 */

export type Status =
  | 'pending'
  | 'in_progress'
  | 'running'
  | 'completed'
  | 'success'
  | 'failed'
  | 'error'
  | 'cancelled'
  | 'waiting';

/**
 * Get Tailwind CSS color class for status
 */
export function getStatusColor(status: string): string {
  const normalizedStatus = status.toLowerCase();

  switch (normalizedStatus) {
    case 'completed':
    case 'success':
      return 'text-green-500';
    case 'in_progress':
    case 'running':
      return 'text-blue-500';
    case 'pending':
    case 'waiting':
      return 'text-yellow-500';
    case 'failed':
    case 'error':
      return 'text-red-500';
    case 'cancelled':
      return 'text-gray-500';
    default:
      return 'text-gray-400';
  }
}

/**
 * Get human-readable label for status
 */
export function getStatusLabel(status: string): string {
  const normalizedStatus = status.toLowerCase();

  const labels: Record<string, string> = {
    pending: '待处理',
    in_progress: '进行中',
    running: '运行中',
    completed: '已完成',
    success: '成功',
    failed: '失败',
    error: '错误',
    cancelled: '已取消',
    waiting: '等待中',
  };

  return labels[normalizedStatus] || status;
}

/**
 * Get Lucide icon name for status
 */
export function getStatusIcon(status: string): string {
  const normalizedStatus = status.toLowerCase();

  switch (normalizedStatus) {
    case 'completed':
    case 'success':
      return 'CheckCircle';
    case 'in_progress':
    case 'running':
      return 'Loader';
    case 'pending':
    case 'waiting':
      return 'Clock';
    case 'failed':
    case 'error':
      return 'XCircle';
    case 'cancelled':
      return 'Ban';
    default:
      return 'Circle';
  }
}

/**
 * Get background color class for status badge
 */
export function getStatusBgColor(status: string): string {
  const normalizedStatus = status.toLowerCase();

  switch (normalizedStatus) {
    case 'completed':
    case 'success':
      return 'bg-green-100 text-green-800';
    case 'in_progress':
    case 'running':
      return 'bg-blue-100 text-blue-800';
    case 'pending':
    case 'waiting':
      return 'bg-yellow-100 text-yellow-800';
    case 'failed':
    case 'error':
      return 'bg-red-100 text-red-800';
    case 'cancelled':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}
