import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'autopilot',
  name: 'Autopilot Dashboard',
  version: '1.0.0',
  source: 'autopilot',
  instances: ['autopilot'],

  navGroups: [
    {
      id: 'main',
      label: '主菜单',
      order: 1,
    },
  ],

  routes: [
    {
      path: '/',
      component: 'Dashboard',
      navItem: {
        label: '工作台',
        icon: 'LayoutDashboard',
        group: 'main',
        order: 1,
      },
    },
    {
      path: '/media',
      component: 'MediaScenarioPage',
      navItem: {
        label: '新媒体运营',
        icon: 'Video',
        group: 'main',
        order: 2,
      },
    },
    {
      path: '/media/*',
      component: 'MediaScenarioPage', // 处理嵌套路由
    },
    {
      path: '/ai-employees',
      component: 'AiEmployeesPage',
      navItem: {
        label: 'AI 员工',
        icon: 'Users',
        group: 'main',
        order: 3,
      },
    },
    {
      path: '/ai-employees/:employeeId',
      component: 'AiEmployeeDetailPage',
    },
    {
      path: '/ai-employees/:employeeId/abilities/:abilityId',
      component: 'AiAbilityDetailPage',
    },
    {
      path: '/accounts',
      component: 'AccountsList',
      navItem: {
        label: '账号管理',
        icon: 'KeyRound',
        group: 'main',
        order: 4,
      },
    },
    {
      path: '/accounts/:platform/:accountId/metrics',
      component: 'AccountMetrics',
    },
    // 其他路由（不在导航中显示）
    {
      path: '/content',
      component: 'ContentData',
    },
    {
      path: '/scraping',
      component: 'ScrapingPage',
    },
    {
      path: '/tasks',
      component: 'ExecutionStatus',
    },
    {
      path: '/tasks/:name',
      component: 'ExecutionStatus',
    },
    {
      path: '/execution-status',
      component: 'ExecutionStatus',
    },
    {
      path: '/publish-stats',
      component: 'PublishStats',
    },
    {
      path: '/login/:platform/:accountId',
      component: 'LoginPage',
    },
  ],

  components: {
    Dashboard: () => import('../../dashboard/src/pages/Dashboard'),
    MediaScenarioPage: () => import('../../dashboard/src/pages/MediaScenarioPage'),
    AiEmployeesPage: () => import('../../dashboard/src/pages/AiEmployeesPage'),
    AiEmployeeDetailPage: () => import('../../dashboard/src/pages/AiEmployeeDetailPage'),
    AiAbilityDetailPage: () => import('../../dashboard/src/pages/AiAbilityDetailPage'),
    AccountsList: () => import('../../dashboard/src/pages/accounts/AccountsList'),
    AccountMetrics: () => import('../../dashboard/src/pages/accounts/AccountMetrics'),
    ContentData: () => import('../../dashboard/src/pages/ContentData'),
    ContentPublish: () => import('../../dashboard/src/pages/ContentPublish'),
    ScrapingPage: () => import('../../dashboard/src/pages/ScrapingPage'),
    ExecutionStatus: () => import('../../dashboard/src/pages/ExecutionStatus'),
    PublishStats: () => import('../../dashboard/src/pages/PublishStats'),
    LoginPage: () => import('../../dashboard/src/pages/LoginPage'),
  },
};

export default manifest;
