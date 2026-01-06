# ZenithJoy Autopilot

Monorepo 整合项目，包含 Dashboard 和 n8n Workflows 两个核心模块。

## 目录结构

```
zenithjoy-autopilot/
├── apps/
│   └── dashboard/           # 运营中台
│       ├── frontend/        # React 前端
│       ├── core/api/        # Express 后端 (16 模块)
│       └── douyin-api/      # 抖音登录服务 (Python)
├── workflows/               # n8n 工作流
│   ├── exports/         # 导出的 workflow JSON
│   ├── docs/            # 工作流文档
│   ├── templates/       # 工作流模板
│   ├── scripts/         # 工作流相关脚本
│   └── shared/          # 共享配置
├── instances/
│   └── zenithjoy/       # 实例配置
├── scripts/             # 项目级脚本
├── docs/                # 项目文档
└── deploy/              # 部署配置
```

## 模块说明

### apps/dashboard

运营中台，提供：
- 多平台社媒数据可视化
- 账号管理、内容管理
- Session 监控（9 账号登录状态）
- VPS 监控

详见 `apps/dashboard/CLAUDE.md`

### workflows

n8n 工作流管理：
- `exports/bundles/` - 按功能分类的工作流
- `templates/` - 可复用的工作流模板
- `workflow-factory.sh` - 工作流生成工具

详见 `workflows/CLAUDE.md`

## 服务器配置

| 服务 | 端口 | 说明 |
|------|------|------|
| Dashboard | 3333 | API 服务 |
| PostgreSQL | 5432 | 数据库 |
| n8n | 5678 | 工作流引擎 |
| NPM | 80, 81, 3000 | 反向代理 |

**注意**: 443 端口被 VPN 占用，HTTPS 服务使用 3000 端口。

## 开发命令

```bash
# Dashboard 前端
cd apps/dashboard/frontend && pnpm dev

# Dashboard 后端
cd apps/dashboard && docker compose up -d api

# 检查项目结构
./scripts/check-structure.sh
```

## 部署

```bash
# 前端部署
cd apps/dashboard/frontend && pnpm build
docker cp dist/. nginx-proxy-manager:/data/websites/social/

# API 部署
cd apps/dashboard && docker compose build api && docker compose up -d api
```

---

## 禁止删除的关键文件

**严禁删除以下文件和目录**，这些是项目的核心配置和功能模块：

### features/ 目录
```
features/
├── config.sh              # 绝对禁止删除
├── main.sh                # 绝对禁止删除
├── worktree-manager.sh    # 绝对禁止删除
├── business/              # 整个目录禁止删除
└── core/                  # 整个目录禁止删除
```

### 规则
1. **禁止删除整个 features/ 目录或其子目录**
2. **禁止删除 *.sh 脚本文件**（除非用户明确要求）
3. **禁止删除 index.ts 入口文件**
4. **禁止删除 CLAUDE.md 文档**

如果任务要求"清理"或"重构"，应该：
- 修改现有文件内容，而不是删除后重建
- 如需删除，必须先询问用户确认

---

**最后更新**: 2026-01-06
