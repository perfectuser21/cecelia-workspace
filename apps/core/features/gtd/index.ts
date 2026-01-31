import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'gtd',
  name: 'GTD',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  navGroups: [
    { id: 'gtd', label: 'GTD', icon: 'CheckSquare', order: 3 },
  ],

  routes: [
    {
      path: '/tasks',
      component: 'TasksPage',
      navItem: { label: 'Tasks', icon: 'ListTodo', group: 'gtd', order: 1 },
    },
    {
      path: '/projects',
      component: 'ProjectsDashboard',
      navItem: { label: 'Projects', icon: 'FolderKanban', group: 'gtd', order: 2 },
    },
    { path: '/projects/:projectId', component: 'ProjectDetail' },
    {
      path: '/okr',
      component: 'OKRPage',
      navItem: { label: 'OKR', icon: 'Target', group: 'gtd', order: 3 },
    },
    {
      path: '/roadmap',
      component: 'RoadmapView',
      navItem: { label: 'Roadmap', icon: 'Map', group: 'gtd', order: 4 },
    },
  ],

  components: {
    TasksPage: () => import('../planning/pages/Tasks'),
    ProjectsDashboard: () => import('../planning/pages/ProjectsDashboard'),
    ProjectDetail: () => import('../planning/pages/ProjectDetail'),
    OKRPage: () => import('../planning/pages/OKRPage'),
    RoadmapView: () => import('../planning/pages/RoadmapView'),
  },
};

export default manifest;
