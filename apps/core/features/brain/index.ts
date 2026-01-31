import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'brain',
  name: 'Super Brain',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  navGroups: [
    { id: 'brain', label: 'Super Brain', icon: 'Brain', order: 6 },
  ],

  routes: [
    {
      path: '/super-brain',
      component: 'SuperBrain',
      navItem: { label: 'Super Brain', icon: 'BookOpen', group: 'brain', order: 1 },
    },
  ],

  components: {
    SuperBrain: () => import('./pages/SuperBrain'),
  },
};

export default manifest;
