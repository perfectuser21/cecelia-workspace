# n8n Workflows

n8n Cloud 工作流系统，集成 Claude Code AI、VPS 远程执行、Windows 远程抓取。

---

## 文档导航

| 文档 | 说明 |
|------|------|
| **[WORKFLOWS.md](./WORKFLOWS.md)** | Workflow 总览、主/子关系、过期清单 |
| **[CLAUDE.md](./CLAUDE.md)** | 项目规范、配置、操作指南 |
| **[CHANGELOG.md](./CHANGELOG.md)** | 变更日志 |
| **[docs/factory/](./docs/factory/)** | AI 工厂文档 |
| **[docs/features/](./docs/features/)** | 功能模块文档 |
| **[templates/](./templates/)** | Workflow 模板库 |
| **[ScheduledCleanup_README.md](./ScheduledCleanup_README.md)** | 定时清理任务 - 项目说明 |
| **[ScheduledCleanup_DEPLOY.md](./ScheduledCleanup_DEPLOY.md)** | 定时清理任务 - 部署步骤 |
| **[ScheduledCleanup_API.md](./ScheduledCleanup_API.md)** | 定时清理任务 - API 文档 |

---

## Workflow 统计

- **总计**: 16 个（全部活跃）

详见 [WORKFLOWS.md](./WORKFLOWS.md)

---

## 核心系统

### 1. 调度器

| 调度器 | ID | 触发时间 | 子 Workflow |
|--------|-----|---------|-------------|
| nightly-scheduler | `YFqEplFiSl5Qd3x9` | 03:00 北京 | 健康检查、备份、清理 |
| 数据采集调度器 | `4zvOIMtubKNF7QC6` | 05:00 北京 | 9 平台爬取 |

### 2. 平台抓取/发布 (瘦客户端架构)

**设计**: 所有脚本在 VPS，Windows 只维护登录态

```
VPS (所有逻辑)                        Windows node (瘦客户端)
┌─────────────────────┐              ┌─────────────────────┐
│ vps_scraper.js      │──Tailscale──▶│ 9 个 Chrome 实例     │
│ vps_publisher.js    │  CDP:19222   │ (只保持登录)         │
│                     │   ~19230     │ file-receiver.js    │
└─────────────────────┘              └─────────────────────┘
```

| 平台 | CDP 端口 | 平台 | CDP 端口 |
|------|----------|------|----------|
| 抖音 | 19222 | 微博 | 19227 |
| 快手 | 19223 | 视频号 | 19228 |
| 小红书 | 19224 | 公众号 | 19229 |
| 头条主号 | 19225 | 知乎 | 19230 |
| 头条副号 | 19226 | | |

### 3. 独立工具

| 名称 | ID | 说明 |
|------|-----|------|
| sync-workflow-changelog | `INcuVEV9PPJaQ7Yg` | 每日同步变更 |
| Trigger Claude via HTTP | `Ar2BwcAElSsexIKC` | HTTP 触发 Claude (备用) |

---

## 快速操作

```bash
# 手动抓取单个平台
node ~/vps_scraper.js douyin

# 全部抓取并同步
bash ~/scrape_and_sync.sh
```

---

## 配置

| 服务 | 地址 |
|------|------|
| n8n Cloud | https://zenithjoy21xx.app.n8n.cloud |
| MCP Server | https://zenithjoy21xx.app.n8n.cloud/mcp-server/http |
| VPS | 146.190.52.84 (user: xx) |
| Windows node | 100.97.242.124 (Tailscale) |

---

## 里程碑

- 2025-12-21: n8n Cloud → SSH → Claude 链路打通
- 2025-12-22: 平台爬取系统上线
- 2025-12-24: 夜间维护系统、AI 工厂创建
- 2025-12-25: 迁移到 Windows 架构
- 2025-12-26: 迁移到新 Windows 机器 (node: 100.97.242.124)
