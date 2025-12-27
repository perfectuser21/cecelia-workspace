# Workflow Factory v4-QC - Architecture Diagram

## Complete Node Flow (19 Nodes)

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKFLOW FACTORY v4-QC                        │
│              AI-Powered n8n Workflow Production Line             │
└─────────────────────────────────────────────────────────────────┘

[1] Webhook: 接收PRD
    │ POST /webhook/workflow-factory
    │ Body: { prd, target_workflow? }
    ▼
[2] Code: 初始化Run
    │ Generate run_id: YYYYMMDDHHMMSS-random
    │ Create state_dir: /home/xx/data/runs/{run_id}
    ▼
[3] SSH: 初始化状态目录
    │ mkdir -p {state_dir}/tasks
    │ Save prd.md, state.json
    ▼
[4] SSH Claude A: 分解PRD
    │ Model: Sonnet
    │ Role: Architect
    │ Output: JSON task list with dependencies
    ▼
[5] Code: 拓扑排序
    │ Parse task list
    │ Detect dependencies
    │ Sort into waves (parallel batches)
    ▼
[6] SplitInBatches: 任务分批
    │ Batch size: 3
    │ ◄──────┐ Loop until all tasks done
    ▼        │
[7] SSH Claude B: 执行任务  │
    │ Model: Sonnet         │
    │ Role: Engineer        │
    │ Use MCP to create/modify workflows
    │ ──────────────────────┘
    ▼
[8] Code: 合并结果
    │ Aggregate all task results
    │ Count: success/failed/total
    │ Calculate success_rate
    │
    ├──────────────┬─────────────┬──────────────┬──────────────┐
    ▼              ▼             ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│              PARALLEL QUALITY CHECK PIPELINE (5-WAY)             │
└─────────────────────────────────────────────────────────────────┘

[9] SSH Bash         [10] SSH Claude C    [11] SSH Bash
   硬检查 (Hard)        软检查 (Soft)        安全扫描 (Security)
   ├─ Workflow存在      ├─ 节点命名清晰       ├─ 硬编码凭据
   ├─ Node完整性        ├─ 错误处理          ├─ 敏感信息
   └─ JSON格式正确      └─ 连接完整性        └─ Credential使用
   Severity: CRITICAL   Severity: HIGH      Severity: CRITICAL

[12] SSH Bash        [13] SSH Bash
   集成检查 ★ NEW        性能检查 ★ NEW
   ├─ 节点连接完整性     ├─ 节点数量 (<50)
   ├─ 无孤立节点        ├─ 代码长度 (<500行)
   └─ API契约正确       └─ 嵌套深度 (<3层)
   Severity: HIGH      Severity: LOW (warning)

    │              │             │              │              │
    └──────────────┴─────────────┴──────────────┴──────────────┘
                              ▼
[14] Code: 决策 (Enhanced Decision Logic)
    │
    │ Parse all 5 check results:
    │ ┌────────────────────────────────────────┐
    │ │ hardCheck      → { all_exist, count }  │
    │ │ softCheck      → { pass, issues }      │
    │ │ securityCheck  → { pass, issues }      │
    │ │ integrationCheck → { imports_ok, api_ok } │
    │ │ performanceCheck → { size_ok, complexity_ok } │
    │ └────────────────────────────────────────┘
    │
    │ Issue Categorization:
    │ ┌─────────────────────────────────────────┐
    │ │ CRITICAL → hardCheck, securityCheck     │
    │ │ HIGH     → softCheck, integrationCheck  │
    │ │ LOW      → performanceCheck             │
    │ └─────────────────────────────────────────┘
    │
    │ Decision Matrix:
    │ ┌─────────────────────────────────────────┐
    │ │ CRITICAL issues > 0 → FAIL              │
    │ │ HIGH issues > 0     → REWORK            │
    │ │ LOW issues > 0      → PASS (with warnings) │
    │ │ No issues           → PASS              │
    │ └─────────────────────────────────────────┘
    ▼
[15] IF: 决策分支
    │
    ├── PASS ─────────────────────┐
    │                              ▼
    │                      [16] SSH Claude D: 生成文档
    │                              │ Model: Sonnet
    │                              │ Role: Documentation
    │                              │ Output: Markdown docs
    │                              │ Save to: docs/{run_id}.md
    │                              ▼
    └── FAIL/REWORK ──────────────┐
                                   ▼
                          [17] SSH: 更新状态
                              │ Update state.json
                              │ Save issues, decision
                              ▼
                        ┌─────┴─────┐
                        │           │
                        ▼           ▼
[18] HTTP: 飞书通知 (Enhanced Notification)
    │
    │ Card Header: 
    │   ✅ GREEN  - Workflow 生产完成 (PASS)
    │   ⚠️  ORANGE - Workflow 生产需返工 (REWORK)
    │   ❌ RED    - Workflow 生产失败 (FAIL)
    │
    │ Card Body:
    │   Run ID: {run_id}
    │   
    │   执行摘要:
    │     - 总任务: N
    │     - 成功: N
    │     - 失败: N
    │     - 成功率: XX%
    │   
    │   质检结果:
    │     - Workflow存在: ✅/❌
    │     - 代码质量: ✅/❌
    │     - 安全扫描: ✅/❌
    │     - 集成检查: ✅/⚠️  ★ NEW
    │     - 性能检查: ✅/⚠️  ★ NEW
    │   
    │   决策: {PASS/REWORK/FAIL}
    │   操作: {action}
    ▼
[19] Code: 返回结果
    │
    │ Response JSON:
    │ {
    │   "status": "success|needs_rework|failed",
    │   "run_id": "{run_id}",
    │   "decision": "{PASS|REWORK|FAIL}",
    │   "action": "{description}",
    │   "workflows_created": ["{workflow_id}"],
    │   "summary": { total, success, failed, success_rate },
    │   "issues": [{severity, type, message}],
    │   "checks": {
    │     hardCheck, softCheck, securityCheck,
    │     integrationCheck, performanceCheck
    │   },
    │   "state_dir": "/home/xx/data/runs/{run_id}",
    │   "completed_at": "{ISO timestamp}"
    │ }
    ▼
  [END]

┌─────────────────────────────────────────────────────────────────┐
│                         NODE SUMMARY                             │
├─────────────────────────────────────────────────────────────────┤
│ Total Nodes: 19                                                  │
│ - Webhook: 1                                                     │
│ - Code: 4                                                        │
│ - SSH: 9 (4 Claude + 5 Bash)                                     │
│ - SplitInBatches: 1                                              │
│ - IF: 1                                                          │
│ - HTTP: 1                                                        │
│                                                                  │
│ Claude Models Used:                                              │
│ - A (Architect): Sonnet - PRD decomposition                      │
│ - B (Engineer): Sonnet - Task execution                          │
│ - C (Reviewer): Sonnet - Quality check                           │
│ - D (Documentation): Sonnet - Doc generation                     │
│                                                                  │
│ Quality Checks: 5 (3 Bash + 1 Claude + 1 enhanced)               │
│ - Hard Check (Bash): CRITICAL                                    │
│ - Soft Check (Claude): HIGH                                      │
│ - Security Scan (Bash): CRITICAL                                 │
│ - Integration Check (Bash): HIGH ★ NEW                           │
│ - Performance Check (Bash): LOW ★ NEW                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      DATA FLOW SUMMARY                           │
├─────────────────────────────────────────────────────────────────┤
│ Input:  PRD (text) → JSON tasks → Execution → Results           │
│ Output: Workflow IDs + Quality Report + Documentation            │
│                                                                  │
│ State Management:                                                │
│ - Directory: /home/xx/data/runs/{run_id}/                        │
│ - Files:                                                         │
│   ├── prd.md              (original requirement)                 │
│   ├── state.json          (execution state)                      │
│   └── tasks/              (individual task results)              │
│       ├── task_1.json                                            │
│       ├── task_2.json                                            │
│       └── ...                                                    │
│                                                                  │
│ Documentation:                                                   │
│ - Location: /home/xx/dev/n8n-workflows/docs/{run_id}.md         │
│ - Content: Usage guide, webhook paths, I/O formats              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    QUALITY CHECK DETAILS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ [Hard Check] Workflow Existence (CRITICAL)                       │
│   For each workflow_id:                                          │
│     ✓ Fetch via n8n API                                          │
│     ✓ Verify .id exists                                          │
│     ✓ Count nodes                                                │
│   Output: JSON with all_exist flag                              │
│                                                                  │
│ [Soft Check] Code Quality (HIGH)                                 │
│   Claude reviews:                                                │
│     ✓ Node naming (Chinese descriptions)                         │
│     ✓ Error handling presence                                    │
│     ✓ Connection completeness                                    │
│   Output: JSON with pass flag + issues list                     │
│                                                                  │
│ [Security Scan] Credential Detection (CRITICAL)                  │
│   Regex scan for:                                                │
│     ✓ Hardcoded passwords/secrets/API keys                       │
│     ✓ Exclude proper credential references                       │
│   Output: JSON with pass flag + issues list                     │
│                                                                  │
│ [Integration Check] ★ NEW (HIGH)                                 │
│   Validates:                                                     │
│     ✓ node_count vs connection_count (≥ n-1)                     │
│     ✓ No orphaned nodes (disconnected from graph)                │
│   Output: INTEGRATION_CHECK_RESULT|imports_ok=N|api_ok=N        │
│                                                                  │
│ [Performance Check] ★ NEW (LOW)                                  │
│   Monitors:                                                      │
│     ✓ Total nodes < 50                                           │
│     ✓ Code node lines < 500                                      │
│     ✓ SplitInBatches nesting < 3                                 │
│   Output: PERFORMANCE_CHECK_RESULT|size_ok=N|complexity_ok=N    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Legend:
  ▼  Sequential flow
  │  Data pipe
  ├  Parallel split
  ─  Connection
  ★  New in v4-QC
  ✓  Check item
  ✅ Pass
  ❌ Fail
  ⚠️  Warning
