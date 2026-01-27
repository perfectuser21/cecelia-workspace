import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'vps-monitor',
  name: 'VPS Monitor',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  routes: [
    { path: '/vps-monitor', component: 'VpsMonitor' },
  ],

  components: {
    VpsMonitor: () => import('./pages/VpsMonitor'),
  },
};

export default manifest;
