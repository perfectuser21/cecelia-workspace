import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'projects',
  name: 'Projects Dashboard',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  routes: [
    {
      path: '/projects',
      component: 'ProjectsDashboard',
      navItem: {
        label: 'Projects',
        icon: 'FolderKanban',
        group: 'ops',
        order: 17,
      },
    },
    {
      path: '/projects/:projectId',
      component: 'ProjectDetail',
    },
  ],

  components: {
    ProjectsDashboard: () => import('./pages/ProjectsDashboard'),
    ProjectDetail: () => import('./pages/ProjectDetail'),
  },
};

export default manifest;
