# Workflow Factory v4-QC - Enhanced Quality Check System

## Overview
This version adds comprehensive integration and performance quality checks to the AI Factory Workflow Production Line.

## What's New

### Two New Quality Check Nodes

1. **SSH Bash - 集成检查** (Integration Check)
   - Validates workflow node connections
   - Detects orphaned/disconnected nodes
   - Ensures API contract correctness
   - Severity: HIGH

2. **SSH Bash - 性能检查** (Performance Check)
   - Monitors workflow complexity
   - Checks node count limits (<50)
   - Validates code size (<500 lines per node)
   - Checks nesting depth (<3 levels)
   - Severity: LOW (warnings only)

### Enhanced Quality Pipeline

**5-Way Parallel QC System**:
1. Hard Check (Workflow existence) - CRITICAL
2. Soft Check (Code quality via Claude) - HIGH
3. Security Scan (Credential detection) - CRITICAL
4. Integration Check (Connections) - HIGH ★ NEW
5. Performance Check (Complexity) - LOW ★ NEW

### Improved Decision Logic

**3-Tier Severity System**:
- **CRITICAL** → FAIL (blocks deployment)
- **HIGH** → REWORK (requires fixes)
- **LOW** → PASS with warnings (informational)

## Files Included

| File | Size | Purpose |
|------|------|---------|
| `workflow-factory-v4-qc.json` | 29KB | Main workflow definition |
| `workflow-factory-v4-qc-summary.md` | 2.7KB | Feature summary |
| `workflow-factory-v4-qc-verification.md` | 2.3KB | QC checklist |
| `workflow-factory-v4-qc-diff.md` | 4.8KB | Detailed changes from v3 |
| `README-v4-qc.md` | This file | Overview documentation |

## Deployment

### Prerequisites
- n8n Cloud account: `localhost:5679`
- VPS SSH access: `146.190.52.84`
- Required credentials: SSH key `vvJsQOZ95sqzemla`

### Steps

1. **Import Workflow**
   ```bash
   # Option A: Via n8n UI
   # - Go to Workflows → Import
   # - Upload workflow-factory-v4-qc.json
   
   # Option B: Via API
   curl -X POST "http://localhost:5679/api/v1/workflows" \
     -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
     -H "Content-Type: application/json" \
     -d @workflow-factory-v4-qc.json
   ```

2. **Verify Nodes**
   - Total nodes should be: 19
   - Check all 5 QC nodes are present
   - Verify connections are correct

3. **Test Run**
   ```bash
   curl -X POST "http://localhost:5679/webhook/workflow-factory" \
     -H "Content-Type: application/json" \
     -d '{
       "prd": "创建一个简单的测试 workflow，包含 1 个 webhook 和 1 个 code 节点",
       "project": "test"
     }'
   ```

4. **Monitor Results**
   - Check Feishu notification for all 5 QC results
   - Review `/home/xx/data/runs/{run_id}/` for detailed logs
   - Verify decision logic (PASS/REWORK/FAIL)

## Quality Check Details

### Integration Check Script
```bash
# For each workflow created:
# 1. Fetch workflow via n8n API
# 2. Count nodes and connections
# 3. Validate connection completeness
# 4. Detect orphaned nodes
# Output: INTEGRATION_CHECK_RESULT|imports_ok=1|api_ok=1
```

### Performance Check Script
```bash
# For each workflow created:
# 1. Fetch workflow via n8n API
# 2. Count total nodes (limit: 50)
# 3. Check Code node line counts (limit: 500)
# 4. Count SplitInBatches nesting (limit: 3)
# Output: PERFORMANCE_CHECK_RESULT|size_ok=1|complexity_ok=1
```

## Example Output

### Successful Run
```json
{
  "status": "success",
  "run_id": "20251224203000-abc123",
  "decision": "PASS",
  "action": "质检通过，进入文档生成",
  "workflows_created": ["xyz123"],
  "checks": {
    "hardCheck": { "all_exist": true, "count": 1 },
    "softCheck": { "pass": true, "issues": 0 },
    "securityCheck": { "pass": true, "issues": 0 },
    "integrationCheck": { "imports_ok": true, "api_ok": true },
    "performanceCheck": { "size_ok": true, "complexity_ok": true }
  }
}
```

### Run with Performance Warnings
```json
{
  "status": "success",
  "run_id": "20251224203100-def456",
  "decision": "PASS",
  "action": "质检通过（有 1 个性能警告）",
  "issues": [
    {
      "severity": "low",
      "type": "performance",
      "message": "Workflow 复杂度过高（代码>500行或嵌套>3层）"
    }
  ]
}
```

## Troubleshooting

### Issue: Integration check fails
**Symptoms**: `imports_ok=0` or `api_ok=0`
**Solution**:
1. Check if workflow was actually created in n8n
2. Verify all nodes have proper connections
3. Look for orphaned nodes in workflow editor

### Issue: Performance check warns
**Symptoms**: `size_ok=0` or `complexity_ok=0`
**Solution**:
1. Split large Code nodes into smaller functions
2. Reduce total node count by combining steps
3. Flatten SplitInBatches nesting

### Issue: Decision always FAIL
**Symptoms**: `decision=FAIL` even when workflow looks OK
**Solution**:
1. Check `/home/xx/data/runs/{run_id}/state.json` for error details
2. Review all 5 QC outputs in execution logs
3. Ensure `.secrets` file has correct API keys

## Monitoring

### Key Metrics
- **QC Pass Rate**: Target >90%
- **Integration Issues**: Should be <5%
- **Performance Warnings**: Acceptable up to 20%

### Logs
- State directory: `/home/xx/data/runs/{run_id}/`
- QC outputs: Check each SSH node's `stdout` in n8n execution
- Feishu notifications: Real-time alerts

## Next Steps

After successful deployment:
1. Update `CLAUDE.md` to reference v4-qc as production
2. Archive or deprecate v3
3. Monitor for false positives in first week
4. Adjust thresholds if needed (50 nodes, 500 lines, 3 nesting)

## Version History

- **v4-QC** (2025-12-24): Added integration & performance checks
- **v3** (2025-12-24): 3-way QC system (hard, soft, security)
- **v2**: Basic quality checks
- **v1**: Initial workflow factory

## Support

For issues or questions:
- Check verification report: `workflow-factory-v4-qc-verification.md`
- Review diff document: `workflow-factory-v4-qc-diff.md`
- See detailed summary: `workflow-factory-v4-qc-summary.md`
