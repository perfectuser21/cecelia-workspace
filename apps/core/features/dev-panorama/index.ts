import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'dev-panorama',
  name: 'Dev Panorama',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  routes: [
    { path: '/panorama', component: 'DevPanorama' },
    { path: '/panorama/repo/:repoName', component: 'RepoDetail' },
  ],

  components: {
    DevPanorama: () => import('./pages/DevPanorama'),
    RepoDetail: () => import('./pages/RepoDetail'),
  },
};

export default manifest;
