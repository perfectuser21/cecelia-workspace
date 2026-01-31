import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'aidev',
  name: 'AI Dev',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  navGroups: [
    { id: 'aidev', label: 'AI Dev', icon: 'Terminal', order: 5 },
  ],

  routes: [
    // Cecelia
    {
      path: '/cecelia',
      component: 'CeceliaOverview',
      navItem: { label: 'Cecelia', icon: 'Bot', group: 'aidev', order: 1 },
    },
    { path: '/cecelia/agents/:agentId', component: 'AgentDetail' },
    { path: '/cecelia/runs', component: 'CeceliaRuns' },
    { path: '/cecelia/runs/:runId', component: 'RunDetail' },
    // Engine
    {
      path: '/engine',
      component: 'EngineDashboard',
      navItem: { label: 'Engine', icon: 'Cpu', group: 'aidev', order: 2 },
    },
    { path: '/engine/capabilities', component: 'EngineCapabilities' },
    { path: '/engine/dev-tasks', component: 'DevTasks' },
    { path: '/engine/session-monitor', component: 'SessionMonitor' },
    // Brain
    {
      path: '/brain',
      component: 'BrainDashboard',
      navItem: { label: 'Brain', icon: 'Brain', group: 'aidev', order: 3 },
    },
    // Orchestrator
    { path: '/orchestrator', component: 'OrchestratorPage' },
    // N8N
    {
      path: '/n8n/workflows',
      component: 'N8nWorkflows',
      navItem: { label: 'N8N', icon: 'Workflow', group: 'aidev', order: 4 },
    },
    { path: '/n8n/workflows/:instance/:id', component: 'N8nWorkflowDetail' },
    { path: '/n8n/live-status', component: 'N8nLiveStatus' },
    { path: '/n8n/live-status/:instance/:executionId', component: 'N8nLiveStatusDetail' },
    // Panorama
    {
      path: '/panorama',
      component: 'DevPanorama',
      navItem: { label: 'Panorama', icon: 'Compass', group: 'aidev', order: 5 },
    },
    { path: '/panorama/repo/:repoName', component: 'RepoDetail' },
    { path: '/canvas', component: 'Canvas' },
    { path: '/whiteboard', component: 'Whiteboard' },
    { path: '/project-panorama', component: 'ProjectPanorama' },
    // System
    {
      path: '/ops/live',
      component: 'LiveDashboard',
      navItem: { label: 'Live', icon: 'Activity', group: 'aidev', order: 6 },
    },
    {
      path: '/vps-monitor',
      component: 'VpsMonitor',
      navItem: { label: 'VPS', icon: 'Server', group: 'aidev', order: 7 },
    },
    {
      path: '/claude-monitor',
      component: 'ClaudeMonitor',
      navItem: { label: 'Claude', icon: 'Bot', group: 'aidev', order: 8 },
    },
    { path: '/claude-stats', component: 'ClaudeStats' },
    {
      path: '/quality',
      component: 'QualityMonitorPage',
      navItem: { label: '质量监控', icon: 'Shield', group: 'aidev', order: 9 },
    },
    {
      path: '/devgate',
      component: 'DevGateMetrics',
      navItem: { label: 'DevGate', icon: 'GitBranch', group: 'aidev', order: 10 },
    },
    { path: '/performance', component: 'PerformanceMonitoring' },
    // Workers
    {
      path: '/workers',
      component: 'WorkersOverview',
      navItem: { label: 'Workers', icon: 'Users', group: 'aidev', order: 11 },
    },
    // Command Center (legacy)
    { path: '/command', component: 'CommandCenter' },
    { path: '/command/*', component: 'CommandCenter' },
    // Planner (legacy)
    { path: '/planner', component: 'PlannerOverview' },
    // Redirects
    { path: '/ops', redirect: '/dashboard' },
    { path: '/ops/cecelia', redirect: '/cecelia' },
    { path: '/ops/cecelia/runs', redirect: '/cecelia/runs' },
    { path: '/ops/system/engine', redirect: '/engine' },
    { path: '/ops/system/capabilities', redirect: '/engine/capabilities' },
    { path: '/ops/system/dev-tasks', redirect: '/engine/dev-tasks' },
    { path: '/ops/system/session-monitor', redirect: '/engine/session-monitor' },
    { path: '/ops/planner', redirect: '/planner' },
    { path: '/ops/planning', redirect: '/planner' },
    { path: '/ops/scheduler', redirect: '/scheduler' },
    { path: '/ops/roadmap', redirect: '/roadmap' },
    { path: '/ops/panorama', redirect: '/panorama' },
    { path: '/ops/panorama/canvas', redirect: '/canvas' },
    { path: '/ops/panorama/whiteboard', redirect: '/whiteboard' },
    { path: '/ops/panorama/project', redirect: '/project-panorama' },
    { path: '/ops/system', redirect: '/vps-monitor' },
    { path: '/ops/system/vps', redirect: '/vps-monitor' },
    { path: '/ops/claude', redirect: '/claude-monitor' },
    { path: '/ops/claude/stats', redirect: '/claude-stats' },
    { path: '/ops/devgate', redirect: '/devgate' },
    { path: '/planning', redirect: '/planner' },
    { path: '/company', redirect: '/projects' },
    { path: '/company/ai-team', redirect: '/workers' },
    { path: '/company/tasks', redirect: '/tasks' },
    { path: '/company/media', redirect: '/projects' },
    { path: '/company/team', redirect: '/projects' },
    { path: '/company/finance', redirect: '/projects' },
    { path: '/company/ai-team/workers', redirect: '/workers' },
    { path: '/company/ai-team/workflows', redirect: '/n8n/workflows' },
    { path: '/company/ai-team/live-status', redirect: '/n8n/live-status' },
    { path: '/portfolio', redirect: '/projects' },
    { path: '/knowledge', redirect: '/brain' },
  ],

  components: {
    // Cecelia
    CeceliaOverview: () => import('../execution/pages/CeceliaOverview'),
    AgentDetail: () => import('../execution/pages/AgentDetail'),
    CeceliaRuns: () => import('../execution/pages/CeceliaRuns'),
    RunDetail: () => import('../execution/pages/RunDetail'),
    // Engine
    EngineDashboard: () => import('../execution/pages/EngineDashboard'),
    EngineCapabilities: () => import('../execution/pages/EngineCapabilities'),
    DevTasks: () => import('../execution/pages/DevTasks'),
    SessionMonitor: () => import('../execution/pages/SessionMonitor'),
    BrainDashboard: () => import('../planning/pages/BrainDashboard'),
    OrchestratorPage: () => import('../execution/pages/OrchestratorPage'),
    // N8N
    N8nWorkflows: () => import('../execution/pages/N8nWorkflows'),
    N8nWorkflowDetail: () => import('../execution/pages/N8nWorkflowDetail'),
    N8nLiveStatus: () => import('../execution/pages/N8nLiveStatus'),
    N8nLiveStatusDetail: () => import('../execution/pages/N8nLiveStatusDetail'),
    // Panorama
    DevPanorama: () => import('../planning/pages/DevPanorama'),
    RepoDetail: () => import('../planning/pages/RepoDetail'),
    Canvas: () => import('../planning/pages/Canvas'),
    Whiteboard: () => import('../planning/pages/Whiteboard'),
    ProjectPanorama: () => import('../planning/pages/ProjectPanorama'),
    // System
    LiveDashboard: () => import('../system/pages/LiveDashboard'),
    VpsMonitor: () => import('../system/pages/VpsMonitor'),
    ClaudeMonitor: () => import('../system/pages/ClaudeMonitor'),
    ClaudeStats: () => import('../system/pages/ClaudeStats'),
    QualityMonitorPage: () => import('../system/pages/QualityMonitorPage'),
    DevGateMetrics: () => import('../system/pages/DevGateMetrics'),
    PerformanceMonitoring: () => import('../system/pages/PerformanceMonitoring'),
    // Workers
    WorkersOverview: () => import('../execution/pages/WorkersOverview'),
    // Legacy
    CommandCenter: () => import('../business/pages/CommandCenter'),
    PlannerOverview: () => import('../planning/pages/PlannerOverview'),
  },
};

export default manifest;
