# Autopilot Feature

**Version**: 1.0.0
**Instance**: Autopilot
**Created**: 2026-01-26

## 概述

Autopilot feature 是为 Autopilot 实例（悦升云端）提供的核心功能模块，包含了团队运营相关的所有页面和功能。

## 功能模块

### 主导航

1. **工作台** (`/`)
   - 组件: `Dashboard`
   - 功能: 数据概览、快速访问

2. **新媒体运营** (`/media`)
   - 组件: `MediaScenarioPage`
   - 功能: 内容管理、数据采集、发布统计

3. **AI 员工** (`/ai-employees`)
   - 组件: `AiEmployeesPage`, `AiEmployeeDetailPage`, `AiAbilityDetailPage`
   - 功能: AI 员工管理、能力配置

4. **账号管理** (`/accounts`)
   - 组件: `AccountsList`, `AccountMetrics`
   - 功能: 多平台账号管理、数据监控

### 其他页面

- **内容数据**: `ContentData` - 内容数据管理
- **内容发布**: `ContentPublish` - 发布任务管理
- **数据采集**: `ScrapingPage` - 爬虫任务配置
- **执行状态**: `ExecutionStatus` - 任务执行监控
- **发布统计**: `PublishStats` - 发布数据统计
- **登录页面**: `LoginPage` - 第三方平台授权

## 技术架构

### Feature Manifest

```typescript
{
  id: 'autopilot',
  name: 'Autopilot Dashboard',
  version: '1.0.0',
  source: 'autopilot',
  instances: ['autopilot'],
  navGroups: [...],
  routes: [...],
  components: {...}
}
```

### 组件加载

所有组件从 `dashboard/src/pages/` 动态加载：

```typescript
components: {
  Dashboard: () => import('../../dashboard/src/pages/Dashboard'),
  MediaScenarioPage: () => import('../../dashboard/src/pages/MediaScenarioPage'),
  // ...
}
```

### 路由配置

- **导航路由**: 出现在侧边栏菜单
- **详情路由**: 动态路由，不在菜单显示
- **兼容路由**: 重定向旧路由到新路由

## 与 Core 的区别

| 特性 | Autopilot | Core |
|------|-----------|------|
| **定位** | 团队运营工具 | 个人开发工具 |
| **主题色** | 蓝色 (#3b82f6) | 蓝色 (#1e3a8a) |
| **功能** | 新媒体、AI 员工 | VPS、Claude、Canvas |
| **用户** | 团队成员 | 个人开发者 |

## 集成方式

### 在 Autopilot 实例中使用

```typescript
import { buildAutopilotConfig } from '@features/core';

const config = await buildAutopilotConfig();
// config.navGroups, config.pageComponents, config.allRoutes
```

### 在 features/index.ts 中注册

```typescript
export const autopilotFeatures = {
  'autopilot': () => import('./autopilot'),
};
```

## 目录结构

```
features/autopilot/
├── index.ts          # Feature manifest
├── README.md         # 本文档
├── pages/            # 页面组件（未来迁移）
├── components/       # 共享组件
└── api/              # API 调用
```

## 开发指南

### 添加新页面

1. 在 `dashboard/src/pages/` 创建页面组件
2. 在 `index.ts` 的 `routes` 中添加路由
3. 在 `components` 中添加组件加载器
4. 如需在导航中显示，配置 `navItem`

### 修改导航顺序

编辑 `index.ts` 中 `navItem.order` 字段。

### 测试

```bash
cd dashboard
npm run build  # 生产构建测试
npm run dev    # 开发模式测试
```

## 版本历史

### 1.0.0 (2026-01-26)
- 初始版本
- 将 Dashboard 注册为标准 feature
- 统一 Autopilot 和 Core 的架构模式
- 支持动态配置加载

## 相关文档

- Feature 类型定义: `features/types.ts`
- Core Features: `features/README.md` (待创建)
- Dashboard 配置: `dashboard/src/config/navigation.config.ts`
