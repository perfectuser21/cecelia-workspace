import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'daily',
  name: 'Daily Setup',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  navGroups: [
    { id: 'daily', label: 'Daily Setup', icon: 'Calendar', order: 2 },
  ],

  routes: [
    {
      path: '/today',
      component: 'TodayView',
      navItem: { label: 'Today', icon: 'CalendarDays', group: 'daily', order: 1 },
    },
    {
      path: '/scheduler',
      component: 'Scheduler',
      navItem: { label: 'Scheduler', icon: 'CalendarClock', group: 'daily', order: 2 },
    },
  ],

  components: {
    TodayView: () => import('./pages/TodayView'),
    Scheduler: () => import('../planning/pages/Scheduler'),
  },
};

export default manifest;
