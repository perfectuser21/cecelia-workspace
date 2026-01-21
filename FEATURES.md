# ZenithJoy Autopilot - 能力地图

> 由 `/qa` 模式 6 (Feature Discovery) 从代码反推生成
> 主来源：`navigation.config.ts` + `pages/` 目录
>
> **2026-01-21 迁移**：系统监控功能已迁移到 Core

---

## 架构说明

```
┌─────────────────────────────────────────────────────────┐
│              Core（core.zenjoymedia.media）              │
│  ─────────────────────────────────────────────────────  │
│  • 系统首页（HomePage - 监控仪表盘）                      │
│  • Claude 监控                                          │
│  • VPS 监控                                             │
│  • n8n 工作流                                           │
│  • Canvas 画布                                          │
│  • Engine 能力                                          │
│  • Cecilia                                              │
│  • QA 管理                                              │
└─────────────────────────────────────────────────────────┘
                            ↓
                   动态加载配置（InstanceContext）
                            ↓
┌─────────────────────────────────────────────────────────┐
│          Autopilot（autopilot.zenjoymedia.media）        │
│  ─────────────────────────────────────────────────────  │
│  • 工作台 Dashboard（业务仪表盘）                         │
│  • 新媒体运营（核心业务）                                 │
│  • AI 员工系统                                          │
│  • 账号管理                                             │
│  • 飞书认证（共享）                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 仓库信息

| 项目 | 值 |
|------|-----|
| RepoType | **Business** |
| 技术栈 | React + Vite + TypeScript |
| 导航配置 | `src/config/navigation.config.ts` |
| 页面目录 | `src/pages/` |

### 分支保护状态

| 分支 | 保护 | CI 检查 | Force Push |
|------|------|---------|------------|
| main | ✓ | build 必须通过 | 禁止 |
| develop | ✓ | build 必须通过 | 禁止 |

---

## Feature Tree

### F1. 工作台

> 业务仪表盘，每日一言、节日问候、业务概览

| 子功能 | 路由 | 页面 | 说明 |
|--------|------|------|------|
| F1.1 Dashboard | `/` | Dashboard | 业务首页仪表盘 |

**Evidence**: `navigation.config.ts:L87-93`

---

### F2. 新媒体运营

> 核心业务功能，内容采集、发布、数据分析全流程

| 子功能 | 路由 | 页面 | 说明 |
|--------|------|------|------|
| F2.1 场景入口 | `/media` | MediaScenarioPage | 新媒体运营场景主入口 |
| F2.2 内容管理 | `/media/content` | ContentData | 管理待发布内容 |
| F2.3 内容采集 | `/media/content/scraping` | ScrapingPage | 从各平台采集内容 |
| F2.4 发布管理 | `/media/publish` | Tasks | 发布任务队列 |
| F2.5 执行历史 | `/media/publish/history` | ExecutionStatus | 发布执行记录 |
| F2.6 平台状态 | `/media/publish/platforms` | PlatformStatus | 各平台账号状态 |
| F2.7 数据分析 | `/media/data` | PublishStats | 发布效果数据 |

**Evidence**: `navigation.config.ts:L94-99`, `MediaScenarioPage.tsx`

---

### F3. AI 员工系统

> 将 n8n 工作流抽象为"AI 员工"概念，用户友好视图

| 子功能 | 路由 | 页面 | 说明 |
|--------|------|------|------|
| F3.1 员工列表 | `/ai-employees` | AiEmployeesPage | 查看所有 AI 员工 |
| F3.2 员工详情 | `/ai-employees/:id` | AiEmployeeDetailPage | 单个员工能力和配置 |
| F3.3 能力详情 | `/ai-employees/:id/abilities/:aid` | AiAbilityDetailPage | 具体能力说明 |

**Evidence**: `navigation.config.ts:L100-106`, `AiEmployeesPage.tsx`

---

### F4. 账号管理

> 管理社交媒体平台账号，查看账号数据

| 子功能 | 路由 | 页面 | 说明 |
|--------|------|------|------|
| F4.1 账号列表 | `/accounts` | AccountsList | 小红书/抖音/B站/微博账号 |
| F4.2 账号数据 | `/accounts/:id/metrics` | AccountMetrics | 单个账号的数据分析 |

**Evidence**: `navigation.config.ts`, `pages/accounts/AccountsList.tsx`, `pages/accounts/AccountMetrics.tsx`

---

### F5. 认证系统

> 飞书登录，Core 和 Autopilot 共享

| 子功能 | 路由 | 页面 | 说明 |
|--------|------|------|------|
| F5.1 飞书登录 | `/login` | FeishuLogin | 扫码 + 一键登录 |

**Evidence**: `FeishuLogin.tsx`（在 App.tsx 中引用）

---

## 已迁移到 Core 的功能

以下功能已从 Autopilot 移除，访问 `core.zenjoymedia.media`：

| 原功能 | Core Feature | 说明 |
|--------|--------------|------|
| /settings/claude-monitor | claude-monitor | Claude 监控 |
| /settings/vps-monitor | vps-monitor | VPS 监控 |
| /settings/n8n-workflows | n8n | n8n 工作流 |
| /settings/canvas | canvas | Canvas 画布 |
| /settings（入口页） | home | Core 首页 |

---

## 已删除的文件

| 文件 | 原因 |
|------|------|
| AdminSettingsPage.tsx | 功能已迁移到 Core |
| ToolsPage.tsx | 功能已迁移到 Core |
| SettingsPage.tsx | 功能已迁移到 Core |
| VideoEditor.tsx | 无入口，死代码 |
| WebsiteContents.tsx | 无入口，死代码 |
| NotificationCenter.tsx | 无入口，死代码 |
| accounts/PlatformLogin.tsx | 已淘汰（现用其他方式登录平台） |
| LoginPage.tsx | 已淘汰（抖音登录改用 PC 端） |

---

## 功能统计

| Feature | 子功能数 | 状态 |
|---------|----------|------|
| F1. 工作台 | 1 | Done |
| F2. 新媒体运营 | 7 | Done |
| F3. AI 员工系统 | 3 | Done |
| F4. 账号管理 | 2 | Done（+AccountMetrics） |
| F5. 认证系统 | 1 | Done（-平台授权已删） |
| **总计** | **14** | |

---

## 待办

### 高优先级
- [ ] develop → main（里程碑发布）

### 中优先级
- [ ] 创建 `regression-contract.yaml`

### 低优先级
- [ ] 补充 Unit 测试
- [ ] 定义 Golden Paths

### 已完成
- [x] 清理死代码（8 个文件）
- [x] 验证前端构建
- [x] 启用 AccountMetrics（账号数据分析）
- [x] 移除废弃的平台登录功能
