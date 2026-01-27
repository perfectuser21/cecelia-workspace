import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'company',
  name: 'Company',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  routes: [
    // Company 入口
    {
      path: '/company',
      component: 'CompanyOverview',
      navItem: { label: 'Company', icon: 'Building2', order: 2 },
    },
    // AI Team (workers + n8n)
    {
      path: '/company/ai-team',
      component: 'AITeamOverview',
    },
    {
      path: '/company/ai-team/workers',
      component: 'WorkersOverview',
    },
    {
      path: '/company/ai-team/workflows',
      component: 'N8nWorkflows',
    },
    {
      path: '/company/ai-team/workflows/:instance/:id',
      component: 'N8nWorkflowDetail',
    },
    {
      path: '/company/ai-team/live-status',
      component: 'N8nLiveStatus',
    },
    {
      path: '/company/ai-team/live-status/:instance/:executionId',
      component: 'N8nExecutionDetail',
    },
    // Tasks
    {
      path: '/company/tasks',
      component: 'TasksPage',
    },
    // Media (placeholder)
    {
      path: '/company/media',
      component: 'MediaOverview',
    },
    // Team (placeholder)
    {
      path: '/company/team',
      component: 'TeamOverview',
    },
    // Finance (placeholder)
    {
      path: '/company/finance',
      component: 'FinanceOverview',
    },
  ],

  components: {
    // Company Overview
    CompanyOverview: () => import('./pages/CompanyOverview'),
    // AI Team
    AITeamOverview: () => import('./pages/AITeamOverview'),
    WorkersOverview: () => import('../workers/pages/WorkersOverview'),
    N8nWorkflows: () => import('../n8n/pages/N8nWorkflows'),
    N8nWorkflowDetail: () => import('../n8n/pages/N8nWorkflowDetail'),
    N8nLiveStatus: () => import('../n8n/pages/N8nLiveStatus'),
    N8nExecutionDetail: () => import('../n8n/pages/N8nLiveStatusDetail'),
    // Tasks
    TasksPage: () => import('../tasks/pages/Tasks'),
    // Placeholders
    MediaOverview: () => import('./pages/MediaOverview'),
    TeamOverview: () => import('./pages/TeamOverview'),
    FinanceOverview: () => import('./pages/FinanceOverview'),
  },
};

export default manifest;
