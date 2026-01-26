import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'canvas',
  name: 'Canvas',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  routes: [
    { path: '/canvas', component: 'Canvas' },
    { path: '/voice-canvas', component: 'CeceliaCanvas' },
    { path: '/canvas-flow', component: 'CeceliaCanvasFlow' },
    { path: '/canvas-konva', component: 'CeceliaCanvasKonva' },
    { path: '/test-canvas', component: 'VoiceCanvasTest' },
    { path: '/simple-test', component: 'SimpleTest' },
    { path: '/whiteboard', component: 'Whiteboard' },
    { path: '/project-panorama', component: 'ProjectPanorama' },
    { path: '/viz-dashboard', component: 'VizDashboard' },
  ],

  components: {
    Canvas: () => import('./pages/Canvas'),
    CeceliaCanvas: () => import('./pages/CeceliaCanvas'),
    CeceliaCanvasFlow: () => import('./pages/CeceliaCanvasFlow'),
    CeceliaCanvasKonva: () => import('./pages/CeceliaCanvasKonva'),
    VoiceCanvasTest: () => import('./pages/VoiceCanvasTest'),
    SimpleTest: () => import('./pages/SimpleTest'),
    Whiteboard: () => import('./pages/Whiteboard'),
    ProjectPanorama: () => import('./pages/ProjectPanorama'),
    VizDashboard: () => import('./pages/VizDashboard'),
  },
};

export default manifest;
