# 跨 Repo QA 管理架构设计

> 解决跨仓库质检管理混乱的问题
>
> 创建时间：2026-01-27
> 状态：🎯 方案设计

---

## 1. 问题陈述

### 当前痛点

**用户描述**："我怎么样做一个前台的 Agent 能够看我们所有的 Repo，去做核心的管理？现在跨 Repo 管理很乱，有时候开发功能的时候涉及到质检，但有时候想到质检的时候又开发到不同的 Repo，就很乱。"

**核心问题**：
1. ❌ 多个 Repos，每个都有自己的 FEATURES.md、QA-DECISION.md、AUDIT-REPORT.md
2. ❌ 开发功能时需要跨 Repo，质检时也需要跨 Repo
3. ❌ 没有统一的视图看到所有 Repos 的质检状态
4. ❌ 没有统一的编排机制管理跨 Repo 的质检流程

### 现有 Repos（示例）

```
ZenithJoy 生态系统:
├── cecelia-workspace (Workspace Repo)
│   ├── apps/dashboard (Autopilot + Core Frontend)
│   ├── apps/core (Core API)
│   └── apps/cecelia-frontend (Cecelia 可视化)
│
├── other-business-repo-1 (假设存在)
├── other-business-repo-2 (假设存在)
└── ...
```

每个 Repo 都有：
- FEATURES.md（能力地图）
- regression-contract.yaml（回归契约，应该有）
- docs/QA-DECISION.md（QA 决策）
- docs/AUDIT-REPORT.md（审计报告）

**问题**：这些产物分散在各个 Repo，无法统一管理。

---

## 2. 解决方案：中央 QA Dashboard + Core API

### 2.1 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    QA Dashboard (前端界面)                        │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐            │
│  │ Repos 总览  │  │ Features 列表│  │ RCI 状态墙  │            │
│  │ - 3 个 Repos│  │ - 跨 Repo    │  │ - 跨 Repo   │            │
│  │ - 状态汇总  │  │ - 按优先级   │  │ - Pass/Fail │            │
│  └─────────────┘  └──────────────┘  └─────────────┘            │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐            │
│  │ QA Decisions│  │ Audit Reports│  │ 跨 Repo 执行│            │
│  │ - 最近决策  │  │ - 最近审计   │  │ - 一键质检  │            │
│  └─────────────┘  └──────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                             ↓ REST API
┌─────────────────────────────────────────────────────────────────┐
│                   Core API (QA Controller)                       │
│                                                                 │
│  /api/qa/repos                   - 获取所有 Repos 列表          │
│  /api/qa/features                - 获取所有 Features（跨 Repo） │
│  /api/qa/rci                     - 获取所有 RCI 状态            │
│  /api/qa/golden-paths            - 获取所有 Golden Paths        │
│  /api/qa/decisions               - 获取所有 QA Decisions        │
│  /api/qa/audits                  - 获取所有 Audit Reports       │
│  /api/qa/execute                 - 执行跨 Repo 质检             │
│  /api/qa/sync                    - 同步所有 Repos 的 QA 数据    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                             ↓ 文件系统 / Git
┌─────────────────────────────────────────────────────────────────┐
│                         各个 Repos                               │
│                                                                 │
│  cecelia-workspace/                                             │
│    ├── FEATURES.md                                              │
│    ├── regression-contract.yaml                                 │
│    ├── docs/QA-DECISION.md                                      │
│    └── docs/AUDIT-REPORT.md                                     │
│                                                                 │
│  other-repo-1/                                                  │
│    ├── FEATURES.md                                              │
│    ├── regression-contract.yaml                                 │
│    ├── docs/QA-DECISION.md                                      │
│    └── docs/AUDIT-REPORT.md                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 核心组件设计

### 3.1 Repos Registry（Repos 注册表）

**位置**：`apps/core/config/repos-registry.yaml`

**内容**：
```yaml
# ZenithJoy Repos Registry
version: 1.0.0
updated: 2026-01-27

repos:
  - id: cecelia-workspace
    name: "Cecelia Workspace"
    type: Workspace
    path: /home/xx/dev/cecelia-workspace
    git_url: https://github.com/ZenithJoycloud/cecelia-workspace
    main_branch: develop
    features_file: FEATURES.md
    rci_file: regression-contract.yaml
    owner: Core Team
    priority: P0
    sync_enabled: true

  - id: other-business-repo-1
    name: "Business Repo 1"
    type: Business
    path: /home/xx/dev/other-business-repo-1
    git_url: https://github.com/ZenithJoycloud/other-business-repo-1
    main_branch: main
    features_file: FEATURES.md
    rci_file: regression-contract.yaml
    owner: Business Team
    priority: P1
    sync_enabled: true

  - id: other-business-repo-2
    name: "Business Repo 2"
    type: Business
    path: /home/xx/dev/other-business-repo-2
    git_url: https://github.com/ZenithJoycloud/other-business-repo-2
    main_branch: main
    features_file: FEATURES.md
    rci_file: regression-contract.yaml
    owner: Business Team
    priority: P2
    sync_enabled: false  # 暂不同步
```

---

### 3.2 Core API 端点设计

#### 3.2.1 GET /api/qa/repos

**功能**：获取所有 Repos 列表

**响应**：
```json
{
  "repos": [
    {
      "id": "cecelia-workspace",
      "name": "Cecelia Workspace",
      "type": "Workspace",
      "path": "/home/xx/dev/cecelia-workspace",
      "owner": "Core Team",
      "priority": "P0",
      "sync_enabled": true,
      "last_sync": "2026-01-27T10:00:00Z",
      "status": {
        "features_count": 12,
        "rci_count": 15,
        "golden_paths_count": 6,
        "last_qa_decision": "2026-01-27T09:30:00Z",
        "last_audit": "2026-01-27T09:45:00Z"
      }
    },
    {
      "id": "other-business-repo-1",
      "name": "Business Repo 1",
      "type": "Business",
      "path": "/home/xx/dev/other-business-repo-1",
      "owner": "Business Team",
      "priority": "P1",
      "sync_enabled": true,
      "last_sync": "2026-01-27T09:50:00Z",
      "status": {
        "features_count": 8,
        "rci_count": 10,
        "golden_paths_count": 3,
        "last_qa_decision": "2026-01-26T16:00:00Z",
        "last_audit": "2026-01-26T16:15:00Z"
      }
    }
  ],
  "summary": {
    "total_repos": 2,
    "total_features": 20,
    "total_rci": 25,
    "total_golden_paths": 9
  }
}
```

---

#### 3.2.2 GET /api/qa/features

**功能**：获取所有 Features（跨 Repo）

**参数**：
- `repo_id` (可选): 过滤特定 Repo
- `priority` (可选): 过滤优先级 (P0/P1/P2)
- `has_rci` (可选): 过滤是否有 RCI

**响应**：
```json
{
  "features": [
    {
      "id": "F-AUTH",
      "name": "飞书认证",
      "repo_id": "cecelia-workspace",
      "repo_name": "Cecelia Workspace",
      "category": "Foundation",
      "priority": "P0",
      "has_rci": true,
      "has_golden_path": true,
      "rci_ids": ["RCI-F-001", "RCI-F-002", "RCI-F-003"],
      "golden_path_ids": ["GP-AUTH-001", "GP-AUTH-002"],
      "status": {
        "rci_pass_rate": "100%",
        "last_rci_run": "2026-01-27T08:00:00Z",
        "last_gp_run": "2026-01-26T20:00:00Z"
      }
    },
    {
      "id": "F-MEDIA",
      "name": "新媒体运营",
      "repo_id": "cecelia-workspace",
      "repo_name": "Cecelia Workspace",
      "category": "Business",
      "priority": "P0",
      "has_rci": true,
      "has_golden_path": true,
      "rci_ids": ["RCI-B-001", "RCI-B-002", "RCI-B-003", "RCI-B-004", "RCI-B-005"],
      "golden_path_ids": ["GP-MEDIA-001", "GP-MEDIA-002"],
      "status": {
        "rci_pass_rate": "80%",
        "last_rci_run": "2026-01-27T07:30:00Z",
        "last_gp_run": "2026-01-26T19:00:00Z",
        "failed_rci": ["RCI-B-003"]
      }
    }
  ],
  "summary": {
    "total_features": 20,
    "by_priority": {
      "P0": 4,
      "P1": 6,
      "P2": 2
    },
    "by_category": {
      "Foundation": 3,
      "Business": 4,
      "Platform": 5
    }
  }
}
```

---

#### 3.2.3 GET /api/qa/rci

**功能**：获取所有 RCI 状态（跨 Repo）

**参数**：
- `repo_id` (可选): 过滤特定 Repo
- `priority` (可选): 过滤优先级 (P0/P1/P2)
- `status` (可选): 过滤状态 (pass/fail/pending)

**响应**：
```json
{
  "rci_items": [
    {
      "id": "RCI-F-001",
      "desc": "飞书登录必须可用",
      "repo_id": "cecelia-workspace",
      "feature_id": "F-AUTH",
      "priority": "P0",
      "trigger": ["PR", "Release"],
      "test_cmd": "npm run test -- tests/auth/feishu-login.test.ts",
      "status": "pass",
      "last_run": "2026-01-27T08:00:00Z",
      "pass_rate_7d": "100%",
      "avg_duration": "2.5s"
    },
    {
      "id": "RCI-B-003",
      "desc": "发布任务不能丢失",
      "repo_id": "cecelia-workspace",
      "feature_id": "F-MEDIA",
      "priority": "P0",
      "trigger": ["PR", "Release"],
      "test_cmd": "npm run test -- tests/media/publish-queue.test.ts",
      "status": "fail",
      "last_run": "2026-01-27T07:30:00Z",
      "pass_rate_7d": "85%",
      "avg_duration": "5.2s",
      "failure_reason": "AssertionError: Expected task in queue, but not found"
    }
  ],
  "summary": {
    "total_rci": 25,
    "pass": 23,
    "fail": 2,
    "pending": 0,
    "pass_rate": "92%"
  }
}
```

---

#### 3.2.4 GET /api/qa/decisions

**功能**：获取所有 QA Decisions（跨 Repo）

**参数**：
- `repo_id` (可选): 过滤特定 Repo
- `decision` (可选): 过滤决策类型 (NO_RCI/MUST_ADD_RCI/UPDATE_RCI)
- `limit` (可选): 限制返回数量（默认 20）

**响应**：
```json
{
  "decisions": [
    {
      "id": "qa-decision-001",
      "repo_id": "cecelia-workspace",
      "branch": "cp-26012710-add-changelog-semver",
      "created_at": "2026-01-27T09:30:00Z",
      "decision": "NO_RCI",
      "priority": "P2",
      "repo_type": "Business",
      "tests": [
        {
          "dod_item": "ALLOWED_REPOS 数组更新",
          "method": "manual",
          "location": "manual:代码审查确认数组内容正确"
        }
      ],
      "rci": {
        "new": [],
        "update": []
      },
      "reason": "重构工作，更新仓库名称引用，不影响运行时行为，无需回归测试"
    },
    {
      "id": "qa-decision-002",
      "repo_id": "other-business-repo-1",
      "branch": "feature/user-profile",
      "created_at": "2026-01-26T16:00:00Z",
      "decision": "MUST_ADD_RCI",
      "priority": "P0",
      "repo_type": "Business",
      "tests": [
        {
          "dod_item": "用户能查看个人资料",
          "method": "auto",
          "location": "tests/profile/view.test.ts",
          "rci_id": "RCI-U-001"
        }
      ],
      "rci": {
        "new": ["RCI-U-001"],
        "update": []
      },
      "reason": "核心用户功能，必须纳入回归测试"
    }
  ],
  "summary": {
    "total_decisions": 45,
    "by_decision": {
      "NO_RCI": 30,
      "MUST_ADD_RCI": 10,
      "UPDATE_RCI": 5
    }
  }
}
```

---

#### 3.2.5 POST /api/qa/execute

**功能**：执行跨 Repo 质检

**请求体**：
```json
{
  "repos": ["cecelia-workspace", "other-business-repo-1"],
  "scope": "pr",  // pr | release | nightly
  "priority": ["P0", "P1"],  // 可选，过滤优先级
  "parallel": true  // 是否并行执行
}
```

**响应**：
```json
{
  "execution_id": "exec-001",
  "status": "running",
  "repos": [
    {
      "repo_id": "cecelia-workspace",
      "status": "running",
      "started_at": "2026-01-27T10:00:00Z"
    },
    {
      "repo_id": "other-business-repo-1",
      "status": "queued"
    }
  ],
  "estimated_duration": "5m"
}
```

**轮询进度**：`GET /api/qa/execute/{execution_id}`

```json
{
  "execution_id": "exec-001",
  "status": "completed",
  "started_at": "2026-01-27T10:00:00Z",
  "completed_at": "2026-01-27T10:04:30Z",
  "duration": "4m30s",
  "repos": [
    {
      "repo_id": "cecelia-workspace",
      "status": "success",
      "rci_results": {
        "total": 15,
        "pass": 15,
        "fail": 0
      },
      "logs": "https://core-api/logs/exec-001/cecelia-workspace"
    },
    {
      "repo_id": "other-business-repo-1",
      "status": "failed",
      "rci_results": {
        "total": 10,
        "pass": 8,
        "fail": 2
      },
      "failed_rci": ["RCI-U-003", "RCI-U-005"],
      "logs": "https://core-api/logs/exec-001/other-business-repo-1"
    }
  ],
  "summary": {
    "total_rci": 25,
    "pass": 23,
    "fail": 2,
    "pass_rate": "92%"
  }
}
```

---

#### 3.2.6 POST /api/qa/sync

**功能**：同步所有 Repos 的 QA 数据

**请求体**：
```json
{
  "repos": ["cecelia-workspace", "other-business-repo-1"],  // 可选，不传则同步所有
  "force": false  // 是否强制重新解析
}
```

**响应**：
```json
{
  "sync_id": "sync-001",
  "status": "running",
  "repos": [
    {
      "repo_id": "cecelia-workspace",
      "status": "syncing",
      "files": ["FEATURES.md", "regression-contract.yaml", "docs/QA-DECISION.md"]
    },
    {
      "repo_id": "other-business-repo-1",
      "status": "queued"
    }
  ]
}
```

**轮询进度**：`GET /api/qa/sync/{sync_id}`

```json
{
  "sync_id": "sync-001",
  "status": "completed",
  "started_at": "2026-01-27T10:05:00Z",
  "completed_at": "2026-01-27T10:05:15Z",
  "duration": "15s",
  "repos": [
    {
      "repo_id": "cecelia-workspace",
      "status": "success",
      "synced": {
        "features": 12,
        "rci": 15,
        "golden_paths": 6,
        "qa_decisions": 1,
        "audits": 1
      }
    },
    {
      "repo_id": "other-business-repo-1",
      "status": "success",
      "synced": {
        "features": 8,
        "rci": 10,
        "golden_paths": 3,
        "qa_decisions": 2,
        "audits": 2
      }
    }
  ]
}
```

---

### 3.3 QA Dashboard 前端设计

**路由**：`/qa-dashboard`

**页面结构**：

```
QA Dashboard
├── Repos 总览（默认页）
│   ├── Repos 列表卡片
│   │   ├── Repo 名称 + 类型 + 优先级
│   │   ├── Features 数量
│   │   ├── RCI 通过率
│   │   ├── 最近 QA Decision
│   │   └── 最近 Audit
│   ├── 统计摘要
│   │   ├── 总 Repos 数
│   │   ├── 总 Features 数
│   │   ├── 总 RCI 数
│   │   └── 整体通过率
│   └── 快速操作
│       ├── 同步所有 Repos
│       ├── 执行全量质检
│       └── 查看失败的 RCI
│
├── Features 列表
│   ├── 过滤器（Repo / 优先级 / 分类）
│   ├── Features 表格
│   │   ├── Feature ID + 名称
│   │   ├── Repo
│   │   ├── 分类（Foundation/Business/Platform）
│   │   ├── 优先级
│   │   ├── RCI 数量 + 通过率
│   │   ├── Golden Path 数量
│   │   └── 操作（查看详情 / 执行质检）
│   └── 批量操作
│       └── 执行选中 Features 的质检
│
├── RCI 状态墙
│   ├── 过滤器（Repo / 优先级 / 状态）
│   ├── RCI 卡片网格
│   │   ├── RCI ID
│   │   ├── 描述
│   │   ├── Repo + Feature
│   │   ├── 状态（Pass/Fail/Pending）
│   │   ├── 7日通过率
│   │   ├── 平均执行时间
│   │   └── 失败原因（如果 fail）
│   └── 失败 RCI 优先级队列
│       └── 按优先级排序的失败 RCI
│
├── QA Decisions
│   ├── 最近决策列表
│   │   ├── Repo + 分支
│   │   ├── Decision 类型
│   │   ├── 优先级
│   │   ├── 时间
│   │   └── 查看详情
│   └── 统计图表
│       ├── Decision 类型分布
│       └── 趋势图
│
├── Audit Reports
│   ├── 最近审计列表
│   │   ├── Repo + 分支
│   │   ├── Decision (PASS/FAIL)
│   │   ├── Blocker 数量
│   │   ├── 时间
│   │   └── 查看详情
│   └── 统计图表
│       ├── PASS/FAIL 比例
│       └── 趋势图
│
└── 执行中心
    ├── 一键质检
    │   ├── 选择 Repos
    │   ├── 选择 Scope (PR/Release/Nightly)
    │   ├── 选择优先级
    │   └── 执行按钮
    ├── 执行历史
    │   ├── 执行 ID
    │   ├── Repos
    │   ├── 状态
    │   ├── 通过率
    │   ├── 时间
    │   └── 查看日志
    └── 实时监控
        └── 正在执行的质检任务
```

---

### 3.4 数据库设计

**Core API 需要新增的表**：

#### repos（Repos 注册表）
```sql
CREATE TABLE repos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- Workspace | Business | Engine
  path TEXT NOT NULL,
  git_url TEXT,
  main_branch TEXT,
  features_file TEXT,
  rci_file TEXT,
  owner TEXT,
  priority TEXT,
  sync_enabled BOOLEAN DEFAULT true,
  last_sync TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### features（Features 汇总）
```sql
CREATE TABLE features (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  category TEXT, -- Foundation | Business | Platform
  priority TEXT,
  has_rci BOOLEAN,
  has_golden_path BOOLEAN,
  dependencies TEXT, -- JSON array
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### rci_items（RCI 汇总）
```sql
CREATE TABLE rci_items (
  id TEXT PRIMARY KEY,
  desc TEXT NOT NULL,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  feature_id TEXT REFERENCES features(id),
  priority TEXT,
  trigger TEXT, -- JSON array: ["PR", "Release"]
  test_cmd TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### rci_executions（RCI 执行记录）
```sql
CREATE TABLE rci_executions (
  id TEXT PRIMARY KEY,
  rci_id TEXT NOT NULL REFERENCES rci_items(id),
  execution_id TEXT,
  status TEXT, -- pass | fail | pending
  duration INTEGER, -- 秒
  failure_reason TEXT,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### golden_paths（Golden Paths 汇总）
```sql
CREATE TABLE golden_paths (
  id TEXT PRIMARY KEY,
  desc TEXT NOT NULL,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  feature_id TEXT REFERENCES features(id),
  rci_ids TEXT, -- JSON array
  test_cmd TEXT,
  trigger TEXT, -- JSON array: ["Release", "Nightly"]
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### qa_decisions（QA Decisions 汇总）
```sql
CREATE TABLE qa_decisions (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  branch TEXT,
  decision TEXT, -- NO_RCI | MUST_ADD_RCI | UPDATE_RCI
  priority TEXT,
  repo_type TEXT,
  tests TEXT, -- JSON
  rci TEXT, -- JSON: {new: [], update: []}
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### audit_reports（Audit Reports 汇总）
```sql
CREATE TABLE audit_reports (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  branch TEXT,
  decision TEXT, -- PASS | FAIL
  summary TEXT, -- JSON: {L1: 0, L2: 0, L3: 0, L4: 0}
  findings TEXT, -- JSON array
  blockers TEXT, -- JSON array
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### qa_executions（质检执行记录）
```sql
CREATE TABLE qa_executions (
  id TEXT PRIMARY KEY,
  repos TEXT, -- JSON array
  scope TEXT, -- pr | release | nightly
  priority TEXT, -- JSON array
  status TEXT, -- running | completed | failed
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration INTEGER, -- 秒
  results TEXT -- JSON
);
```

---

## 4. 实施步骤

### Phase 1: 基础设施（1-2 天）
- [ ] 创建 `apps/core/config/repos-registry.yaml`
- [ ] 在 Core API 中新增数据库表
- [ ] 实现 `POST /api/qa/sync` API（解析并同步 Repos 数据）

### Phase 2: 查询 API（2-3 天）
- [ ] 实现 `GET /api/qa/repos`
- [ ] 实现 `GET /api/qa/features`
- [ ] 实现 `GET /api/qa/rci`
- [ ] 实现 `GET /api/qa/decisions`
- [ ] 实现 `GET /api/qa/audits`

### Phase 3: 执行 API（3-4 天）
- [ ] 实现 `POST /api/qa/execute`（跨 Repo 质检执行）
- [ ] 实现 `GET /api/qa/execute/{id}`（轮询进度）
- [ ] 实现执行日志记录和查询

### Phase 4: QA Dashboard 前端（5-7 天）
- [ ] 创建 QA Dashboard 路由和页面框架
- [ ] 实现 Repos 总览页
- [ ] 实现 Features 列表页
- [ ] 实现 RCI 状态墙页
- [ ] 实现 QA Decisions 页
- [ ] 实现 Audit Reports 页
- [ ] 实现执行中心页

### Phase 5: 集成和测试（2-3 天）
- [ ] 集成到现有 Dashboard
- [ ] E2E 测试
- [ ] 性能优化
- [ ] 文档编写

**总计**：约 13-19 天

---

## 5. 使用场景

### 场景 1：统一查看所有 Repos 的质检状态

**用户行为**：
1. 进入 QA Dashboard
2. 在 Repos 总览页看到所有 Repos 的状态
3. 点击某个 Repo 卡片，跳转到该 Repo 的 Features 列表
4. 在 RCI 状态墙查看失败的 RCI

**解决的问题**：不再需要在多个 Repos 之间切换，一个界面看到所有质检状态。

---

### 场景 2：跨 Repo 执行质检

**用户行为**：
1. 进入执行中心页
2. 选择需要质检的 Repos（cecelia-workspace + other-repo-1）
3. 选择 Scope（PR）
4. 选择优先级（P0 + P1）
5. 点击"执行质检"
6. 在实时监控中查看执行进度
7. 执行完成后查看结果和日志

**解决的问题**：不再需要分别在各个 Repo 中手动跑质检，一键执行跨 Repo 质检。

---

### 场景 3：开发功能时查看 QA 决策

**用户行为**：
1. 正在开发某个功能（在 other-repo-1）
2. 进入 QA Dashboard → QA Decisions 页
3. 过滤 `repo_id=other-repo-1`，查看该 Repo 最近的 QA 决策
4. 点击某个 Decision，查看详情（需要跑什么测试、是否需要 RCI）

**解决的问题**：不再需要在各个 Repo 的 `docs/QA-DECISION.md` 中翻找，统一查看所有决策。

---

### 场景 4：监控 RCI 健康度

**用户行为**：
1. 进入 RCI 状态墙页
2. 过滤 `priority=P0`，查看所有 P0 RCI 的状态
3. 发现 `RCI-B-003` 失败
4. 点击查看失败原因和日志
5. 定位到对应的 Feature 和 Repo

**解决的问题**：不再需要在各个 Repo 的 CI 日志中翻找失败的 RCI，统一监控所有 RCI 健康度。

---

## 6. Agent 集成

### 6.1 /qa Skill 增强

**当前 /qa Skill 能力**：
- 判断 RCI 是否需要（模式 3）
- 判断 Golden Path 是否需要（模式 2）
- 生成测试计划（模式 1）

**增强后的能力**：
- **跨 Repo 视图**：调用 Core API 获取所有 Repos 的 QA 数据
- **统一质检编排**：调用 `POST /api/qa/execute` 执行跨 Repo 质检
- **智能推荐**：根据改动类型和 Repo 上下文，推荐质检策略

**示例对话**：
```
用户: "我要跨 Repo 跑质检，包括 cecelia-workspace 和 other-repo-1，只跑 P0 的 RCI"

/qa Skill:
1. 调用 GET /api/qa/repos 获取 Repos 信息
2. 调用 GET /api/qa/rci?repos=cecelia-workspace,other-repo-1&priority=P0 获取 RCI 列表
3. 显示将要执行的 RCI（10 个）
4. 询问用户确认
5. 调用 POST /api/qa/execute 执行质检
6. 返回执行 ID，用户可以在 QA Dashboard 查看进度
```

---

### 6.2 /dev Skill 集成

**在 Step 4 (DoD) 和 Step 7 (Quality) 中集成 QA Dashboard**：

**Step 4: DoD（QA Decision Node）**
- 输出 `docs/QA-DECISION.md` 后，自动调用 `POST /api/qa/sync` 同步到 Core API
- 用户可以在 QA Dashboard 中查看该决策

**Step 7: Quality（Audit Node）**
- 输出 `docs/AUDIT-REPORT.md` 后，自动调用 `POST /api/qa/sync` 同步到 Core API
- 用户可以在 QA Dashboard 中查看该审计报告

---

## 7. 后续优化

### 7.1 实时同步
- 监听 Repos 的文件变化（FEATURES.md, regression-contract.yaml, docs/QA-DECISION.md）
- 自动触发同步，无需手动调用 `POST /api/qa/sync`

### 7.2 通知系统
- RCI 失败时发送通知（飞书/邮件）
- QA Decision 创建时通知相关人员
- Audit Report 失败时通知 Owner

### 7.3 趋势分析
- RCI 通过率趋势图（7天/30天）
- Features 健康度趋势
- Repos 质量分数排行榜

### 7.4 智能推荐
- 根据历史数据推荐是否需要 RCI
- 根据改动类型推荐质检策略
- 根据 Feature 依赖关系推荐需要测试的范围

---

## 8. 总结

### 解决的问题

✅ **统一视图**：一个 QA Dashboard 看到所有 Repos 的质检状态
✅ **跨 Repo 管理**：不再需要在多个 Repos 之间切换
✅ **统一编排**：一键执行跨 Repo 质检
✅ **数据汇总**：所有 QA Decisions、Audit Reports 集中管理
✅ **实时监控**：RCI 状态墙实时显示所有 RCI 健康度

### 核心架构

```
前端: QA Dashboard（统一界面）
    ↓
后端: Core API（QA Controller）
    ↓
数据源: 各个 Repos（FEATURES.md, regression-contract.yaml, docs/）
```

### 关键价值

1. **对用户**：不再混乱，一个界面管理所有 Repos 的质检
2. **对团队**：提高协作效率，统一质检标准
3. **对系统**：提高质量可见性，降低质量风险

---

**下一步**：确认方案后，开始 Phase 1 实施。
