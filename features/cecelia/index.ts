import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'cecelia',
  name: 'Cecelia',
  version: '2.0.0',
  source: 'core',
  instances: ['core'],

  routes: [
    { path: '/cecelia', component: 'CeceliaOverview' },
    { path: '/cecelia/console', component: 'CeceliaConsole' },
    { path: '/cecelia/project/:name', component: 'ProjectDetail' },
    { path: '/cecelia/agents/:agentId', component: 'AgentDetail' },
    { path: '/cecelia/runs', component: 'CeceliaRuns' },
    { path: '/cecelia/runs/:runId', component: 'RunDetail' },
  ],

  components: {
    CeceliaOverview: () => import('./pages/CeceliaOverview'),
    CeceliaConsole: () => import('./pages/CeceliaConsole'),
    ProjectDetail: () => import('./pages/ProjectDetail'),
    AgentDetail: () => import('./pages/AgentDetail'),
    CeceliaRuns: () => import('./pages/CeceliaRuns'),
    RunDetail: () => import('./pages/RunDetail'),
  },
};

export default manifest;
