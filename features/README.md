# Features System

**Version**: 1.0.0
**Last Updated**: 2026-01-26

## 概述

Features 系统是 ZenithJoy Autopilot / Core 项目的核心架构模式，提供模块化、可组合的功能单元管理。

### 核心理念

- **Feature = 独立功能模块**: 每个 feature 是一个自包含的功能单元
- **动态加载**: Features 按需加载，优化初始加载性能
- **实例隔离**: 不同实例（Core / Autopilot）可以加载不同的 features
- **统一接口**: 所有 features 遵循相同的 manifest 模式

### 关键概念

| 概念 | 说明 | 示例 |
|------|------|------|
| **FeatureManifest** | Feature 的声明文件 | `features/canvas/index.ts` |
| **InstanceType** | 实例类型 | `'core'` 或 `'autopilot'` |
| **NavGroups** | 导航分组 | 主菜单、系统管理 |
| **Routes** | 路由配置 | `/canvas`, `/cecelia/runs` |
| **Components** | 懒加载组件 | `() => import('./pages/Canvas')` |

---

## 快速开始

### 创建新 Feature

```bash
# 1. 创建目录结构
mkdir -p features/my-feature/{pages,components,api,hooks}

# 2. 创建 manifest
cat > features/my-feature/index.ts << 'EOF'
import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'my-feature',
  name: 'My Feature',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  routes: [
    {
      path: '/my-feature',
      component: 'MyFeaturePage',
      navItem: {
        label: 'My Feature',
        icon: 'Star',
        order: 1,
      },
    },
  ],

  components: {
    MyFeaturePage: () => import('./pages/MyFeaturePage'),
  },
};

export default manifest;
EOF

# 3. 创建页面组件
cat > features/my-feature/pages/MyFeaturePage.tsx << 'EOF'
export default function MyFeaturePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">My Feature</h1>
      <p className="mt-4">Welcome to my new feature!</p>
    </div>
  );
}
EOF

# 4. 在 features/index.ts 中注册
# 添加到 coreFeatures 或 autopilotFeatures:
# 'my-feature': () => import('./my-feature'),
```

### 验证 Feature

```bash
cd dashboard

# 类型检查
npm run type-check

# 构建测试
npm run build

# 开发模式
npm run dev
# 访问 http://localhost:3001/my-feature
```

---

## FeatureManifest 详解

### 完整示例

```typescript
import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  // 基本信息
  id: 'canvas',                    // 唯一标识
  name: 'Visual Canvas',           // 显示名称
  version: '1.0.0',               // 语义化版本
  source: 'core',                 // 来源: 'core' | 'autopilot'

  // 可见性控制
  instances: ['core'],            // 哪些实例可见，省略 = 所有实例

  // 导航分组（可选）
  navGroups: [
    {
      id: 'visualization',
      label: '可视化',
      icon: 'PieChart',
      order: 1,
    },
  ],

  // 路由配置
  routes: [
    {
      path: '/canvas',
      component: 'CanvasIndex',
      navItem: {                  // 有 navItem = 出现在导航菜单
        label: '画布',
        icon: 'Layout',
        group: 'visualization',  // 归属分组 ID
        order: 1,                // 菜单排序
      },
    },
    {
      path: '/canvas/:id',        // 动态路由
      component: 'CanvasDetail', // 无 navItem = 不在菜单显示
    },
  ],

  // 组件加载器
  components: {
    CanvasIndex: () => import('./pages/CanvasIndex'),
    CanvasDetail: () => import('./pages/CanvasDetail'),
  },
};

export default manifest;
```

### 字段说明

#### 基本字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | Feature 唯一标识，建议 kebab-case |
| `name` | string | ✅ | 显示名称，用于 UI |
| `version` | string | ✅ | 语义化版本号 (semver) |
| `source` | `'core' \| 'autopilot'` | ✅ | Feature 来源 |
| `instances` | `InstanceType[]` | ❌ | 可见实例，省略 = 所有 |

#### NavGroups (导航分组)

```typescript
navGroups?: {
  id: string;         // 分组 ID
  label: string;      // 分组名称
  icon?: string;      // Lucide 图标名
  order?: number;     // 排序权重
}[]
```

#### Routes (路由)

```typescript
routes: {
  path: string;       // 路由路径（支持动态参数）
  component: string;  // 组件 key（对应 components 中的 key）
  navItem?: {         // 导航项配置（有则显示在菜单）
    label: string;    // 菜单文本
    icon?: string;    // Lucide 图标名
    group?: string;   // 归属分组 ID
    order?: number;   // 排序权重
  };
}[]
```

#### Components (组件加载器)

```typescript
components: Record<
  string,                                    // 组件 key
  () => Promise<{ default: ComponentType }>  // 懒加载函数
>
```

---

## 实例系统

### InstanceType

```typescript
type InstanceType = 'core' | 'autopilot';
```

- **Core**: 个人开发工具，功能全面（VPS、Canvas、Cecelia、Claude 监控等）
- **Autopilot**: 团队运营工具，专注新媒体和 AI 员工管理

### 实例检测

系统会根据域名和端口自动检测实例类型：

```typescript
// features/registry.ts
export function detectInstance(): InstanceType {
  const hostname = window.location.hostname;

  // 生产环境域名映射
  if (hostname.includes('dashboard.') ||
      hostname.includes('autopilot.') ||
      hostname === 'zenjoymedia.media') {
    return 'autopilot';
  }
  if (hostname.includes('core.')) return 'core';

  // 开发环境端口映射
  const port = window.location.port;
  if (port === '3001') return 'autopilot';  // Dashboard dev
  if (port === '5211' || port === '5212') {
    if (hostname.includes('dev-autopilot')) return 'autopilot';
    if (hostname.includes('dev-core')) return 'core';
    return 'core';
  }

  return 'core';
}
```

### 域名映射表

| 环境 | 域名 | 实例 | 端口 |
|------|------|------|------|
| **生产** | core.zenjoymedia.media | Core | 5211 |
| **生产** | autopilot.zenjoymedia.media | Autopilot | 5211 |
| **生产** | dashboard.zenjoymedia.media | Autopilot | 5211 |
| **生产** | zenjoymedia.media | Autopilot | 5211 |
| **开发** | dev-core.zenjoymedia.media | Core | 5212 |
| **开发** | dev-autopilot.zenjoymedia.media | Autopilot | 5212 |
| **本地** | localhost:3001 | Autopilot | 3001 |

### 实例特定 Features

#### 仅 Core 实例

```typescript
const manifest: FeatureManifest = {
  id: 'vps-monitor',
  instances: ['core'],  // 仅 Core 可见
  // ...
};
```

#### 仅 Autopilot 实例

```typescript
const manifest: FeatureManifest = {
  id: 'autopilot',
  instances: ['autopilot'],  // 仅 Autopilot 可见
  // ...
};
```

#### 所有实例

```typescript
const manifest: FeatureManifest = {
  id: 'workers',
  // 省略 instances = 所有实例可见
  // ...
};
```

---

## 目录结构

### 标准 Feature 结构

```
features/
├── my-feature/
│   ├── index.ts              # FeatureManifest (必需)
│   ├── README.md             # Feature 文档
│   ├── pages/                # 页面组件
│   │   ├── MyFeaturePage.tsx
│   │   └── DetailPage.tsx
│   ├── components/           # 共享组件
│   │   ├── FeatureCard.tsx
│   │   └── FeatureList.tsx
│   ├── api/                  # API 客户端
│   │   └── my-feature.api.ts
│   ├── hooks/                # React Hooks
│   │   └── useMyFeature.ts
│   ├── types.ts              # TypeScript 类型
│   └── config.ts             # 配置文件
```

### Feature Registry

```
features/
├── index.ts                  # Feature 注册中心
├── types.ts                  # 类型定义
├── registry.ts               # Feature Registry 实现
├── config.ts                 # 实例配置
├── shared/                   # 共享工具
│   ├── components/
│   ├── utils/
│   └── hooks/
└── [feature-name]/           # 各个 feature
```

---

## 导航系统

### NavGroups

导航分组用于组织侧边栏菜单：

```typescript
navGroups: [
  {
    id: 'main',
    label: '主菜单',
    order: 1,
  },
  {
    id: 'system',
    label: '系统管理',
    icon: 'Settings',
    order: 2,
  },
]
```

### 导航层级

```
NavGroup (分组)
├─ NavGroupItem (菜单项 1)
├─ NavGroupItem (菜单项 2)
└─ NavGroupItem (菜单项 3)
```

### 导航示例

```typescript
// Feature manifest
{
  navGroups: [
    { id: 'ops', label: '运维中心', icon: 'Activity', order: 1 }
  ],
  routes: [
    {
      path: '/ops',
      component: 'OpsOverview',
      navItem: {
        label: '运维概览',
        icon: 'LayoutDashboard',
        group: 'ops',
        order: 1,
      },
    },
    {
      path: '/ops/vps',
      component: 'VpsMonitor',
      navItem: {
        label: 'VPS 监控',
        icon: 'Server',
        group: 'ops',
        order: 2,
      },
    },
  ],
}
```

生成侧边栏：

```
运维中心
├─ 运维概览
└─ VPS 监控
```

---

## 路由系统

### 路由类型

1. **导航路由**: 有 `navItem`，出现在侧边栏
2. **详情路由**: 无 `navItem`，通过点击跳转
3. **动态路由**: 包含参数 (`:id`, `:name`)

### 路由示例

```typescript
routes: [
  // 导航路由
  {
    path: '/canvas',
    component: 'CanvasIndex',
    navItem: {
      label: '画布',
      icon: 'Layout',
      order: 1,
    },
  },

  // 详情路由（不在菜单）
  {
    path: '/canvas/:id',
    component: 'CanvasDetail',
  },

  // 嵌套路由
  {
    path: '/canvas/*',
    component: 'CanvasIndex',  // 处理子路由
  },
]
```

### 路由优先级

路由按注册顺序匹配，更具体的路由应该排在前面：

```typescript
routes: [
  { path: '/canvas/new', component: 'CanvasNew' },      // ✅ 具体路由在前
  { path: '/canvas/:id', component: 'CanvasDetail' },   // ✅ 动态路由在后
  { path: '/canvas/*', component: 'CanvasIndex' },      // ✅ 通配符最后
]
```

---

## 组件加载

### 懒加载模式

```typescript
components: {
  // 标准懒加载
  MyPage: () => import('./pages/MyPage'),

  // 命名导出
  MyOtherPage: () => import('./pages/MyOtherPage').then(m => ({ default: m.MyOtherPage })),
}
```

### 加载顺序

1. 用户访问路由
2. DynamicRouter 匹配路由
3. 查找组件加载器
4. 执行 `import()` 动态导入
5. 渲染组件

### 共享依赖

所有 features 共享 dashboard 的依赖：

- React, React Router, Lucide Icons
- Tailwind CSS
- Axios, Recharts
- 等等

**不需要**在 features/ 目录安装 node_modules。

---

## 最佳实践

### 1. Feature 命名

- **ID**: kebab-case, 例如 `vps-monitor`, `claude-stats`
- **Name**: Title Case, 例如 "VPS Monitor", "Claude Stats"
- **目录**: 与 ID 一致

### 2. 版本管理

遵循语义化版本 (Semver):

```
MAJOR.MINOR.PATCH
1.0.0 → 初始版本
1.1.0 → 新增功能（向后兼容）
1.1.1 → Bug 修复
2.0.0 → 破坏性更新
```

### 3. 组件设计

```typescript
// ✅ 好的设计
export default function MyFeaturePage() {
  return <div>...</div>;
}

// ❌ 避免
export function MyFeaturePage() {  // 应该用 default export
  return <div>...</div>;
}
```

### 4. API 客户端

```typescript
// features/my-feature/api/my-feature.api.ts
import axios from 'axios';

const API_BASE = '/api/my-feature';

export const myFeatureApi = {
  getAll: () => axios.get(`${API_BASE}/list`),
  getById: (id: string) => axios.get(`${API_BASE}/${id}`),
  create: (data: unknown) => axios.post(API_BASE, data),
};
```

### 5. TypeScript 类型

```typescript
// features/my-feature/types.ts
export interface MyFeatureItem {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

export interface MyFeatureResponse {
  success: boolean;
  data: MyFeatureItem[];
}
```

### 6. 错误处理

```typescript
import { LoadingState, ErrorState } from '../../shared/components';

export default function MyFeaturePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  if (loading) return <LoadingState message="加载中..." />;
  if (error) return <ErrorState message={error} />;

  return <div>{/* 内容 */}</div>;
}
```

---

## 开发工作流

### 1. 规划 Feature

- 确定功能范围
- 设计路由结构
- 规划组件层次

### 2. 创建 Manifest

```bash
mkdir -p features/my-feature
touch features/my-feature/index.ts
```

### 3. 实现页面

```bash
mkdir -p features/my-feature/pages
# 创建页面组件
```

### 4. 注册 Feature

编辑 `features/index.ts`:

```typescript
export const coreFeatures = {
  // ...
  'my-feature': () => import('./my-feature'),
};
```

### 5. 测试

```bash
cd dashboard
npm run dev
# 访问 http://localhost:3001/my-feature
```

### 6. 构建验证

```bash
npm run build
npm run type-check
npm run lint
```

---

## 调试技巧

### 查看已注册 Features

```typescript
// 在浏览器控制台
import { featureRegistry } from '@features/core';
console.log(featureRegistry.getAll());
```

### 检查当前实例

```typescript
import { featureRegistry } from '@features/core';
console.log(featureRegistry.getInstance());
```

### 查看可见 Features

```typescript
import { featureRegistry } from '@features/core';
console.log(featureRegistry.getVisible());
```

---

## 常见问题

### Q: Feature 不显示在菜单？

**A**: 检查：
1. `navItem` 是否正确配置
2. `instances` 是否包含当前实例
3. Feature 是否已注册到 `features/index.ts`

### Q: TypeScript 报错 "Cannot find module"？

**A**: Features 动态加载，TypeScript 可能报模块解析错误。这是预期行为，只要构建成功即可。

### Q: 如何共享组件？

**A**: 放到 `features/shared/` 目录：

```typescript
import { StatusBadge } from '../../shared/components/StatusBadge';
```

### Q: 如何访问 API？

**A**: 使用相对路径 `/api/...`，Vite 会代理到后端：

```typescript
axios.get('/api/my-feature/list');  // → http://localhost:3000/my-feature/list
```

---

## 参考资料

### 类型定义

完整类型定义见 `features/types.ts`

### 现有 Features

参考现有 features 实现：
- **简单 Feature**: `features/portfolio/`
- **中等复杂**: `features/cecelia/`
- **复杂 Feature**: `features/canvas/`
- **聚合 Feature**: `features/ops/`, `features/company/`

### 文档

- [Features 审计报告](../FEATURES_AUDIT.md)
- [质量系统文档](../QUALITY_SYSTEM.md)
- [Autopilot Feature README](./autopilot/README.md)

---

## 附录

### 完整 Feature 模板

```typescript
import { FeatureManifest } from '../types';

const manifest: FeatureManifest = {
  id: 'my-feature',
  name: 'My Feature',
  version: '1.0.0',
  source: 'core',
  instances: ['core'],

  navGroups: [
    {
      id: 'my-group',
      label: 'My Group',
      icon: 'Star',
      order: 1,
    },
  ],

  routes: [
    {
      path: '/my-feature',
      component: 'MyFeatureIndex',
      navItem: {
        label: 'My Feature',
        icon: 'Star',
        group: 'my-group',
        order: 1,
      },
    },
    {
      path: '/my-feature/:id',
      component: 'MyFeatureDetail',
    },
  ],

  components: {
    MyFeatureIndex: () => import('./pages/MyFeatureIndex'),
    MyFeatureDetail: () => import('./pages/MyFeatureDetail'),
  },
};

export default manifest;
```

### Lucide Icons

常用图标名称：
- `LayoutDashboard`, `Activity`, `Server`, `Database`
- `Users`, `User`, `Settings`, `Tool`
- `PieChart`, `BarChart`, `LineChart`, `TrendingUp`
- `Folder`, `File`, `Code`, `Terminal`
- `Star`, `Heart`, `Bookmark`, `Tag`

完整列表: https://lucide.dev/icons/

---

**维护者**: Claude Sonnet 4.5
**最后更新**: 2026-01-26
**项目**: ZenithJoy Autopilot / Core
