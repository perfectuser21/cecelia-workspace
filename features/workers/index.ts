// Workers feature - 统一 AI 员工系统

import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'workers',
  name: 'AI 员工',
  version: '1.0.0',
  source: 'core',
  instances: ['core', 'autopilot'],

  routes: [
    { path: '/workers', component: 'WorkersOverview' },
  ],

  components: {
    WorkersOverview: () => import('./pages/WorkersOverview'),
  },
};

export default manifest;

// 导出类型
export * from './types';

// 导出配置函数
export {
  getDepartments,
  getAllWorkers,
  getWorkerById,
  getWorkerKeywords,
  matchWorkerByWorkflowName,
  getConfigVersion,
  getStats,
} from './config';

// 导出服务函数
export {
  getWorkersData,
  getWorkerDetail,
  getWorkerWorkflows,
  findWorkerByWorkflowName,
} from './service';

// 导出 API 客户端
export { workersApi } from './api/workers.api';
