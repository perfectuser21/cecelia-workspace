/**
 * AI 员工 API - 聚合 n8n 数据，按员工视角展示
 *
 * 复用 zenithjoy-core 的 n8n API，按员工聚合数据
 */

import {
  AI_DEPARTMENTS,
  AiEmployee,
  AiAbility,
  Department,
  matchAbilityByWorkflow,
} from '../config/ai-employees.config';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============ 类型定义 ============

// n8n 执行记录（简化版）
interface N8nExecution {
  id: string;
  workflowId: string;
  workflowName?: string;
  status: 'success' | 'error' | 'waiting' | 'running' | 'crashed';
  startedAt: string;
  stoppedAt?: string;
}

// 今日统计
interface TodayStats {
  running: number;
  success: number;
  error: number;
  total: number;
}

// Live Status Overview（从 n8n-live-status API）
interface LiveStatusOverview {
  todayStats: TodayStats;
  runningExecutions: Array<{
    id: string;
    workflowId: string;
    workflowName: string;
    startedAt: string;
    duration: number;
  }>;
  recentCompleted: N8nExecution[];
  timestamp: number;
}

// 员工任务统计
export interface EmployeeTaskStats {
  todayTotal: number;
  todaySuccess: number;
  todayError: number;
  todayRunning: number;
  successRate: number;
  recentTasks: EmployeeTask[];
}

// 员工任务
export interface EmployeeTask {
  id: string;
  workflowId: string;
  workflowName: string;
  abilityId: string;
  abilityName: string;
  status: 'success' | 'error' | 'running' | 'waiting';
  startedAt: string;
  stoppedAt?: string;
}

// 带统计的员工
export interface AiEmployeeWithStats extends AiEmployee {
  stats: EmployeeTaskStats;
}

// 带统计的部门
export interface DepartmentWithStats extends Department {
  employees: AiEmployeeWithStats[];
  todayTotal: number;
}

// ============ API 函数 ============

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

/**
 * 获取 n8n live status 概览
 */
async function fetchLiveStatus(instance: 'cloud' | 'local' = 'local'): Promise<LiveStatusOverview> {
  return fetchApi(`/api/v1/n8n-live-status/instances/${instance}/overview`);
}

/**
 * 将 n8n 执行记录映射到员工任务
 */
function mapExecutionToTask(execution: N8nExecution): EmployeeTask | null {
  const workflowName = execution.workflowName || '';
  const match = matchAbilityByWorkflow(workflowName);

  if (!match) return null;

  return {
    id: execution.id,
    workflowId: execution.workflowId,
    workflowName,
    abilityId: match.ability.id,
    abilityName: match.ability.name,
    status: execution.status === 'crashed' ? 'error' : execution.status,
    startedAt: execution.startedAt,
    stoppedAt: execution.stoppedAt,
  };
}

/**
 * 聚合员工统计数据
 */
function aggregateEmployeeStats(
  employee: AiEmployee,
  executions: N8nExecution[]
): EmployeeTaskStats {
  const tasks: EmployeeTask[] = [];
  let success = 0;
  let error = 0;
  let running = 0;

  for (const execution of executions) {
    const task = mapExecutionToTask(execution);
    if (task) {
      // 检查是否属于这个员工的职能
      const isThisEmployee = employee.abilities.some(a => a.id === task.abilityId);
      if (isThisEmployee) {
        tasks.push(task);
        if (task.status === 'success') success++;
        else if (task.status === 'error') error++;
        else if (task.status === 'running' || task.status === 'waiting') running++;
      }
    }
  }

  const total = tasks.length;
  const successRate = total > 0 ? Math.round((success / total) * 100) : 0;

  return {
    todayTotal: total,
    todaySuccess: success,
    todayError: error,
    todayRunning: running,
    successRate,
    recentTasks: tasks.slice(0, 5),
  };
}

/**
 * 获取所有员工的任务统计（带缓存）
 */
export async function fetchAiEmployeesWithStats(): Promise<DepartmentWithStats[]> {
  try {
    // 获取 n8n 数据
    const liveStatus = await fetchLiveStatus('local');

    // 合并所有执行记录
    const allExecutions: N8nExecution[] = [
      ...liveStatus.runningExecutions.map(r => ({
        id: r.id,
        workflowId: r.workflowId,
        workflowName: r.workflowName,
        status: 'running' as const,
        startedAt: r.startedAt,
      })),
      ...liveStatus.recentCompleted,
    ];

    // 按部门和员工聚合
    const departmentsWithStats: DepartmentWithStats[] = AI_DEPARTMENTS.map(dept => {
      const employeesWithStats: AiEmployeeWithStats[] = dept.employees.map(emp => ({
        ...emp,
        stats: aggregateEmployeeStats(emp, allExecutions),
      }));

      const todayTotal = employeesWithStats.reduce(
        (sum, emp) => sum + emp.stats.todayTotal,
        0
      );

      return {
        ...dept,
        employees: employeesWithStats,
        todayTotal,
      };
    });

    return departmentsWithStats;
  } catch (error) {
    console.error('Failed to fetch AI employees stats:', error);
    // 返回空统计
    return AI_DEPARTMENTS.map(dept => ({
      ...dept,
      employees: dept.employees.map(emp => ({
        ...emp,
        stats: {
          todayTotal: 0,
          todaySuccess: 0,
          todayError: 0,
          todayRunning: 0,
          successRate: 0,
          recentTasks: [],
        },
      })),
      todayTotal: 0,
    }));
  }
}

/**
 * 获取单个员工的详细任务列表
 */
export async function fetchEmployeeTasks(employeeId: string): Promise<EmployeeTask[]> {
  try {
    const liveStatus = await fetchLiveStatus('local');

    const allExecutions: N8nExecution[] = [
      ...liveStatus.runningExecutions.map(r => ({
        id: r.id,
        workflowId: r.workflowId,
        workflowName: r.workflowName,
        status: 'running' as const,
        startedAt: r.startedAt,
      })),
      ...liveStatus.recentCompleted,
    ];

    const employee = AI_DEPARTMENTS.flatMap(d => d.employees).find(
      e => e.id === employeeId
    );
    if (!employee) return [];

    const tasks: EmployeeTask[] = [];
    for (const execution of allExecutions) {
      const task = mapExecutionToTask(execution);
      if (task && employee.abilities.some(a => a.id === task.abilityId)) {
        tasks.push(task);
      }
    }

    return tasks;
  } catch (error) {
    console.error('Failed to fetch employee tasks:', error);
    return [];
  }
}

// ============ 导出 ============

export const aiEmployeesApi = {
  fetchAiEmployeesWithStats,
  fetchEmployeeTasks,
};
