import { useState, useEffect } from 'react';
import { Users, RefreshCw, Building2 } from 'lucide-react';
import { AiEmployeeCard } from '../components/AiEmployeeCard';
import {
  fetchAiEmployeesWithStats,
  DepartmentWithStats,
} from '../api/ai-employees.api';

export default function AiEmployeesPage() {
  const [departments, setDepartments] = useState<DepartmentWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAiEmployeesWithStats();
      setDepartments(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError('加载数据失败，请稍后重试');
      console.error('Failed to load AI employees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // 每 30 秒自动刷新
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalEmployees = departments.reduce(
    (sum, dept) => sum + dept.employees.length,
    0
  );
  const totalTasks = departments.reduce(
    (sum, dept) => sum + dept.todayTotal,
    0
  );

  return (
    <div className="px-4 sm:px-0 pb-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-800 dark:text-white mb-2 flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-500" />
              AI 员工
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              公司自动化团队 · {totalEmployees} 名员工 · 今日 {totalTasks} 次任务
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        {/* 最后刷新时间 */}
        {lastRefresh && (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            最后更新: {lastRefresh.toLocaleTimeString('zh-CN')}
          </p>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* 加载状态 */}
      {loading && departments.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-slate-500 dark:text-slate-400">加载中...</p>
          </div>
        </div>
      )}

      {/* 部门列表 */}
      {!loading || departments.length > 0 ? (
        <div className="space-y-8">
          {departments.map(dept => (
            <DepartmentSection key={dept.id} department={dept} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// 部门区块组件
function DepartmentSection({ department }: { department: DepartmentWithStats }) {
  // 空部门不显示
  if (department.employees.length === 0) {
    return (
      <div className="opacity-50">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{department.icon}</span>
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              {department.name}
            </h2>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {department.description || '暂无员工'}
            </p>
          </div>
        </div>
        <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center">
          <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 dark:text-slate-500">部门待招聘</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 部门标题 */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{department.icon}</span>
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            {department.name}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {department.description}
            {department.todayTotal > 0 && (
              <span className="ml-2 text-blue-600 dark:text-blue-400">
                · 今日 {department.todayTotal} 次任务
              </span>
            )}
          </p>
        </div>
      </div>

      {/* 员工卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {department.employees.map(employee => (
          <AiEmployeeCard key={employee.id} employee={employee} />
        ))}
      </div>
    </div>
  );
}
