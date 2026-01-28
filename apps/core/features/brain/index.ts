import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'brain',
  name: 'Brain Dashboard',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  routes: [
    {
      path: '/brain',
      component: 'BrainDashboard',
      navItem: {
        label: 'Brain',
        icon: 'Brain',
        group: 'ops',
        order: 15,
      },
    },
  ],

  components: {
    BrainDashboard: () => import('./pages/BrainDashboard'),
  },
};

export default manifest;
