import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'brain',
  name: 'Brain',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  navGroups: [
    { id: 'brain', label: '系统监控', icon: 'Brain', order: 10 },
  ],

  routes: [
    {
      path: '/cecelia',
      component: 'CeceliaOverview',
      navItem: { label: 'Cecelia 总览', icon: 'Brain', group: 'brain', order: 1 },
    },
  ],

  components: {
    CeceliaOverview: () => import('../execution/pages/CeceliaOverview'),
  },
};

export default manifest;
