import { useState } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  LogOut,
  Database,
  FileText,
  Sparkles,
  Settings,
  KeyRound,
  Activity,
  MonitorDot,
  Server,
  PanelLeftClose,
  PanelLeft,
  DollarSign,
  Sun,
  Moon,
  Monitor,
  Workflow,
  ListTodo,
  X,
  TrendingUp,
  Radio,
  Map,
} from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import PrivateRoute from './components/PrivateRoute';
import Dashboard from './pages/Dashboard';
import ProjectPanorama from './pages/ProjectPanorama';
import LoginPage from './pages/LoginPage';
import FeishuLogin from './pages/FeishuLogin';
import ContentPublish from './pages/ContentPublish';
import ContentData from './pages/ContentData';
import DouyinLogin from './pages/DouyinLogin';
import PlatformLogin from './pages/PlatformLogin';
import SessionMonitor from './pages/SessionMonitor';
import ClaudeMonitor from './pages/ClaudeMonitor';
import ClaudeStats from './pages/ClaudeStats';
import VpsMonitor from './pages/VpsMonitor';
import N8nWorkflows from './pages/N8nWorkflows';
import N8nWorkflowDetail from './pages/N8nWorkflowDetail';
import Tasks from './pages/Tasks';
import PublishStats from './pages/PublishStats';
import PlatformStatus from './pages/PlatformStatus';
import './App.css';

function AppContent() {
  const location = useLocation();
  const { user, logout, isAuthenticated, isSuperAdmin } = useAuth();
  const { theme, actualTheme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
  };

  // 主题切换
  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'auto'> = ['light', 'dark', 'auto'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const allNavGroups = [
    {
      title: '概览',
      items: [
        { path: '/', icon: LayoutDashboard, label: '工作台' },
        { path: '/tasks', icon: ListTodo, label: '任务' },
        { path: '/data-center', icon: BarChart3, label: '数据中心' },
      ]
    },
    {
      title: '管理',
      items: [
        { path: '/content', icon: FileText, label: '内容管理' },
        { path: '/platform-status', icon: Radio, label: '平台状态' },
        { path: '/publish-stats', icon: TrendingUp, label: '发布统计' },
        { path: '/scraping', icon: Database, label: '数据采集' },
      ]
    },
    {
      title: '系统',
      items: [
        { path: '/tools', icon: Sparkles, label: '工具箱' },
        ...(isSuperAdmin ? [
          { path: '/panorama', icon: Map, label: '我的空间' },
          { path: '/settings', icon: Settings, label: '管理员' },
        ] : []),
      ]
    }
  ];
  const navGroups = allNavGroups;

  // 兼容旧代码
  const navItems = navGroups.flatMap(g => g.items);

  // 如果未登录且不在登录页，显示登录页
  if (!isAuthenticated && !location.pathname.startsWith('/login')) {
    return <FeishuLogin />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-slate-800 transition-colors">
      {/* 退出登录确认框 - 毛玻璃效果 */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 背景遮罩 - 模糊效果 */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-slate-900/60 via-slate-800/50 to-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowLogoutConfirm(false)}
          />
          {/* 弹窗主体 */}
          <div className="relative bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 border border-white/20 dark:border-slate-700/50">
            {/* 顶部图标 */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30 flex items-center justify-center">
                <LogOut className="w-8 h-8 text-red-500" />
              </div>
            </div>
            {/* 标题 */}
            <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">
              确认退出登录？
            </h3>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
              退出后需要重新登录才能访问系统
            </p>
            {/* 按钮组 */}
            <div className="flex gap-4">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-5 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-2xl font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-all"
              >
                取消
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 px-5 py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white rounded-2xl font-medium transition-all shadow-lg shadow-red-500/25 hover:shadow-red-500/40 flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                退出
              </button>
            </div>
          </div>
        </div>
      )}

      {isAuthenticated && (
        <>
          {/* 左侧导航栏 - 蓝色渐变风格 */}
          <aside className={`fixed inset-y-0 left-0 ${collapsed ? 'w-16' : 'w-64'} flex flex-col shadow-2xl transition-all duration-300 z-20`} style={{ background: 'linear-gradient(180deg, #1e3a8a 0%, #1e2a5e 100%)' }}>
            {/* Logo 区域 */}
            <div className={`h-16 flex items-center ${collapsed ? 'justify-center' : 'justify-start'} px-4 border-b border-white/10`}>
              {collapsed ? (
                <div className="relative w-10 h-10 flex items-center justify-center">
                  {/* 外圈光晕 */}
                  <div className="absolute inset-0 rounded-full bg-white/10 blur-sm" />
                  {/* 主圆 */}
                  <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/30 flex items-center justify-center backdrop-blur-sm">
                    <span className="text-white font-semibold text-lg" style={{ fontFamily: 'system-ui', letterSpacing: '-0.02em' }}>Z</span>
                  </div>
                </div>
              ) : (
                <img src="/logo-white.png" alt="悦升云端科技" className="h-9 drop-shadow-lg" />
              )}
            </div>

            {/* 收缩按钮 */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="absolute -right-3 top-20 w-6 h-6 rounded-full flex items-center justify-center text-sky-200 hover:text-white transition-all shadow-lg border border-sky-400/30 bg-blue-900 hover:bg-blue-800"
              title={collapsed ? '展开侧边栏' : '收起侧边栏'}
            >
              {collapsed ? <PanelLeft className="w-3 h-3" /> : <PanelLeftClose className="w-3 h-3" />}
            </button>

            {/* 导航菜单 */}
            <nav className={`flex-1 ${collapsed ? 'px-2' : 'px-3'} py-4 overflow-y-auto`}>
              {navGroups.map((group, groupIndex) => (
                <div key={group.title} className={groupIndex > 0 ? 'mt-6' : ''}>
                  {!collapsed && (
                    <p className="px-3 mb-2 text-[10px] font-semibold text-sky-400/60 uppercase tracking-wider">
                      {group.title}
                    </p>
                  )}
                  {collapsed && groupIndex > 0 && (
                    <div className="mx-2 mb-2 border-t border-white/5" />
                  )}
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          title={collapsed ? item.label : undefined}
                          className={`group relative flex items-center ${collapsed ? 'justify-center px-2' : 'px-3'} py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                            isActive
                              ? 'bg-sky-500/20 text-white'
                              : 'text-blue-200/70 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-sky-400" />
                          )}
                          <Icon className={`w-5 h-5 ${collapsed ? '' : 'mr-3'} transition-transform duration-200 ${isActive ? 'text-sky-300' : 'text-blue-300/60 group-hover:text-white group-hover:scale-110'}`} />
                          {!collapsed && item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* 底部用户信息 */}
            <div className={`border-t border-white/5 ${collapsed ? 'p-2' : 'p-4'}`}>
              {collapsed ? (
                <div className="space-y-2">
                  <div className="relative mx-auto w-10 h-10">
                    {user?.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900" />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600">
                        <span className="text-white font-semibold text-sm">{user?.name?.charAt(0) || 'U'}</span>
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                  </div>
                  <button
                    onClick={handleLogout}
                    title="退出登录"
                    className="w-full flex items-center justify-center p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-white/5 backdrop-blur">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {user?.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900" />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg bg-gradient-to-br from-blue-500 to-blue-600">
                          <span className="text-white font-semibold text-sm">{user?.name?.charAt(0) || 'U'}</span>
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-800 rounded-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {user?.name || '用户'}
                        {isSuperAdmin && <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-amber-500 text-white rounded">超级管理员</span>}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{user?.department || '在线'}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      title="退出登录"
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* 顶部栏 */}
          <div className={`fixed top-0 ${collapsed ? 'left-16' : 'left-64'} right-0 h-16 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-700/50 flex items-center justify-between px-8 z-10 shadow-sm transition-all duration-300`}>
            {/* 左侧：面包屑或页面标题 */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {navItems.find(item => item.path === location.pathname)?.label || '工作台'}
              </h2>
            </div>

            {/* 右侧：主题切换 */}
            <div className="flex items-center">
              <button
                onClick={cycleTheme}
                className="relative p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title={theme === 'auto' ? '自动模式' : theme === 'dark' ? '深色模式' : '浅色模式'}
              >
                {theme === 'auto' ? (
                  <Monitor className="w-5 h-5" />
                ) : theme === 'dark' ? (
                  <Moon className="w-5 h-5" />
                ) : (
                  <Sun className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* 主内容区域 */}
      <main className={isAuthenticated ? `${collapsed ? 'ml-16' : 'ml-64'} pt-16 transition-all duration-300` : ""}>
        <div className={isAuthenticated ? "p-8" : ""}>
          <Routes>
            {/* 登录页面 */}
            <Route path="/login" element={<FeishuLogin />} />

            {/* 受保护的路由 */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/panorama"
              element={
                <PrivateRoute>
                  <ProjectPanorama />
                </PrivateRoute>
              }
            />
            <Route
              path="/data-center"
              element={
                <PrivateRoute>
                  <ContentData />
                </PrivateRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <PrivateRoute>
                  <Tasks />
                </PrivateRoute>
              }
            />
            <Route
              path="/tasks/:name"
              element={
                <PrivateRoute>
                  <Tasks />
                </PrivateRoute>
              }
            />
            <Route
              path="/content"
              element={
                <PrivateRoute>
                  <ContentPublish />
                </PrivateRoute>
              }
            />
            <Route
              path="/publish-stats"
              element={
                <PrivateRoute>
                  <PublishStats />
                </PrivateRoute>
              }
            />
            <Route
              path="/platform-status"
              element={
                <PrivateRoute>
                  <PlatformStatus />
                </PrivateRoute>
              }
            />
            <Route
              path="/tools"
              element={
                <PrivateRoute>
                  <div className="max-w-4xl mx-auto">
                    <h2 className="text-xl font-semibold mb-6">工具箱</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <Link
                        to="/tools/session-monitor"
                        className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow border"
                      >
                        <Activity className="w-10 h-10 text-blue-500 mb-3" />
                        <h3 className="font-medium text-gray-900 mb-1">登录状态</h3>
                        <p className="text-sm text-gray-500">查看各平台登录状态和持续时间</p>
                      </Link>
                    </div>
                  </div>
                </PrivateRoute>
              }
            />
            <Route
              path="/scraping"
              element={
                <PrivateRoute>
                  <div className="text-center py-12">
                    <Database className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">数据采集</h3>
                    <p className="text-gray-500">功能开发中...</p>
                  </div>
                </PrivateRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <PrivateRoute>
                  {isSuperAdmin ? (
                    <div className="max-w-4xl mx-auto">
                      <h2 className="text-xl font-semibold mb-6">管理员专区</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Link
                          to="/settings/claude-monitor"
                          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow border"
                        >
                          <MonitorDot className="w-10 h-10 text-purple-500 mb-3" />
                          <h3 className="font-medium text-gray-900 mb-1">Claude Monitor</h3>
                          <p className="text-sm text-gray-500">监控 Claude 会话运行状态和 Token 使用</p>
                        </Link>
                        <Link
                          to="/settings/vps-monitor"
                          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow border"
                        >
                          <Server className="w-10 h-10 text-green-500 mb-3" />
                          <h3 className="font-medium text-gray-900 mb-1">VPS 监控</h3>
                          <p className="text-sm text-gray-500">监控服务器资源使用和容器状态</p>
                        </Link>
                        <Link
                          to="/settings/claude-stats"
                          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow border"
                        >
                          <DollarSign className="w-10 h-10 text-emerald-500 mb-3" />
                          <h3 className="font-medium text-gray-900 mb-1">Claude Stats</h3>
                          <p className="text-sm text-gray-500">费用统计、Token 使用趋势分析</p>
                        </Link>
                        <Link
                          to="/settings/n8n-workflows"
                          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow border"
                        >
                          <Workflow className="w-10 h-10 text-orange-500 mb-3" />
                          <h3 className="font-medium text-gray-900 mb-1">N8n 工作流</h3>
                          <p className="text-sm text-gray-500">监控自动化工作流执行状态</p>
                        </Link>
                      </div>
                    </div>
                  ) : <Navigate to="/" replace />}
                </PrivateRoute>
              }
            />
            <Route
              path="/login/:platform/:accountId"
              element={
                <PrivateRoute>
                  <LoginPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/platform-login"
              element={
                <PrivateRoute>
                  <PlatformLogin />
                </PrivateRoute>
              }
            />
            <Route
              path="/tools/session-monitor"
              element={
                <PrivateRoute>
                  <SessionMonitor />
                </PrivateRoute>
              }
            />
            <Route
              path="/settings/claude-monitor"
              element={
                <PrivateRoute>
                  {isSuperAdmin ? <ClaudeMonitor /> : <Navigate to="/" replace />}
                </PrivateRoute>
              }
            />
            <Route
              path="/settings/vps-monitor"
              element={
                <PrivateRoute>
                  {isSuperAdmin ? <VpsMonitor /> : <Navigate to="/" replace />}
                </PrivateRoute>
              }
            />
            <Route
              path="/settings/claude-stats"
              element={
                <PrivateRoute>
                  {isSuperAdmin ? <ClaudeStats /> : <Navigate to="/" replace />}
                </PrivateRoute>
              }
            />
            <Route
              path="/settings/n8n-workflows"
              element={
                <PrivateRoute>
                  {isSuperAdmin ? <N8nWorkflows /> : <Navigate to="/" replace />}
                </PrivateRoute>
              }
            />
            <Route
              path="/settings/n8n-workflows/:instance/:id"
              element={
                <PrivateRoute>
                  {isSuperAdmin ? <N8nWorkflowDetail /> : <Navigate to="/" replace />}
                </PrivateRoute>
              }
            />
            <Route
              path="/douyin-login"
              element={
                <PrivateRoute>
                  <DouyinLogin />
                </PrivateRoute>
              }
            />

            {/* 404 重定向 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
