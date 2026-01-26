import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'canvas',
  name: 'Canvas',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  routes: [
    { path: '/canvas', component: 'Canvas' },
    { path: '/whiteboard', component: 'Whiteboard' },
    { path: '/project-panorama', component: 'ProjectPanorama' },
  ],

  components: {
    Canvas: () => import('./pages/Canvas'),
    Whiteboard: () => import('./pages/Whiteboard'),
    ProjectPanorama: () => import('./pages/ProjectPanorama'),
  },
};

export default manifest;
