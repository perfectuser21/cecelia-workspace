import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'tasks',
  name: 'Notion Tasks',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  routes: [
    { path: '/tasks', component: 'Tasks' },
  ],

  components: {
    Tasks: () => import('./pages/Tasks'),
  },
};

export default manifest;
