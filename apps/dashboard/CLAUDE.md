# ZenithJoy Dashboard

内部运营中台，为团队提供多平台社媒数据可视化、内容管理、账号监控等功能。

## 定位

- **类型**: 内部员工使用的运营中台
- **目标**: 统一管理多平台社媒运营数据
- **扩展性**: 可集成 n8n、Coze 等自动化工作流引擎

## 访问地址

| 环境 | URL |
|------|-----|
| Dashboard | https://dashboard.zenjoymedia.media:3000 |
| VNC 登录 | http://146.190.52.84:608X/vnc.html?password=123456 |

## 功能模块

### 已实现

| 模块 | 说明 |
|------|------|
| **工作台** | 运营数据概览 |
| **数据中心** | 内容数据分析、趋势图表 |
| **账号管理** | 多平台账号统一管理 |
| **内容管理** | 内容发布、素材库 |
| **Session 监控** | 9 账号登录状态监控、自动刷新 |
| **Tasks 任务面板** | Notion 任务集成，按用户查看/勾选/新增任务 |

### 规划中

| 模块 | 说明 |
|------|------|
| **工作流集成** | n8n / Coze 工作流可视化管理 |
| **数据采集调度** | 统一的采集任务管理 |
| **通知中心** | 飞书/企微消息推送 |

## 技术架构

```
┌─────────────────────────────────────────┐
│           ZenithJoy Dashboard           │
│         (React + TypeScript)            │
└───────────────────┬─────────────────────┘
                    │ REST API
┌───────────────────▼─────────────────────┐
│              Core API                    │
│            (Express.js)                  │
└───────────────────┬─────────────────────┘
                    │
     ┌──────────────┼──────────────┐
     │              │              │
     ▼              ▼              ▼
┌─────────┐   ┌──────────┐   ┌──────────┐
│PostgreSQL│  │ VNC 容器 │   │ 外部集成 │
│  数据库  │  │ (8平台)  │   │n8n/Coze │
└─────────┘   └──────────┘   └──────────┘
```

## 支持的平台

| 平台 | VNC 端口 | 状态 |
|------|----------|------|
| 抖音 | 6080 | ✅ |
| 快手 | 6081 | ✅ |
| 小红书 | 6082 | ✅ |
| 头条主号 | 6083 | ✅ |
| 微博 | 6084 | ✅ |
| 视频号 | 6085 | ✅ |
| 公众号 | 6086 | ✅ |
| 知乎 | 6087 | ✅ |
| 头条AI测试 | 6088 | ✅ |

## 目录结构

```
zenithjoy_dashboard/
├── frontend/                 # React 前端
│   └── src/
│       ├── api/              # API 调用层
│       ├── components/       # 可复用组件
│       ├── contexts/         # React Context
│       ├── pages/            # 页面组件
│       └── App.tsx           # 路由入口
│
├── core/api/                 # Express 后端（Feature Module 架构）
│   └── src/
│       ├── features/         # 功能模块（每个功能独立目录）
│       │   ├── accounts/     # index.ts + route + service + repository
│       │   ├── metrics/
│       │   ├── session/
│       │   └── ...（共 11 个模块）
│       ├── shared/           # 共享代码
│       │   ├── db/           # 数据库连接
│       │   ├── middleware/   # 中间件
│       │   ├── utils/        # 工具函数
│       │   └── types/        # 类型定义
│       ├── bootstrap.ts      # 模块自动加载
│       └── server.ts         # 服务入口
│
├── database/                 # SQL Schema
├── docker-compose.yml        # 服务编排
└── CLAUDE.md
```

---

## 代码规范（LLM 必读）

### 后端规范

1. **新增 API 模块**
   ```
   features/{name}/
   ├── index.ts           # 导出 router, basePath, requiresAuth
   ├── {name}.route.ts    # 路由定义
   ├── {name}.service.ts  # 业务逻辑
   └── {name}.repository.ts # 数据库操作（可选）
   ```

2. **模块入口模板** (`index.ts`)
   ```typescript
   import { Router } from 'express';
   import route from './{name}.route';

   export const router: Router = route;
   export const basePath = '/v1/{name}';  // 或 /api/{name}
   export const requiresAuth = true;      // 是否需要 API Key

   export { service } from './{name}.service';
   ```

3. **跨模块依赖**
   - ✅ `import { accountsService } from '../accounts'`（从 index.ts）
   - ❌ `import { xxx } from '../accounts/accounts.repository'`（禁止直接导入内部文件）

4. **共享代码放 `shared/`**，不要在模块间复制代码

### 前端规范

1. **页面组件** → `pages/`（一个页面一个文件）
2. **可复用组件** → `components/`（多处使用的 UI 组件）
3. **API 调用** → `api/`（不要在页面里直接写 fetch）
4. **页面太大（>500行）** → 拆分子组件到 `pages/{pageName}/` 或 `components/`

> 通用规范见 `~/.claude/CLAUDE.md`

## 开发命令

```bash
# 前端
cd frontend && pnpm dev           # 开发
cd frontend && pnpm build         # 构建

# 部署前端
docker cp frontend/dist/. nginx-proxy-manager:/data/websites/social/

# 后端
docker compose build api          # 构建
docker compose up -d api          # 启动

# 数据库
docker exec -it social-metrics-postgres psql -U n8n_user -d n8n_social_metrics
```

## 注意事项

1. **端口 3000** - HTTPS 服务使用 3000 端口（443 被 VPN 占用）
2. **nginx 容器化** - 配置在 `nginx-proxy-manager` 容器内
3. **VNC 密码统一** - 所有平台使用 `123456`

---

**最后更新**: 2025-12-23
