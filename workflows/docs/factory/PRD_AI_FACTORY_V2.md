# AI Factory V2 - 完整 PRD

## 1. 项目概述

构建一个 **AI 驱动的 n8n Workflow 自动化生产系统**，能够根据自然语言 PRD 自动创建、测试、验证 n8n workflow。

## 2. 核心目标

1. **零人工干预**：从 PRD 到可用 workflow 全自动完成
2. **防止 AI 欺骗**：硬检查 > 软检查，证据驱动
3. **质量保证**：结构化评分，阈值控制
4. **成本可控**：按任务复杂度分配模型

## 3. 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Factory V2 Pipeline                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [1] 入口        [2] 分解        [3] 排序        [4] 执行  │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ Webhook │───▶│Claude A │───▶│拓扑排序 │───▶│Claude B │  │
│  │ 接收PRD │    │分解任务 │    │波次并行 │    │创建WF   │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│       │              │              │              │        │
│       ▼              ▼              ▼              ▼        │
│   run_id         tasks.json     waves.json    workflow_id   │
│                                                             │
│  [5] 合并        [6] 质检        [7] 决策        [8] 文档  │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │合并结果 │───▶│ 9路检查 │───▶│PASS/FAIL│───▶│Claude D │  │
│  │更新状态 │    │硬+软+执行│    │>=80分   │    │生成文档 │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│       │              │              │              │        │
│       ▼              ▼              ▼              ▼        │
│   results.json   qc/*.json    decision.json   docs/*.md    │
│                                                             │
│  [9] 报告       [10] 通知                                  │
│  ┌─────────┐    ┌─────────┐                                │
│  │摘要统计 │───▶│飞书通知 │                                │
│  │成本追踪 │    │结果回调 │                                │
│  └─────────┘    └─────────┘                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 4. 功能需求

### 4.1 入口模块

**输入**：
```json
{
  "prd": "创建一个监控 VPS 磁盘空间的 workflow...",
  "run_id": "可选，自动生成",
  "target_workflow": "可选，修改已有 workflow"
}
```

**输出**：
- 创建 `runs/{run_id}/` 目录结构
- 保存 `prd.md`
- 初始化 `state.json`
- 创建 Git 工作分支

### 4.2 PRD 分解模块 (Claude A)

**功能**：将 PRD 分解为可独立执行的原子任务

**输出格式**：
```json
{
  "tasks": [
    {
      "id": "task_1",
      "name": "任务名称",
      "description": "详细描述",
      "depends_on": [],
      "complexity": 1-5,
      "model": "haiku|sonnet|opus"
    }
  ]
}
```

**模型分配规则**：
- complexity >= 4 → opus
- complexity <= 2 → haiku
- 其他 → sonnet

### 4.3 拓扑排序模块

**功能**：
1. 构建依赖图
2. 检测循环依赖
3. 分波次排序（无依赖的任务可并行）

**输出**：`waves.json`

### 4.4 任务执行模块 (Claude B)

**Hybrid 模式**：
1. 优先匹配模板库
2. 无模板则 Claude 生成 JSON
3. 调用 n8n REST API 创建 workflow
4. 激活 workflow

**模板库**：
- webhook-response: Webhook → 处理 → 响应
- scheduled-task: 定时触发 → 执行 → 通知
- ssh-execution: SSH 到 VPS 执行命令
- notification: 发送飞书/Slack 通知

**重试机制**：
- JSON 生成失败最多重试 3 次
- 每次重试加强 prompt 约束

**超时保护**：
- Claude 调用: 120 秒
- API 调用: 30 秒

### 4.5 质量检查模块 (9 路并行)

| # | 检查类型 | 方式 | 阈值 |
|---|----------|------|------|
| 1 | 硬检查 | 代码 | 100% 必须通过 |
| 2 | 软检查 | Claude | >= 80 分 |
| 3 | 安全扫描 | 代码 | 100% 无问题 |
| 4 | 集成检查 | 代码 | 通过 |
| 5 | 性能检查 | 代码 | 节点 < 50 |
| 6 | Git 检查 | 代码 | 分支正确 |
| 7 | Linting | 代码 | 命名规范 |
| 8 | 覆盖率 | 代码 | 有测试文件 |
| 9 | 执行测试 | 真实调用 | >= 80% 响应 |

**软检查评分维度**（每项 0-20 分，共 100 分）：
1. 节点完整性
2. 错误处理
3. 命名规范
4. 参数配置
5. 最佳实践

**安全扫描规则**（8 种）：
- API Key 模式
- Token 模式
- AWS 凭据
- 私钥
- 硬编码密码
- 敏感 URL
- 通用密钥
- 凭据 ID 暴露

### 4.6 决策模块

**逻辑**：
```
硬检查 100% 通过 AND 安全扫描通过 AND 软检查 >= 80 分
  → PASS（继续文档生成）

否则
  → REWORK（返工，最多 3 次）

返工 3 次仍失败
  → FAIL（停止，通知人工）
```

### 4.7 文档生成模块 (Claude D)

**产出**：
- README.md: 项目说明
- DEPLOY.md: 部署文档
- API.md: API 文档（如有 webhook）
- ACCEPTANCE.md: 验收清单

### 4.8 报告模块

**摘要 JSON**：
```json
{
  "run_id": "...",
  "decision": "PASS|FAIL",
  "duration_seconds": 120,
  "soft_score": 85,
  "cost": {
    "sonnet_calls": 3,
    "haiku_calls": 2,
    "estimated_cost_usd": 0.50
  }
}
```

### 4.9 通知模块

- 成功/失败都通知飞书
- 包含关键指标和链接

## 5. 目录结构

```
/data/runs/{run_id}/
├── prd.md
├── state.json
├── plan.json
├── waves.json
├── execution_results.json
├── decision.json
├── tasks/
│   └── task_*.json
├── qc/
│   ├── hard_check.json
│   ├── soft_check.json
│   ├── security.json
│   ├── execution_test.json
│   └── ...
├── docs/
│   ├── README.md
│   ├── DEPLOY.md
│   └── API.md
└── reports/
    └── summary.json
```

## 6. 技术约束

- 运行环境: Linux VPS (Ubuntu)
- 语言: Bash + jq + curl
- 依赖: Claude CLI, n8n REST API
- 模板库: JSON 格式

## 7. 验收标准

- [ ] 从 PRD 到 workflow 全自动完成
- [ ] 成本追踪显示真实 token 数
- [ ] 软检查评分 0-100，阈值 80
- [ ] 安全扫描检测 8 种风险
- [ ] 所有 Claude/API 调用有超时保护
- [ ] JSON 生成失败有重试机制
- [ ] 错误信息具体可调试
- [ ] Git 自动分支和提交
- [ ] 飞书通知成功/失败

## 8. 性能指标

| 指标 | 目标 |
|------|------|
| 单任务耗时 | < 2 分钟 |
| 整体耗时 | < 10 分钟 |
| 成功率 | > 90% |
| 成本/任务 | < $0.50 |
