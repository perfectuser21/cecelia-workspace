import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'ops',
  name: 'Ops Center',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  routes: [
    // Default route - redirect to Ops Center
    {
      path: '/',
      redirect: '/ops',
    },
    // Ops Center 入口
    {
      path: '/ops',
      component: 'OpsOverview',
      navItem: { label: 'Ops Center', icon: 'Activity', order: 1 },
    },
    // System (engine + vps-monitor)
    {
      path: '/ops/system',
      component: 'SystemOverview',
    },
    {
      path: '/ops/system/vps',
      component: 'VpsMonitor',
    },
    {
      path: '/ops/system/engine',
      component: 'EngineDashboard',
    },
    {
      path: '/ops/system/capabilities',
      component: 'EngineCapabilities',
    },
    {
      path: '/ops/system/dev-tasks',
      component: 'EngineDevTasks',
    },
    {
      path: '/ops/system/task-monitor',
      component: 'EngineTaskMonitor',
    },
    {
      path: '/ops/system/session-monitor',
      component: 'EngineSessionMonitor',
    },
    // Claude (claude-monitor)
    {
      path: '/ops/claude',
      component: 'ClaudeMonitor',
    },
    {
      path: '/ops/claude/stats',
      component: 'ClaudeStats',
    },
    // DevGate
    {
      path: '/ops/devgate',
      component: 'DevGateMetrics',
    },
    // Panorama (canvas + dev-panorama)
    {
      path: '/ops/panorama',
      component: 'DevPanorama',
    },
    {
      path: '/ops/panorama/repo/:repoName',
      component: 'RepoDetail',
    },
    {
      path: '/ops/panorama/canvas',
      component: 'Canvas',
    },
    {
      path: '/ops/panorama/whiteboard',
      component: 'Whiteboard',
    },
    {
      path: '/ops/panorama/project',
      component: 'ProjectPanorama',
    },
    // Cecelia
    {
      path: '/ops/cecelia',
      component: 'CeceliaOverview',
    },
    {
      path: '/ops/cecelia/agents/:agentId',
      component: 'CeceliaAgentDetail',
    },
    {
      path: '/ops/cecelia/runs',
      component: 'CeceliaRuns',
    },
    {
      path: '/ops/cecelia/runs/:runId',
      component: 'CeceliaRunDetail',
    },
    // Feature Dashboard
    {
      path: '/ops/features',
      component: 'FeatureDashboard',
    },
    // Task Intelligence (Planner)
    {
      path: '/ops/planner',
      component: 'PlannerOverview',
      navItem: { label: 'Command Center', icon: 'Monitor', order: 2 },
    },
    // Live Dashboard (KR3)
    {
      path: '/ops/live',
      component: 'LiveDashboard',
      navItem: { label: 'Live', icon: 'Activity', order: 3 },
    },
    // Work Planning
    {
      path: '/ops/planning',
      component: 'PlanningDashboard',
      navItem: { label: '工作规划', icon: 'Calendar', order: 4 },
    },
    // Task Scheduler
    {
      path: '/ops/scheduler',
      component: 'Scheduler',
      navItem: { label: '任务调度', icon: 'Brain', order: 5 },
    },
    // Roadmap View
    {
      path: '/ops/roadmap',
      component: 'RoadmapView',
      navItem: { label: 'Roadmap', icon: 'Map', order: 6 },
    },
  ],

  components: {
    // Ops Overview (new)
    OpsOverview: () => import('./pages/OpsOverview'),
    // System
    SystemOverview: () => import('./pages/SystemOverview'),
    VpsMonitor: () => import('../vps-monitor/pages/VpsMonitor'),
    EngineDashboard: () => import('../engine/pages/EngineDashboard'),
    EngineCapabilities: () => import('../engine/pages/EngineCapabilities'),
    EngineDevTasks: () => import('../engine/pages/DevTasks'),
    EngineTaskMonitor: () => import('../engine/pages/TaskMonitor'),
    EngineSessionMonitor: () => import('../engine/pages/SessionMonitor'),
    // Claude
    ClaudeMonitor: () => import('../claude-monitor/pages/ClaudeMonitor'),
    ClaudeStats: () => import('../claude-monitor/pages/ClaudeStats'),
    // DevGate
    DevGateMetrics: () => import('../devgate/pages/DevGateMetrics'),
    // Panorama
    DevPanorama: () => import('../dev-panorama/pages/DevPanorama'),
    RepoDetail: () => import('../dev-panorama/pages/RepoDetail'),
    Canvas: () => import('../canvas/pages/Canvas'),
    Whiteboard: () => import('../canvas/pages/Whiteboard'),
    ProjectPanorama: () => import('../canvas/pages/ProjectPanorama'),
    // Cecelia
    CeceliaOverview: () => import('../cecelia/pages/CeceliaOverview'),
    CeceliaAgentDetail: () => import('../cecelia/pages/AgentDetail'),
    CeceliaRuns: () => import('../cecelia/pages/CeceliaRuns'),
    CeceliaRunDetail: () => import('../cecelia/pages/RunDetail'),
    // Feature Dashboard
    FeatureDashboard: () => import('../shared/pages/FeatureDashboard'),
    // Task Intelligence (Planner)
    PlannerOverview: () => import('../planner/pages/PlannerOverview'),
    // Live Dashboard (KR3)
    LiveDashboard: () => import('./pages/LiveDashboard'),
    // Work Planning
    PlanningDashboard: () => import('../planner/pages/PlanningDashboard'),
    // Task Scheduler
    Scheduler: () => import('../planner/pages/Scheduler'),
    // Roadmap View
    RoadmapView: () => import('../planner/pages/RoadmapView'),
  },
};

export default manifest;
