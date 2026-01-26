import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'claude-monitor',
  name: 'Claude Monitor',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  routes: [
    { path: '/claude-monitor', component: 'ClaudeMonitor' },
    { path: '/claude-stats', component: 'ClaudeStats' },
  ],

  components: {
    ClaudeMonitor: () => import('./pages/ClaudeMonitor'),
    ClaudeStats: () => import('./pages/ClaudeStats'),
  },
};

export default manifest;
