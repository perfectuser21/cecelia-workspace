# ZenithJoy Autopilot 系统设计规范

> 本文档是整个 Autopilot 系统的"宪法"，定义了架构、规范、模板和工作流程。
> Claude Code / Claude Desktop 在操作此项目时必须遵循本规范。

---

## 1. 系统概述

### 1.1 什么是 Autopilot

Autopilot 是一个**可组合交付的自动化平台**，核心能力是：

- **Feature 模块化**：每个功能是独立的 bundle，可单独版本控制
- **客户实例化**：每个客户有独立配置，选用不同 feature 组合和版本
- **代建交付**：我们部署，客户使用，不是客户自己安装

### 1.2 核心概念

| 概念 | 定义 | 例子 |
|------|------|------|
| **Feature/Bundle** | 一组相关的 n8n workflow + 脚本，解决一类问题 | `ai-factory`、`monitoring` |
| **Instance** | 一个客户/环境的配置，定义用哪些 feature 的哪个版本 | `zenithjoy`、`dad` |
| **Manifest** | Feature 的元信息文件，定义版本、组件、依赖 | `manifest.yml` |
| **Stack** | Instance 的配置文件，定义 feature 组合 | `stack.yml` |
| **Delivery** | 交付包快照，记录某次交付的完整状态 | `deliveries/dad-2025-12-29/` |

### 1.3 设计原则

1. **单一 Repo**：所有 feature 在同一个 repo，通过 manifest 管理版本
2. **配置即文档**：stack.yml 就是客户的"合同"，一看就知道用了什么
3. **可追溯**：每次交付都有快照，能回答"客户 X 现在用的是什么"
4. **Claude 可操作**：所有规范都有模板，Claude Code 能自动执行

---

## 2. 目录结构

```
zenithjoy-autopilot/
│
├── apps/                           # 应用程序
│   └── dashboard/                  # 运营中台（核心平台）
│       ├── core/api/               # 后端 API
│       ├── frontend/               # React 前端
│       └── douyin-api/             # 抖音登录服务
│
├── workflows/                      # n8n 工作流
│   ├── exports/bundles/            # Feature Bundles（核心！）
│   │   ├── _template/              # 新 feature 模板
│   │   ├── ai-factory/             # Feature: AI 工厂
│   │   ├── content-publish/        # Feature: 内容发布
│   │   ├── data-collection/        # Feature: 数据采集
│   │   ├── monitoring/             # Feature: 监控
│   │   └── nightly-maintenance/    # Feature: 夜间维护
│   │
│   ├── shared/                     # 共享脚本（被多个 feature 依赖）
│   │   ├── claude-executor/        # Claude 执行器
│   │   └── feishu-notify/          # 飞书通知
│   │
│   ├── templates/                  # Workflow 模板（创建新 workflow 用）
│   └── CLAUDE.md                   # Workflow 开发规则
│
├── instances/                      # 客户/环境实例
│   ├── _template/                  # 新实例模板
│   ├── develop/                    # 开发环境（最新，可能不稳定）
│   ├── zenithjoy/                  # 悦升云端（自己公司，稳定版）
│   └── dad/                        # 爸爸公司（稳定版，不同组合）
│
├── deliveries/                     # 交付包快照（可选，按需创建）
│   └── {instance}-{date}/          # 每次交付一个目录
│
├── docs/                           # 文档
│   ├── AUTOPILOT_SYSTEM_SPEC.md    # 本文档（系统规范）
│   └── skills/                     # Claude Skills 定义
│
├── scripts/                        # 项目级脚本
├── deploy/                         # 部署配置
└── CLAUDE.md                       # 全局规则
```

---

## 3. Feature/Bundle 规范

### 3.1 Feature 目录结构

每个 Feature 必须包含：

```
workflows/exports/bundles/{feature-name}/
├── manifest.yml          # 必须：Feature 元信息
├── *.json                # 必须：n8n workflow 文件
├── README.md             # 可选：Feature 说明
└── scripts/              # 可选：辅助脚本
```

### 3.2 manifest.yml 规范

```yaml
# Feature 元信息
name: ai-factory                    # 必须：Feature 名称（与目录名一致）
description: AI工厂：自动化生产 workflow 和代码库  # 必须：一句话描述
version: 1.2.0                      # 必须：当前版本（semver）
status: stable                      # 必须：stable | beta | deprecated

# 组件列表（该 Feature 包含的 workflow）
components:
  workflow-factory:                 # 组件名
    file: workflow-factory.json     # 对应的 JSON 文件
    n8n_id: VQSeOX886lchEATW        # n8n 中的 workflow ID
    description: 根据 PRD 创建/修改 n8n workflow
    required: true                  # 是否必须启用

  codebase-factory:
    file: codebase-factory.json
    n8n_id: cIFvRTzOAxk7GA06
    description: 根据 PRD 创建代码库
    required: true

  vibe-coding-master:
    file: vibe-coding-master.json
    n8n_id: BO6V3MYDHVp2bkvd
    description: Vibe Coding 主控流程
    required: false                 # 可选组件

# 依赖（该 Feature 依赖的 shared 模块）
dependencies:
  - shared/claude-executor@1.0.0
  - shared/feishu-notify@1.0.0

# 配置项（部署时需要填写的）
config:
  - name: CLAUDE_API_KEY
    description: Claude API 密钥
    required: true
  - name: FEISHU_WEBHOOK
    description: 飞书通知 Webhook
    required: false

# 变更历史
changelog:
  - version: 1.2.0
    date: 2025-12-29
    changes:
      - 添加 Feature Validator（入口检查 + 完成同步）
  - version: 1.1.0
    date: 2025-12-26
    changes:
      - 添加 Vibe Coding 主控 workflow
  - version: 1.0.0
    date: 2025-12-24
    changes:
      - 初始版本，workflow-factory + codebase-factory
```

### 3.3 版本号规则（Semver）

| 变更类型 | 版本升级 | 例子 |
|---------|---------|------|
| 破坏性变更（不兼容） | major: X.0.0 | 删除 workflow、改接口 |
| 新功能（向后兼容） | minor: 0.X.0 | 添加新 workflow、新参数 |
| 修复/优化（向后兼容） | patch: 0.0.X | bug 修复、性能优化 |

### 3.4 Feature 状态

| 状态 | 含义 | 可交付 |
|------|------|--------|
| `stable` | 稳定版，经过测试 | 可以交付给客户 |
| `beta` | 测试版，功能完整但未充分测试 | 只给 develop 实例 |
| `deprecated` | 废弃，不再维护 | 不应再使用 |

---

## 4. Instance/Stack 规范

### 4.1 Instance 目录结构

每个 Instance 必须包含：

```
instances/{instance-name}/
├── stack.yml             # 必须：实例配置
├── credentials.yml       # 可选：凭据配置（不提交 git）
└── notes.md              # 可选：备注
```

### 4.2 stack.yml 规范

```yaml
# 实例元信息
instance: zenithjoy                 # 必须：实例名称（与目录名一致）
description: 悦升云端（自己公司）     # 必须：实例描述
environment: production             # 必须：production | staging | development
created_at: 2025-12-29              # 必须：创建日期
updated_at: 2025-12-29              # 必须：最后更新日期

# n8n 配置
n8n:
  server: https://zenithjoy21xx.app.n8n.cloud
  # credentials 在 credentials.yml 中，不提交 git

# Feature 选配（核心！）
features:
  ai-factory:
    version: 1.2.0                  # 使用的版本
    enabled: true                   # 是否启用
    components:                     # 组件级控制（可选）
      workflow-factory: true
      codebase-factory: true
      vibe-coding-master: false     # 不启用这个组件

  content-publish:
    version: 1.0.0
    enabled: true

  data-collection:
    version: 1.0.0
    enabled: true
    components:
      douyin: true
      kuaishou: true
      xiaohongshu: true
      toutiao: true
      weibo: true
      # zhihu: false  # 未列出 = 不启用

  monitoring:
    version: 1.0.0
    enabled: true

  nightly-maintenance:
    version: 1.0.0
    enabled: true

# 实例特定配置
config:
  timezone: Asia/Shanghai
  notification_hours: "07:30-22:30"  # 通知时间段

# 交付记录
deliveries:
  - date: 2025-12-29
    features:
      ai-factory: 1.2.0
      monitoring: 1.0.0
    notes: 首次部署
```

### 4.3 环境类型

| 环境 | 用途 | 稳定性要求 |
|------|------|-----------|
| `development` | 开发测试，最新代码 | 可以不稳定 |
| `staging` | 预发布，准备交付 | 应该稳定 |
| `production` | 正式客户使用 | 必须稳定 |

---

## 5. 交付流程规范

### 5.1 交付前检查清单

```markdown
## 交付检查清单

### Feature 检查
- [ ] 所有选用的 feature 的 manifest.yml 存在且完整
- [ ] 所有 feature 版本 >= 1.0.0（stable）
- [ ] 所有依赖的 shared 模块存在

### Workflow 检查
- [ ] 所有 workflow JSON 文件存在
- [ ] n8n_id 与实际 n8n 中的 ID 一致
- [ ] 必须的 credentials 已配置

### 配置检查
- [ ] stack.yml 中的 feature 版本与 manifest 版本一致
- [ ] 所有 required config 已填写
```

### 5.2 交付包结构（可选）

如果需要保存交付快照：

```
deliveries/{instance}-{YYYY-MM-DD}/
├── stack.yml                 # 交付时的 stack 配置
├── manifest-snapshot.yml     # 所有 feature 的 manifest 合并
├── workflows/                # workflow JSON 副本
│   ├── ai-factory/
│   └── monitoring/
└── delivery-notes.md         # 交付备注
```

### 5.3 交付记录

每次交付后，更新 stack.yml 的 `deliveries` 字段：

```yaml
deliveries:
  - date: 2025-12-29
    features:
      ai-factory: 1.2.0
      monitoring: 1.0.0
    notes: 首次部署
  - date: 2025-12-30
    features:
      ai-factory: 1.3.0      # 升级了
      monitoring: 1.0.0
    notes: 升级 AI 工厂，添加新功能
```

---

## 6. 分支与版本策略

### 6.1 Git 分支

```
main ─────────────────────────────────→ 稳定版（可交付）
  │
  └── develop ────────────────────────→ 开发版（最新，可能不稳定）
         │
         └── feature/xxx ─────────────→ 某个新功能开发中
```

### 6.2 版本标签

Feature 版本用目录内的 `manifest.yml` 管理，不用 git tag。

如果需要标记整体里程碑，用 git tag：
- `v2025.12.29` - 日期版本
- `release-1.0` - 里程碑版本

### 6.3 版本升级流程

1. 在 `develop` 分支修改 feature
2. 更新 `manifest.yml` 的 version 和 changelog
3. 测试通过后合并到 `main`
4. 更新客户 instance 的 `stack.yml` 中的版本号
5. 执行交付

---

## 7. Claude Code 操作规范

### 7.1 创建新 Feature

```bash
# 步骤
1. 复制 workflows/exports/bundles/_template/ 到新目录
2. 修改 manifest.yml：name、description、version: 0.1.0、status: beta
3. 添加 workflow JSON 文件
4. 更新 workflows/CLAUDE.md 的 feature 列表
```

### 7.2 升级 Feature 版本

```bash
# 步骤
1. 修改 workflow 或添加新功能
2. 确定版本类型：patch（修复）/ minor（新功能）/ major（破坏性）
3. 更新 manifest.yml 的 version
4. 在 changelog 添加记录
5. 如果是 stable 版本，通知需要更新的 instance
```

### 7.3 创建新 Instance

```bash
# 步骤
1. 复制 instances/_template/ 到新目录
2. 修改 stack.yml：instance、description、environment
3. 选择需要的 features 和版本
4. 配置 n8n server 和 credentials
```

### 7.4 交付给客户

```bash
# 步骤
1. 确认 instance 的 stack.yml 配置正确
2. 执行交付检查清单
3. 在 n8n 中导入/更新 workflow
4. 配置 credentials
5. 启用 workflow
6. 更新 stack.yml 的 deliveries 记录
7. （可选）创建 deliveries/{instance}-{date}/ 快照
```

---

## 8. 模板文件

### 8.1 Feature 模板：_template/manifest.yml

```yaml
name: feature-name
description: 一句话描述这个 Feature 做什么
version: 0.1.0
status: beta

components:
  main-workflow:
    file: main.json
    n8n_id: null  # 部署后填写
    description: 主工作流
    required: true

dependencies: []

config: []

changelog:
  - version: 0.1.0
    date: YYYY-MM-DD
    changes:
      - 初始版本
```

### 8.2 Instance 模板：_template/stack.yml

```yaml
instance: instance-name
description: 实例描述
environment: production
created_at: YYYY-MM-DD
updated_at: YYYY-MM-DD

n8n:
  server: https://xxx.app.n8n.cloud

features:
  # 取消注释需要的 feature
  # ai-factory:
  #   version: 1.0.0
  #   enabled: true
  # content-publish:
  #   version: 1.0.0
  #   enabled: true

config:
  timezone: Asia/Shanghai

deliveries: []
```

---

## 9. 当前 Feature 清单

| Feature | 版本 | 状态 | 说明 |
|---------|------|------|------|
| ai-factory | 1.2.0 | stable | AI 工厂：自动生产 workflow 和代码库 |
| content-publish | 1.0.0 | stable | 内容发布：一键发布到 9 个平台 |
| data-collection | 1.0.0 | stable | 数据采集：6 平台数据抓取 |
| monitoring | 1.0.0 | stable | 监控：VPS 健康检查 |
| nightly-maintenance | 1.0.0 | stable | 夜间维护：备份、清理、健康检查 |

---

## 10. 当前 Instance 清单

| Instance | 环境 | 说明 | Features |
|----------|------|------|----------|
| develop | development | 开发环境 | 全部最新版 |
| zenithjoy | production | 悦升云端（自己公司） | 全部 |
| dad | production | 爸爸公司 | 待定 |

---

## 附录：常见问题

### Q: 什么时候该创建新 Feature vs 在现有 Feature 加功能？

**创建新 Feature**：
- 解决一个全新的问题领域
- 可以独立交付给客户
- 与现有 feature 没有强耦合

**在现有 Feature 加功能**：
- 是现有功能的扩展
- 依赖现有 feature 的其他组件
- 客户通常会一起使用

### Q: 如何处理 Feature 之间的依赖？

1. 尽量避免 Feature 之间直接依赖
2. 共享功能放到 `shared/` 目录
3. 如果必须依赖，在 manifest.yml 的 dependencies 中声明

### Q: Instance 的 credentials 怎么管理？

1. 不要把密钥提交到 git
2. 使用 `credentials.yml`（加入 .gitignore）
3. 或者只在 n8n 中配置，stack.yml 只记录"已配置"状态
