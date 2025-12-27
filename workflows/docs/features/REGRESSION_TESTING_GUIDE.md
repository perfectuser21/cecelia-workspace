# Regression Testing Guide

## Overview

The AI Workflow Factory now includes automated regression testing to prevent modifications from breaking existing functionality. This addresses **Pain Point #27** from the specification.

## How It Works

Regression tests run automatically during the QC phase (step 7/7+1) of every workflow factory execution. Tests validate that:

1. Workflows have proper node structure
2. Connections are valid
3. Previous successful runs remain intact
4. Custom validation scripts pass

## Test Output

Results are saved to `$STATE_DIR/qc/regression.json`:

```json
{
  "check": "regression",
  "tests_run": 3,
  "tests_passed": 3,
  "tests_failed": 0,
  "pass": true,
  "details": [
    {
      "test": "workflow_nodes_exist",
      "workflow_id": "abc123",
      "passed": true
    },
    {
      "test": "connections_valid",
      "workflow_id": "abc123",
      "passed": true
    },
    {
      "test": "previous_run_intact",
      "run_id": "run_20251224_120000",
      "passed": true
    }
  ]
}
```

## Built-in Tests

### 1. Workflow Nodes Exist
Validates that created workflows contain nodes.

**Pass Criteria:**
- Workflow has at least one node, OR
- Workflow has webhook node configured

**Failure:**
- Empty workflow (0 nodes)

### 2. Connections Valid
Ensures multi-node workflows have proper connections.

**Pass Criteria:**
- Single-node workflows (allowed to have 0 connections)
- Multi-node workflows with at least 1 connection

**Failure:**
- Multi-node workflow with 0 connections

### 3. Previous Run Intact
Checks that workflows from the last 3 successful runs still exist.

**Pass Criteria:**
- All workflows from previous successful runs are accessible via API

**Failure:**
- One or more workflows from previous runs have been deleted or are inaccessible

### 4. Custom Regression Tests
Executes any `.sh` scripts found in `/home/xx/dev/zenithjoy-autopilot/workflows/regression_tests/`.

**Pass Criteria:**
- Script exits with code 0

**Failure:**
- Script exits with non-zero code

## Writing Custom Tests

Create test scripts in `/home/xx/dev/zenithjoy-autopilot/workflows/regression_tests/`:

```bash
#!/bin/bash
# Example: test_unique_webhooks.sh

WORKFLOW_IDS="$1"

# Load API credentials
source /home/xx/dev/zenithjoy-autopilot/workflows/.secrets 2>/dev/null || exit 1

# Your test logic here
for wid in $WORKFLOW_IDS; do
  # Fetch and validate workflow
  wf_content=$(curl -s -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
    "https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/$wid" 2>/dev/null)

  # Validation logic
  # ...

  if [[ $validation_failed ]]; then
    echo "Error: validation failed for workflow $wid"
    exit 1
  fi
done

echo "Test passed"
exit 0
```

## Template Tests

Three example test templates are provided in `regression_tests/`:

1. **example_webhook_test.sh.template** - Validates webhook path uniqueness
2. **example_node_validation.sh.template** - Checks node configuration
3. **example_performance_check.sh.template** - Validates workflow complexity

To activate a template:
```bash
cd /home/xx/dev/zenithjoy-autopilot/workflows/regression_tests
mv example_webhook_test.sh.template test_webhooks.sh
chmod +x test_webhooks.sh
```

## Decision Logic

Regression test results affect the quality control decision:

- **All tests pass** → No impact on decision
- **Any test fails** → Decision becomes `REWORK` (unless already `FAIL`)
- **Failed test details** → Logged to console and decision.json

## Integration with QC Pipeline

The regression testing function is called as part of `run_qc_checks()`:

```bash
# 7.8 回归测试
log "  [7/7+1] 回归测试"
run_regression_tests
```

Results are included in the final summary report under `qc.regression`.

## Best Practices

1. **Keep tests fast** - Regression tests should complete in seconds
2. **Make tests idempotent** - Tests should be runnable multiple times
3. **Don't modify workflows** - Only validate, never change
4. **Provide clear error messages** - Help identify what failed and why
5. **Use templates as starting points** - Customize for your specific needs

## Troubleshooting

### Test not running
- Ensure file has `.sh` extension (not `.sh.template`)
- Verify file is executable (`chmod +x test.sh`)
- Check that test is in correct directory

### Test failing unexpectedly
- Run test manually with workflow IDs: `bash test.sh "workflow_id_1 workflow_id_2"`
- Check that `.secrets` file is accessible
- Verify API credentials are valid

### No regression tests found
- Default behavior: Creates minimal passing test
- Add custom tests to `/home/xx/dev/zenithjoy-autopilot/workflows/regression_tests/`

## Future Enhancements

Potential improvements to regression testing:

- **Snapshot testing** - Compare workflow structure against known good state
- **Performance benchmarks** - Track execution time trends
- **Integration tests** - Actually execute workflows and validate output
- **Visual diff** - Show structural changes between versions
- **Test coverage metrics** - Track what percentage of workflows have tests

## Files Modified

- `/home/xx/bin/workflow-factory.sh` - Added `run_regression_tests()` function
- `/home/xx/dev/zenithjoy-autopilot/workflows/regression_tests/` - New directory for tests
- Decision logic updated to check regression results

## See Also

- [AI Factory README](/home/xx/dev/zenithjoy-autopilot/workflows/AI-FACTORY-README.md)
- [Regression Tests Directory](/home/xx/dev/zenithjoy-autopilot/workflows/regression_tests/README.md)
- [CLAUDE.md Project Instructions](/home/xx/dev/zenithjoy-autopilot/workflows/CLAUDE.md)
