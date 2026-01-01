# AI工厂-Workflow生产线 (Final Version)

## 文件位置
`/home/xx/dev/zenithjoy-autopilot/workflows/workflow-factory-final.json`

## 版本说明
这是合并了三个 v4 版本后的最终生产版本：
- **v3**: 5路质检系统（硬检查、软检查、安全扫描、集成检查、性能检查）
- **v4-report**: 管理报告系统
- **v4-rework**: 智能返工循环

## 节点总数: 27

### 1. 初始化阶段 (3节点)
- **接收PRD** - Webhook触发器
- **初始化Run** - 生成run_id和初始化返工计数器
- **SSH 初始化状态目录** - 创建完整目录结构：`{tasks,qc,docs,rework,reports}`

### 2. 任务分解与执行 (4节点)
- **SSH Claude A - 分解PRD** - 架构师角色，分解任务
- **Code - 拓扑排序** - 处理任务依赖关系
- **SplitInBatches - 任务分批** - 批量处理（batch_size=3）
- **SSH Claude B - 执行任务** - 工程师角色，执行workflow创建/修改

### 3. 质检阶段 - 5路并行检查 (6节点)
#### 硬检查（Bash）
1. **SSH Bash - 硬检查** (位置: [1660, 120])
   - 验证workflow存在性
   - 检查节点数量

2. **SSH Bash - 安全扫描** (位置: [1660, 360])
   - 检测硬编码凭据
   - 安全漏洞扫描

3. **SSH Bash - 集成检查** (位置: [1660, 480])
   - 验证节点连接完整性
   - 检测孤立节点

4. **SSH Bash - 性能检查** (位置: [1660, 600])
   - 节点数量限制（<50）
   - 代码长度限制（<500行）
   - 嵌套深度限制（<3层）

#### 软检查（Claude）
5. **SSH Claude C - 软检查** (位置: [1660, 240])
   - 代码质量审查
   - 命名规范检查
   - 错误处理验证

6. **Code - 合并结果** - 汇总所有执行结果

### 4. 决策阶段 (2节点)
- **Code - 决策** - 解析5路质检结果，做出PASS/REWORK/FAIL决策
  - Critical问题 → FAIL
  - High问题 → REWORK
  - Low问题 → PASS（带警告）

- **Switch - 决策分支** - 三路分支（PASS/REWORK/FAIL）

### 5. 返工循环系统 (5节点)
- **Code - 检查返工次数** - 限制最多2次返工
- **IF - 是否可返工** - 判断是否超限
- **Code - 构建返工计划** - 分析失败任务及依赖链
- **SSH - 执行返工** - Claude修复失败任务
- **Code - 解析返工结果** - 重新进入合并结果流程

### 6. 文档与报告 (5节点)
- **SSH Claude D - 生成文档** - 文档员角色，生成使用文档
- **Code - 管理报告** - 生成摘要报告（时长、模型调用、质检结果）
- **SSH 保存摘要报告** - 保存到 `{state_dir}/reports/summary.json`
- **SSH 更新状态(FAIL)** - 失败时更新状态
- **SSH 更新状态(超限)** - 返工超限时更新状态

### 7. 通知与响应 (2节点)
- **HTTP - 飞书通知** - 发送飞书卡片通知（绿色/橙色/红色）
- **返回结果** - 最终JSON响应

## 核心特性

### 1. 三角色分离
- **Claude A** (架构师): 分解PRD
- **Claude B** (工程师): 执行任务（批量并行）
- **Claude C** (审查员): 质量检查
- **Claude D** (文档员): 生成文档

### 2. 5路质检系统
| 检查类型 | 实现方式 | 严重程度 | 决策影响 |
|---------|---------|---------|---------|
| 硬检查 | Bash + API | Critical | FAIL |
| 软检查 | Claude分析 | High | REWORK |
| 安全扫描 | Bash + grep | Critical | FAIL |
| 集成检查 | Bash + jq | High | REWORK |
| 性能检查 | Bash + 指标 | Low | WARNING |

### 3. 智能返工循环
```
失败 → 检查次数(<2) → 分析依赖链 → Claude修复 → 重新质检
                ↓
              超限(≥2) → FAIL + 人工介入
```

### 4. 完整目录结构
```
/home/xx/data/runs/{run_id}/
├── prd.md                    # 原始PRD
├── state.json                # 运行状态
├── tasks/                    # 任务执行记录
│   ├── {task_id}.json
│   └── {task_id}_rework_{N}.log
├── qc/                       # 质检结果（v3新增，但未启用）
│   ├── hard_check.json
│   ├── soft_check.json
│   └── security.json
├── docs/                     # 生成的文档
│   └── {run_id}.md
├── rework/                   # 返工计划
│   └── rework_{N}.json
└── reports/                  # 管理报告
    └── summary.json
```

### 5. 管理报告内容
```json
{
  "run_id": "...",
  "factory_type": "workflow",
  "execution": {
    "total_tasks": N,
    "completed": N,
    "failed": N,
    "success_rate": "XX%",
    "rework_count": N
  },
  "timeline": {
    "started_at": "ISO8601",
    "completed_at": "ISO8601",
    "duration_minutes": N.NN
  },
  "quality": {
    "checks_passed": [...],
    "checks_failed": [...],
    "issues_count": N,
    "decision": "PASS/REWORK/FAIL"
  },
  "model_usage": {
    "sonnet_calls": N,
    "haiku_calls": 0,
    "total_calls": N
  },
  "workflows_created": ["workflow_id1", ...]
}
```

## 执行流程

```
Webhook → 初始化 → Claude A 分解
    ↓
拓扑排序 → 分批执行(Claude B) → 合并结果
    ↓
5路并行质检（3 Bash + 1 Claude + 1 Code）
    ↓
决策（解析5路结果）→ Switch分支
    ├─ PASS → 生成文档 → 管理报告 → 保存报告 → 飞书通知 → 返回
    ├─ REWORK → 检查次数
    │       ├─ <2 → 构建计划 → 执行返工 → 解析结果 → 回到合并结果
    │       └─ ≥2 → 更新状态(超限) → 飞书通知 → 返回
    └─ FAIL → 更新状态(FAIL) → 飞书通知 → 返回
```

## 与之前版本的区别

### 相比 v3
- ✅ 保留了5路质检（集成检查、性能检查）
- ✅ 添加了返工循环系统
- ✅ 添加了管理报告系统
- ✅ 完善了目录结构（reports/）

### 相比 v4-report
- ✅ 添加了5路质检（之前只有3路）
- ✅ 添加了返工循环
- ✅ 决策节点能解析5路质检结果

### 相比 v4-rework
- ✅ 添加了集成检查和性能检查
- ✅ 添加了管理报告节点
- ✅ 更新了SSH初始化创建reports/目录

## 模型调用估算
```
基础调用: 1(A分解) + N(B执行) + 1(C软检查) + 1(D文档) = N+3
返工调用: M(返工次数) × K(返工任务数)
总调用: N + 3 + M×K (全部使用 Sonnet)
```

## 使用示例

### 创建新workflow
```bash
curl -X POST "http://localhost:5679/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{
    "prd": "创建一个每小时检查VPS磁盘空间的workflow，超过80%发飞书告警"
  }'
```

### 修改现有workflow
```bash
curl -X POST "http://localhost:5679/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{
    "prd": "添加重试逻辑和错误处理",
    "target_workflow": "wqeeHpnTcJolnse4"
  }'
```

## 下一步操作

1. **上传到 n8n Cloud**
   ```bash
   # 使用 MCP 工具导入此 JSON
   mcp__n8n__execute_workflow workflow-factory-final.json
   ```

2. **测试验证**
   - 测试简单任务（单节点workflow）
   - 测试复杂任务（多节点依赖）
   - 测试返工流程（故意触发失败）
   - 测试5路质检（检查各项是否生效）

3. **监控与优化**
   - 查看 `/home/xx/data/runs/` 下的执行记录
   - 分析 summary.json 中的模型调用次数
   - 优化返工策略（当前固定2次）
   - 考虑添加 Notion 同步（自动保存报告）

## 注意事项

1. **返工限制**: 当前硬编码为2次，可根据实际情况调整
2. **模型成本**: 所有Claude调用使用Sonnet，成本较高
3. **并行度**: SplitInBatches batch_size=3，可根据性能调整
4. **质检结果保存**: qc/目录已创建但未启用保存功能（v3有节点但v4-rework未连接）
5. **飞书通知**: 使用固定webhook，建议改为环境变量

## 已知优化点

1. ~~质检结果保存节点（v3的"SSH 保存质检结果"）未集成到最终流程~~
   - 原因：v4-rework版本移除了此节点
   - 建议：如需保存质检结果到文件，需要重新添加此节点并连接

2. 飞书通知卡片中可添加报告链接
   - 添加字段：`"report_url": "file://{{ $json.state_dir }}/reports/summary.json"`

3. 可考虑添加 webhook 回调
   - 完成后主动通知调用方
   - 提供进度查询接口

---

**版本**: Final (合并v3 + v4-report + v4-rework)
**创建时间**: 2025-12-24
**节点总数**: 27
**质检路数**: 5 (硬检查、软检查、安全扫描、集成检查、性能检查)
**最大返工次数**: 2
