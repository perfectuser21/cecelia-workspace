# Brain API

Brain 是 Cecelia 的决策核心系统，实现任务调度、目标追踪和自动化执行。

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                         Brain API                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │  Perception │───>│ Orchestrator│───>│     Decision        │  │
│  │  感知层     │    │  协调器     │    │     Engine          │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│        │                  │                      │              │
│        ▼                  ▼                      ▼              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   Snapshot  │    │    Focus    │    │     Actions         │  │
│  │   系统快照  │    │  优先级引擎 │    │     动作执行        │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│        │                  │                      │              │
│        └──────────────────┴──────────────────────┘              │
│                           │                                     │
│                           ▼                                     │
│                    ┌─────────────┐                              │
│                    │    Tick     │                              │
│                    │  自驱动循环 │                              │
│                    └─────────────┘                              │
│                           │                                     │
│                           ▼                                     │
│                    ┌─────────────┐                              │
│                    │  Executor   │                              │
│                    │ cecelia-run │                              │
│                    └─────────────┘                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 核心模块

### 1. Perception（感知层）
**文件**: `perception.js`

负责收集系统状态并创建快照：
- 探测 n8n 状态（执行次数、失败率、活跃 workflow）
- 探测任务系统状态（任务分布、滞留任务、目标进度）
- 创建去重快照存入数据库

```javascript
// 创建系统快照
await createSnapshot();

// 获取最新快照
const snapshot = await getLatestSnapshot();
```

### 2. Orchestrator（协调器）
**文件**: `orchestrator.js`

系统状态聚合器，提供决策所需的完整上下文：
- 获取活跃策略（Policy）
- 获取工作记忆（Working Memory）
- 获取优先级任务列表
- 获取最近决策记录

### 3. Focus（优先级引擎）
**文件**: `focus.js`

实现「今日焦点」选择逻辑：

**选择优先级**：
1. 手动置顶的 Objective (`is_pinned = true`)
2. 优先级 (P0 > P1 > P2)
3. 接近完成 (80%+ 进度优先完成)
4. 最近活跃

```javascript
// 获取今日焦点
const focus = await getDailyFocus();

// 手动设置焦点（覆盖算法）
await setDailyFocus(objectiveId);

// 清除手动设置，恢复自动选择
await clearDailyFocus();
```

### 4. Decision Engine（决策引擎）
**文件**: `decision.js`

对比目标进度，检测偏差，生成决策：

**决策类型**：
- `reprioritize` - 重新排序任务优先级
- `escalate` - 标记任务需要关注
- `retry` - 重试失败任务
- `skip` - 跳过/取消任务

**置信度机制**：
- 高置信度 (≥0.8) 自动执行
- 低置信度需人工审批

```javascript
// 比较目标进度
const report = await compareGoalProgress();

// 生成决策
const decision = await generateDecision({ trigger: 'tick' });

// 执行决策
const result = await executeDecision(decisionId);

// 回滚决策
await rollbackDecision(decisionId);
```

### 5. Tick（自驱动循环）
**文件**: `tick.js`

核心自动化循环，每 5 分钟执行一次：

1. **比较目标进度** - 调用 Decision Engine
2. **自动执行高置信度决策**
3. **获取今日焦点** - 确定工作方向
4. **检查任务状态** - 找出待执行/阻塞任务
5. **执行下一个任务** - 通过 cecelia-run
6. **记录决策日志**

```javascript
// 手动触发一次 tick
await executeTick();

// 启用/禁用自动 tick
await enableTick();
await disableTick();

// 获取 tick 状态
const status = await getTickStatus();
```

### 6. Actions（动作执行）
**文件**: `actions.js`

白名单化的动作执行器：

| Action | 必填参数 | 用途 |
|--------|----------|------|
| `create-task` | title | 创建任务 |
| `update-task` | task_id | 更新任务状态/优先级 |
| `batch-update-tasks` | filter, update | 批量更新任务 |
| `create-goal` | title | 创建目标 |
| `update-goal` | goal_id | 更新目标状态/进度 |
| `set-memory` | key, value | 设置工作记忆 |
| `trigger-n8n` | webhook_path | 触发 n8n webhook |

### 7. Executor（执行器）
**文件**: `executor.js`

与 cecelia-run 对接，触发任务实际执行：
- 检查 cecelia-run 可用性
- 触发任务执行
- 处理执行回调

## API 端点

### 状态读取

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/brain/status` | GET | 精简决策包（给 LLM 用） |
| `/api/brain/status/full` | GET | 完整状态（调试用） |
| `/api/brain/memory` | GET | 工作记忆 |
| `/api/brain/policy` | GET | 当前策略 |
| `/api/brain/decisions` | GET | 决策历史 |
| `/api/brain/tasks` | GET | 优先级任务列表 |

### 快照管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/brain/snapshot` | POST | 创建快照 |
| `/api/brain/snapshot/latest` | GET | 获取最新快照 |
| `/api/brain/snapshots` | GET | 快照历史 |

### 焦点管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/brain/focus` | GET | 获取今日焦点 |
| `/api/brain/focus/set` | POST | 手动设置焦点 |
| `/api/brain/focus/clear` | POST | 清除手动焦点 |

### Tick 控制

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/brain/tick` | POST | 手动触发 tick |
| `/api/brain/tick/status` | GET | tick 状态 |
| `/api/brain/tick/enable` | POST | 启用自动 tick |
| `/api/brain/tick/disable` | POST | 禁用自动 tick |

### 决策引擎

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/brain/goal/compare` | POST | 比较目标进度 |
| `/api/brain/decide` | POST | 生成决策 |
| `/api/brain/decision/:id/execute` | POST | 执行决策 |
| `/api/brain/decision/:id/rollback` | POST | 回滚决策 |

### 动作执行

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/brain/action/:actionName` | POST | 统一动作入口 |
| `/api/brain/execution-callback` | POST | 执行完成回调 |

### TRD 分解

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/brain/trd/decompose` | POST | 分解 TRD 为里程碑/PRD/任务 |
| `/api/brain/trd/:id/progress` | GET | 获取 TRD 进度 |
| `/api/brain/trds` | GET | 列出所有 TRD |

### 意图识别

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/brain/intent/parse` | POST | 解析自然语言意图 |
| `/api/brain/intent/create` | POST | 解析并创建资源 |
| `/api/brain/intent/types` | GET | 可用意图类型 |

## 安全机制

### 白名单
所有动作必须在白名单内，未授权动作会被拒绝。

### 幂等性
- 每个动作可携带 `idempotency_key`
- 5 分钟内重复的 key 返回上次结果
- 防止重复执行

### 决策日志
所有动作自动记录到 `decision_log` 表，用于审计追踪。

## 使用示例

### 获取系统状态

```bash
curl -s http://localhost:5212/api/brain/status | jq
```

### 手动触发 tick

```bash
curl -X POST http://localhost:5212/api/brain/tick
```

### 更新任务状态

```bash
curl -X POST http://localhost:5212/api/brain/action/update-task \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "xxx",
    "status": "in_progress",
    "idempotency_key": "session-xxx-update-task"
  }'
```

### 设置工作记忆

```bash
curl -X POST http://localhost:5212/api/brain/action/set-memory \
  -H "Content-Type: application/json" \
  -d '{
    "key": "current_focus",
    "value": {"project": "cecelia-workspace", "goal": "Brain MVP"},
    "idempotency_key": "set-focus-xxx"
  }'
```

## 数据库表

| 表名 | 用途 |
|------|------|
| `tasks` | 任务 |
| `goals` | 目标（Objective + Key Results） |
| `working_memory` | 工作记忆（键值对） |
| `policy` | 策略配置 |
| `system_snapshot` | 系统快照 |
| `decision_log` | 决策日志 |
| `decisions` | 决策记录（含执行状态） |
| `trds` | TRD 分解记录 |

## 配置

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `N8N_API_URL` | `http://localhost:5679` | n8n API 地址 |
| `N8N_API_KEY` | - | n8n API Key |

## 开发阶段

- [x] Stage 1: 状态感知（Perception）
- [x] Stage 2: TRD 分解（Decomposer）
- [x] Stage 3: 决策引擎（Decision Engine）
- [x] Stage 4: 自驱动循环（Tick）
