/**
 * Analytics Feature Manifest
 * Week 2-3 User Behavior Tracking
 */

import type { FeatureManifest } from '../types';

const analyticsFeature: FeatureManifest = {
  id: 'analytics',
  name: 'Analytics',
  version: '1.0.0',
  instances: ['core'],

  routes: [
    {
      path: '/analytics',
      component: 'AnalyticsDashboard',
      navItem: {
        label: 'Analytics',
        icon: 'BarChart3',
        group: 'insights',
        order: 10
      }
    }
  ],

  navGroups: [
    {
      id: 'insights',
      label: 'Insights',
      icon: 'TrendingUp',
      order: 40
    }
  ],

  components: {
    AnalyticsDashboard: () => import('./pages/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard }))
  }
};

export default analyticsFeature;
