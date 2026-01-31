import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'content',
  name: 'Content Studio',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  navGroups: [
    { id: 'content', label: 'Content Studio', icon: 'PenTool', order: 4 },
  ],

  routes: [
    {
      path: '/content',
      component: 'ContentStudio',
      navItem: { label: 'Content Studio', icon: 'PenTool', group: 'content', order: 1 },
    },
  ],

  components: {
    ContentStudio: () => import('./pages/ContentStudio'),
  },
};

export default manifest;
