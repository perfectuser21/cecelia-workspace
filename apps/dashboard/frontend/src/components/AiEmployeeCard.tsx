import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';
import type { AiEmployeeWithStats, EmployeeTask } from '../api/ai-employees.api';

interface AiEmployeeCardProps {
  employee: AiEmployeeWithStats;
  onViewTasks?: (employeeId: string) => void;
}

export function AiEmployeeCard({ employee, onViewTasks }: AiEmployeeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { stats } = employee;

  const getStatusColor = () => {
    if (stats.todayRunning > 0) return 'border-blue-400';
    if (stats.todayError > 0 && stats.todaySuccess === 0) return 'border-red-400';
    if (stats.todayTotal > 0) return 'border-green-400';
    return 'border-slate-200 dark:border-slate-700';
  };

  const getStatusBadge = () => {
    if (stats.todayRunning > 0) {
      return (
        <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full">
          <Loader2 className="w-3 h-3 animate-spin" />
          工作中
        </span>
      );
    }
    if (stats.todayTotal === 0) {
      return (
        <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full">
          空闲
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-full">
        <CheckCircle className="w-3 h-3" />
        今日 {stats.todayTotal} 次
      </span>
    );
  };

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-2xl border-2 ${getStatusColor()} shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden`}
    >
      {/* 主卡片区域 */}
      <div
        className="p-5 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* 头像 */}
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-2xl shadow-inner">
              {employee.avatar}
            </div>
            {/* 名称和角色 */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                {employee.name}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {employee.role}
              </p>
            </div>
          </div>
          {/* 状态徽章 */}
          {getStatusBadge()}
        </div>

        {/* 统计数据 */}
        {stats.todayTotal > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {stats.todaySuccess}
              </div>
              <div className="text-xs text-green-600/70 dark:text-green-400/70">成功</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
              <div className="text-lg font-bold text-red-600 dark:text-red-400">
                {stats.todayError}
              </div>
              <div className="text-xs text-red-600/70 dark:text-red-400/70">失败</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {stats.successRate}%
              </div>
              <div className="text-xs text-blue-600/70 dark:text-blue-400/70">成功率</div>
            </div>
          </div>
        )}

        {/* 展开/收起指示器 */}
        <div className="flex items-center justify-center text-slate-400 dark:text-slate-500 pt-1">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
      </div>

      {/* 展开详情区域 */}
      {isExpanded && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-4 bg-slate-50 dark:bg-slate-800/50">
          {/* 职能列表 */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              职能范围
            </h4>
            <div className="flex flex-wrap gap-2">
              {employee.abilities.map(ability => (
                <span
                  key={ability.id}
                  className="text-xs px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300"
                  title={ability.description}
                >
                  {ability.name}
                </span>
              ))}
            </div>
          </div>

          {/* 最近任务 */}
          {stats.recentTasks.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                最近任务
              </h4>
              <div className="space-y-2">
                {stats.recentTasks.map(task => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}

          {stats.recentTasks.length === 0 && (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-2">
              今日暂无任务记录
            </p>
          )}

          {/* 查看全部按钮 */}
          {onViewTasks && stats.todayTotal > 5 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewTasks(employee.id);
              }}
              className="w-full mt-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            >
              查看全部 {stats.todayTotal} 条记录
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// 任务项组件
function TaskItem({ task }: { task: EmployeeTask }) {
  const getStatusIcon = () => {
    switch (task.status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
      case 'waiting':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-700 rounded-lg">
      {getStatusIcon()}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
          {task.workflowName || task.abilityName}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {task.abilityName} · {formatTime(task.startedAt)}
        </p>
      </div>
    </div>
  );
}
