---
id: autopilot-features
version: 1.0.0
created: 2026-01-21
updated: 2026-01-21
changelog:
  - 1.0.0: 初始版本 - 从 9 个功能分支整理
---

# ZenithJoy Autopilot - 能力地图

> 这是 Autopilot 的功能清单（What），不包含测试细节。
> 测试定义在 `regression-contract.yaml`（待创建）。

## 功能分类

| 前缀 | 含义 | 说明 |
|------|------|------|
| B | Business | 业务功能（认证、UI 交互） |
| C | Core | Core 实例集成 |
| W | Workflow | AI 员工 / n8n 工作流 |
| I | Infra | 基础设施（CI/CD） |

## 状态定义

| 状态 | 含义 |
|------|------|
| Committed | 已合并到 develop |
| Experiment | 开发中 |
| Deprecated | 已废弃 |

---

## B - Business 功能

### B1 - 飞书认证

| ID | 功能 | 状态 | 分支/PR |
|----|------|------|---------|
| B1-001 | 飞书一键登录按钮 | Committed | #7 |
| B1-002 | 跨子域 Cookie (SameSite=None) | Committed | #8 |
| B1-003 | 飞书按钮颜色调整 | Committed | #9 |
| B1-004 | 多种飞书 SDK 消息格式支持 | Committed | #12 |
| B1-005 | 二维码显示和扫码修复 | Experiment | cp-fix-dashboard-qrcode |

### B2 - 导航与路由

| ID | 功能 | 状态 | 分支/PR |
|----|------|------|---------|
| B2-001 | 场景驱动导航架构 | Committed | #10 |
| B2-002 | 移除 /panorama 重定向 | Committed | #17 |
| B2-003 | 路由配置化 (DynamicRouter) | Experiment | cp-dynamic-router |

---

## C - Core 集成

### C1 - 配置与实例

| ID | 功能 | 状态 | 分支/PR |
|----|------|------|---------|
| C1-001 | 动态 Core 配置加载 | Committed | #16 |
| C1-002 | 个人功能迁移到 Core | Experiment | cp-migrate-personal-to-core |

---

## W - Workflow / AI 员工

### W1 - AI 员工系统

| ID | 功能 | 状态 | 分支/PR |
|----|------|------|---------|
| W1-001 | n8n 工作流抽象为员工视图 | Committed | #13 |
| W1-002 | AI 员工页面加载修复 | Committed | #14 |
| W1-003 | AI 员工界面改进（图标/折叠/详情） | Committed | #15 |

---

## I - Infra 基础设施

### I1 - CI/CD

| ID | 功能 | 状态 | 分支/PR |
|----|------|------|---------|
| I1-001 | CI 工作流（Build Only） | Committed | #18 |
| I1-002 | CD 部署脚本 | Committed | #18 |

---

## 分支状态总结

| 分支 | 状态 | 功能 ID |
|------|------|---------|
| cp-cd-setup | Merged | I1-001, I1-002 |
| cp-01190943-fix-feishu-qrlogin | Merged | B1-004 |
| cp-fix-panorama-redirect | Merged | B2-002 |
| cp-frontend-config-refactor | Merged | C1-001 |
| cp-dynamic-router | **Open** | B2-003 |
| cp-fix-dashboard-qrcode | **Open** | B1-005 |
| cp-migrate-personal-to-core | **Open** | C1-002 |
| cp-qa-dynamic-routes | **Active** | QA 体系建设 |

---

## 待办

- [ ] 创建 `regression-contract.yaml`
- [ ] 定义 Golden Paths（关键用户链路）
- [ ] 补充 Unit 测试
- [ ] CI 增加测试步骤
