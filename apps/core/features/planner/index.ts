import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'planner',
  name: 'Task Intelligence',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  routes: [
    { path: '/ops/planner', component: 'PlannerOverview' },
    { path: '/ops/planning', component: 'PlanningDashboard' },
    { path: '/ops/scheduler', component: 'Scheduler' },
  ],

  components: {
    PlannerOverview: () => import('./pages/PlannerOverview'),
    PlanningDashboard: () => import('./pages/PlanningDashboard'),
    Scheduler: () => import('./pages/Scheduler'),
  },
};

export default manifest;
