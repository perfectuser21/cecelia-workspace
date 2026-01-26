import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'engine',
  name: 'Engine',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  routes: [
    { path: '/engine', component: 'EngineDashboard' },
    { path: '/engine/capabilities', component: 'EngineCapabilities' },
    { path: '/engine/dev-tasks', component: 'DevTasks' },
    { path: '/engine/task-monitor', component: 'TaskMonitor' },
    { path: '/engine/session-monitor', component: 'SessionMonitor' },
  ],

  components: {
    EngineDashboard: () => import('./pages/EngineDashboard'),
    EngineCapabilities: () => import('./pages/EngineCapabilities'),
    DevTasks: () => import('./pages/DevTasks'),
    TaskMonitor: () => import('./pages/TaskMonitor'),
    SessionMonitor: () => import('./pages/SessionMonitor'),
  },
};

export default manifest;
