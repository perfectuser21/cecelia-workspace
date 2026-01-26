---
id: claude-md-cecelia-workspace
version: 1.0.0
created: 2026-01-26
updated: 2026-01-26
changelog:
  - 1.0.0: 初始版本
---

# ZenithJoy Autopilot / Cecelia Workspace

## 项目概述

**仓库**: `perfectuser21/zenithjoy-autopilot`
**类型**: Monorepo
**技术栈**: React + Vite + TypeScript + Node.js

这是 ZenithJoy 的核心工作区，包含：
- Cecelia 无头 Claude Code 执行引擎
- Dashboard 前端（Core + Autopilot 实例）
- 后端 API 服务
- N8N 工作流集成

---

## 项目结构

```
cecelia-workspace/
├── apps/
│   └── cecelia-frontend/        # Cecelia 前端（如果有）
├── backend/                     # 后端服务
├── dashboard/                   # 主 Dashboard 前端
│   ├── src/
│   ├── dist/                   # 生产构建（Core 实例，端口 5211）
│   └── dist-dev/               # 开发构建（Core Dev，端口 5212）
├── features/                    # 功能模块
├── workflows/                   # N8N 工作流
├── data-cecelia/               # Cecelia 数据
├── scripts/                    # 工具脚本
└── docker-compose.yml          # Docker 编排
```

---

## 实例配置

### Dashboard 多实例部署

| 实例 | 域名 | 端口 | 构建目录 | 配色 |
|------|------|------|----------|------|
| Core 生产 | core.zenjoymedia.media | 5211 | dist | 蓝色主题 |
| Autopilot 生产 | autopilot.zenjoymedia.media | 5211 | dist | 紫色主题 |
| Core 开发 | dev-core.zenjoymedia.media | 5212 | dist-dev | 蓝色主题 |
| Autopilot 开发 | dev-autopilot.zenjoymedia.media | 5212 | dist-dev | 紫色主题 |

**重要**: 所有域名共用一套代码，通过域名自动切换实例配置。

---

## 开发规则

### 前端开发

1. **本地开发**
   ```bash
   cd dashboard
   npm run dev  # 启动 Vite 开发服务器
   ```

2. **生产构建**
   ```bash
   cd dashboard
   npm run build        # 构建到 dist/（生产）
   npm run build:dev    # 构建到 dist-dev/（开发）
   ```

3. **实例检测**
   - 前端通过 `window.location.hostname` 检测当前域名
   - 根据域名自动加载对应实例配置（Core/Autopilot）
   - 配置文件位置: `dashboard/src/config/instances.ts`

### 后端开发

1. **API 服务**
   ```bash
   cd backend
   npm run dev  # 开发模式
   npm start    # 生产模式
   ```

2. **Cecelia API**
   - 使用 `cecelia-api` 命令行工具管理状态
   - Core 数据库是原生数据源
   - Notion 仅作为镜像显示

---

## 禁止操作

### 端口禁区

**绝对不要占用以下端口**：
- `443`: VPN (xray-reality)
- `80, 81`: Nginx Proxy Manager
- `3456, 5173`: Claude Monitor
- `5211`: Core 生产实例
- `5212`: Core 开发实例

### 文件保护

**禁止删除或重命名**：
- `dashboard/dist/` - Core 生产构建
- `dashboard/dist-dev/` - Core 开发构建
- `data-cecelia/` - Cecelia 数据
- `.git/` - Git 仓库

**禁止直接修改生产构建**：
- 修改代码后必须重新构建，不能直接编辑 dist 文件

---

## 常用命令

### 前端

```bash
# 开发
cd dashboard && npm run dev

# 构建生产
cd dashboard && npm run build

# 构建开发
cd dashboard && npm run build:dev

# 类型检查
cd dashboard && npm run type-check

# Lint
cd dashboard && npm run lint
```

### Docker

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止所有服务
docker-compose down
```

### Cecelia

```bash
# 执行单个任务
cecelia-run <project> <prd_file>

# 批量执行
cecelia-batch <prd_directory>

# 查看状态
cecelia-api get-overview

# 同步到 Notion
cecelia-api sync-to-notion <run_id>
```

---

## CI/CD

### GitHub Actions

- **分支**: `develop` (主开发线)
- **保护分支**: `main`, `develop`（禁止直接 push，必须 PR）
- **CI 流程**: Lint → Type Check → Build → Test

### 部署流程

```
本地开发 → cp-* 分支 → PR → CI 通过 → 合并到 develop → 手动部署
```

手动部署：
```bash
# 构建前端
cd dashboard && npm run build

# 重启服务（如果需要）
docker-compose restart nginx
```

---

## Cecelia 集成

### 工作流

1. **N8N 调度**: Task Dispatcher v2.0（每 5 分钟轮询 Notion）
2. **Webhook 触发**: `POST /webhook/task-dispatcher`
3. **批量执行**: `cecelia-batch <dir>`

### 状态追踪

所有执行状态存储在 Core 数据库：
- `/api/cecelia/runs` - 任务列表
- `/api/cecelia/runs/:id` - 任务详情
- `/api/cecelia/overview` - 概览数据

Notion 作为镜像同步显示。

---

## 调试

### 查看日志

```bash
# Cecelia 执行日志
tail -f /tmp/cecelia-*.log

# N8N 日志
docker logs -f n8n-self-hosted

# Nginx 日志
docker logs -f nginx-proxy-manager
```

### 常见问题

1. **实例检测失败**
   - 检查 `dashboard/src/config/instances.ts`
   - 确认域名配置正确

2. **构建失败**
   - 清理缓存: `rm -rf dashboard/node_modules dashboard/dist`
   - 重新安装: `cd dashboard && npm install`

3. **Cecelia 任务卡住**
   - 检查并发锁: `ls /tmp/cecelia-lock-*`
   - 手动清理: `rm /tmp/cecelia-lock-*`

---

## 相关文档

- 全局规则: `/home/xx/.claude/CLAUDE.md`
- 端口映射: `/home/xx/.claude/PORT_MAPPING.md`
- Cecelia 触发: `/home/xx/dev/Cecelia-OS/docs/HOW_TO_TRIGGER_CECELIA.md`
- Skills: `/home/xx/.claude/skills/*/SKILL.md`
