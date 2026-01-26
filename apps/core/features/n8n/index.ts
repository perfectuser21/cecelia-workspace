import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'n8n',
  name: 'N8n Workflows',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  routes: [
    { path: '/n8n/workflows', component: 'N8nWorkflows' },
    { path: '/n8n/workflows/:instance/:id', component: 'N8nWorkflowDetail' },
    { path: '/n8n/live-status', component: 'N8nLiveStatus' },
    { path: '/n8n/live-status/:instance/:executionId', component: 'N8nLiveStatusDetail' },
  ],

  components: {
    N8nWorkflows: () => import('./pages/N8nWorkflows'),
    N8nWorkflowDetail: () => import('./pages/N8nWorkflowDetail'),
    N8nLiveStatus: () => import('./pages/N8nLiveStatus'),
    N8nLiveStatusDetail: () => import('./pages/N8nLiveStatusDetail'),
  },
};

export default manifest;
