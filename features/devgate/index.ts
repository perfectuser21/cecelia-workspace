// DevGate feature - 开发质量门禁 metrics 展示

import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'devgate',
  name: 'DevGate',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  routes: [
    { path: '/devgate', component: 'DevGateMetrics' },
  ],

  components: {
    DevGateMetrics: () => import('./pages/DevGateMetrics'),
  },
};

export default manifest;
