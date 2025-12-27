# Workflow Factory v4 Quality Check Enhancement

## Changes Summary

Added two new quality check nodes to the AI Factory Workflow Production Line:

### New Nodes

1. **SSH Bash - 集成检查** (Position: [1660, 540])
   - **Purpose**: Validate workflow integration and connections
   - **Checks**:
     - Import validity (all nodes properly connected)
     - API contract correctness (no orphaned nodes)
   - **Output Format**: `INTEGRATION_CHECK_RESULT|imports_ok=1|api_ok=1`
   
2. **SSH Bash - 性能检查** (Position: [1660, 660])
   - **Purpose**: Validate workflow performance and complexity
   - **Checks**:
     - File size (workflows should have <50 nodes)
     - Function complexity (Code nodes should have <500 lines)
     - Nesting depth (SplitInBatches should have <3 levels)
   - **Output Format**: `PERFORMANCE_CHECK_RESULT|size_ok=1|complexity_ok=1`

### Updated Connections

- **"Code - 合并结果"** now connects to 5 parallel check nodes:
  1. SSH Bash - 硬检查
  2. SSH Claude C - 软检查
  3. SSH Bash - 安全扫描
  4. SSH Bash - 集成检查 (NEW)
  5. SSH Bash - 性能检查 (NEW)

- Both new nodes connect to **"Code - 决策"**

### Updated Decision Logic

The "Code - 决策" node now parses and evaluates 5 types of checks:

1. **hardCheck**: Workflow existence (CRITICAL)
2. **softCheck**: Code quality (HIGH)
3. **securityCheck**: Security scan (CRITICAL)
4. **integrationCheck**: Connections and dependencies (HIGH)
5. **performanceCheck**: Size and complexity (LOW - WARNING only)

**Severity Levels**:
- **CRITICAL** → FAIL (requires manual intervention)
- **HIGH** → REWORK (needs fixes before retry)
- **LOW** → PASS with warnings (performance optimization suggested)

### Updated Feishu Notification

The notification card now displays all 5 check results:
- Workflow存在: ✅/❌
- 代码质量: ✅/❌
- 安全扫描: ✅/❌
- 集成检查: ✅/⚠️ (NEW)
- 性能检查: ✅/⚠️ (NEW)

## Total Nodes: 19

### Node Flow

```
接收PRD → 初始化Run → SSH初始化状态 → SSH Claude A分解PRD → 拓扑排序
    ↓
SplitInBatches任务分批 ⟷ SSH Claude B执行任务
    ↓
Code合并结果
    ↓
并行质检 (5路):
├─ SSH Bash - 硬检查
├─ SSH Claude C - 软检查
├─ SSH Bash - 安全扫描
├─ SSH Bash - 集成检查 (NEW)
└─ SSH Bash - 性能检查 (NEW)
    ↓
Code决策 → IF决策分支
    ├─ PASS → SSH Claude D生成文档
    └─ FAIL/REWORK → SSH更新状态
    ↓
HTTP飞书通知 → 返回结果
```

## Files

- **Source**: `/home/xx/dev/n8n-workflows/workflow-factory-v3.json`
- **Output**: `/home/xx/dev/n8n-workflows/workflow-factory-v4-qc.json`
