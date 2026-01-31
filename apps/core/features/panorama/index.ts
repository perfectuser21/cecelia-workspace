import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'panorama',
  name: 'Command Center',
  version: '2.0.0',
  source: 'core',
  instances: ['core'],

  routes: [
    { path: '/command', component: 'CommandCenter' },
    { path: '/command/*', component: 'CommandCenter' },
    { path: '/command/ai', component: 'AIDetail' },
    { path: '/command/media', component: 'MediaDetail' },
    { path: '/command/clients', component: 'ClientsDetail' },
    { path: '/command/portfolio', component: 'PortfolioDetail' },
  ],

  components: {
    CommandCenter: () => import('./pages/CommandCenter'),
    AIDetail: () => import('./pages/AIDetail'),
    MediaDetail: () => import('./pages/MediaDetail'),
    ClientsDetail: () => import('./pages/ClientsDetail'),
    PortfolioDetail: () => import('./pages/PortfolioDetail'),
  },
};

export default manifest;
