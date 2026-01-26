import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'portfolio',
  name: 'Portfolio',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  routes: [
    {
      path: '/portfolio',
      component: 'PortfolioOverview',
      navItem: { label: 'Portfolio', icon: 'TrendingUp', order: 3 },
    },
  ],

  components: {
    PortfolioOverview: () => import('./pages/PortfolioOverview'),
  },
};

export default manifest;
