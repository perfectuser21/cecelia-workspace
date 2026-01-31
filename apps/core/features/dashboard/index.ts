import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'dashboard',
  name: 'Dashboard',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  navGroups: [
    { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', order: 1 },
  ],

  routes: [
    {
      path: '/dashboard',
      component: 'DashboardHome',
      navItem: { label: 'Dashboard', icon: 'LayoutDashboard', group: 'dashboard', order: 1 },
    },
    {
      path: '/features',
      component: 'FeatureDashboard',
      navItem: { label: 'Features', icon: 'Layers', group: 'dashboard', order: 2 },
    },
    // Default route
    { path: '/', redirect: '/dashboard' },
  ],

  components: {
    DashboardHome: () => import('./pages/DashboardHome'),
    FeatureDashboard: () => import('../shared/pages/FeatureDashboard'),
  },
};

export default manifest;
