# PRD - N8N 工作流整合

> Product Requirements Document - 功能需求文档
>
> 将分散在 Engine 和 Core 的 N8N 工作流统一整合到 Core 仓库
> 以 Feature 为中心组织，Cecilia 作为第一个重点 Feature

---

## 元信息

| 字段 | 值 |
|------|-----|
| 项目 | `zenithjoy-core` |
| 功能分支 | `feature/n8n-consolidation` |
| 创建时间 | `2026-01-19 15:30` |
| 状态 | `draft` |

---

## 背景

当前 N8N 工作流分散在两个仓库：
- **zenithjoy-engine**: `n8n/workflows/prd-executor.json` - PRD 执行器
- **zenithjoy-core**: `workflows/n8n/*.json` - Cecilia 协调器等

这导致：
1. 维护分散，难以全局管理
2. 工作流之间的依赖关系不清晰
3. 没有按 Feature 组织，结构扁平

## 目标

1. **统一存放** - 所有 N8N 工作流集中到 Core 仓库
2. **Feature 为中心** - 按功能模块组织工作流目录结构
3. **Cecilia 完整化** - 确保 Cecilia 相关工作流完整且可运行

## 非目标

- 不修改工作流的业务逻辑
- 不重构前端 N8N 管理 UI
- 不涉及其他 Feature 的工作流（仅整理结构）

---

## 功能描述

### 目标目录结构

```
zenithjoy-core/
├── workflows/
│   └── n8n/
│       ├── cecilia/                    # Cecilia Feature 工作流
│       │   ├── coordinator.json        # 多阶段任务协调器
│       │   ├── prd-executor.json       # PRD 执行器（从 Engine 迁移）
│       │   └── README.md               # Cecilia 工作流说明
│       │
│       ├── shared/                     # 通用工作流
│       │   └── execution-callback.json # 执行回调处理
│       │
│       └── README.md                   # N8N 工作流总览
```

### 迁移清单

| 源文件 | 目标位置 | 操作 |
|--------|----------|------|
| `engine/n8n/workflows/prd-executor.json` | `core/workflows/n8n/cecilia/prd-executor.json` | 迁移 |
| `core/workflows/n8n/cecilia-coordinator.json` | `core/workflows/n8n/cecilia/coordinator.json` | 重命名移动 |
| `core/workflows/n8n/execution-callback-extended.json` | `core/workflows/n8n/shared/execution-callback.json` | 重命名移动 |

### 技术方案

1. **文件迁移** - 直接复制/移动 JSON 文件
2. **工作流 ID 检查** - 确保 N8N 中的工作流 ID 不冲突
3. **README 文档** - 为每个目录添加说明文档
4. **前端适配** - 检查 N8N UI 是否需要更新路径

---

## Checkpoints

> **N8N 解析区域** - 每个 checkpoint 对应一个任务

- [ ] CP-001: 创建目录结构 | config | none
- [ ] CP-002: 迁移 Engine PRD Executor | code | CP-001
- [ ] CP-003: 重组 Core 工作流 | code | CP-001
- [ ] CP-004: 添加 README 文档 | docs | CP-003
- [ ] CP-005: 验证工作流可导入 | test | CP-003

### Checkpoint 详情

#### CP-001: 创建目录结构

**类型**: `config`
**依赖**: `none`
**预计工作量**: `small`

**任务描述**:
创建新的目录结构：
- `workflows/n8n/cecilia/`
- `workflows/n8n/shared/`

**完成标准**:
- [ ] 目录已创建
- [ ] 目录权限正确

**验证命令**:
```bash
ls -la workflows/n8n/
```

---

#### CP-002: 迁移 Engine PRD Executor

**类型**: `code`
**依赖**: `CP-001`
**预计工作量**: `small`

**任务描述**:
从 zenithjoy-engine 复制 `n8n/workflows/prd-executor.json` 到 `workflows/n8n/cecilia/prd-executor.json`

**完成标准**:
- [ ] 文件已复制到目标位置
- [ ] JSON 格式有效
- [ ] 工作流 ID 与现有不冲突

**验证命令**:
```bash
cat workflows/n8n/cecilia/prd-executor.json | jq '.name'
```

---

#### CP-003: 重组 Core 工作流

**类型**: `code`
**依赖**: `CP-001`
**预计工作量**: `small`

**任务描述**:
移动并重命名现有工作流：
1. `cecilia-coordinator.json` → `cecilia/coordinator.json`
2. `execution-callback-extended.json` → `shared/execution-callback.json`

**完成标准**:
- [ ] 文件已移动到正确位置
- [ ] 原位置文件已删除
- [ ] JSON 格式有效

**验证命令**:
```bash
ls workflows/n8n/cecilia/
ls workflows/n8n/shared/
```

---

#### CP-004: 添加 README 文档

**类型**: `docs`
**依赖**: `CP-003`
**预计工作量**: `small`

**任务描述**:
为工作流目录添加说明文档：
1. `workflows/n8n/README.md` - 总览
2. `workflows/n8n/cecilia/README.md` - Cecilia 工作流说明

**完成标准**:
- [ ] README 包含工作流清单
- [ ] README 包含使用说明
- [ ] README 包含依赖关系图

---

#### CP-005: 验证工作流可导入

**类型**: `test`
**依赖**: `CP-003`
**预计工作量**: `small`

**任务描述**:
验证重组后的工作流可以正常导入 N8N

**完成标准**:
- [ ] 所有 JSON 文件格式正确
- [ ] 工作流可以在 N8N 中导入
- [ ] 工作流之间的调用关系正确

**验证命令**:
```bash
# 验证 JSON 格式
for f in workflows/n8n/**/*.json; do jq . "$f" > /dev/null && echo "✓ $f"; done
```

---

## 验收标准

1. **结构清晰** - 工作流按 Feature 组织在 `workflows/n8n/<feature>/`
2. **完整迁移** - Engine 中的 N8N 工作流已迁移到 Core
3. **文档完善** - 每个目录有 README 说明
4. **功能正常** - 工作流可正常导入和执行

---

## 风险与依赖

| 风险/依赖 | 影响 | 缓解措施 |
|----------|------|---------|
| N8N 中已存在同名工作流 | 导入冲突 | 检查并调整工作流名称 |
| 工作流之间有 Webhook 调用 | 路径变化可能影响调用 | 检查 Webhook URL 配置 |

---

## 附录

### 相关文件

- Engine PRD Executor: `/home/xx/dev/zenithjoy-engine/n8n/workflows/prd-executor.json`
- Core Cecilia Coordinator: `/home/xx/dev/zenithjoy-core/workflows/n8n/cecilia-coordinator.json`
- Cecilia Stage Templates: `/home/xx/dev/zenithjoy-core/data/cecilia/stage-templates/`

### Cecilia 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Notion Database                         │
│  (Tasks with PRD, Multi-Stage Config)                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   PRD Executor                               │
│  - 解析 PRD Checkpoints                                      │
│  - 创建 Dashboard Run 记录                                   │
│  - 触发 Claude Code 执行                                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Coordinator                                │
│  - 监控执行状态                                              │
│  - 多阶段判断                                                │
│  - Claude 分析结果                                           │
│  - 创建下一阶段任务                                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Execution Callback                         │
│  - 处理执行完成回调                                          │
│  - 更新 Notion 状态                                          │
│  - 发送飞书通知                                              │
└─────────────────────────────────────────────────────────────┘
```
