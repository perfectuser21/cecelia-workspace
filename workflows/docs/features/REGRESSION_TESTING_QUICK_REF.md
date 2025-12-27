# Regression Testing Quick Reference

## Overview
Automated regression testing for AI Workflow Factory (Pain Point #27)

## Quick Start

### Check Test Results
```bash
# After a workflow factory run
cat /home/xx/data/runs/{RUN_ID}/qc/regression.json
```

### Add Custom Test
```bash
# 1. Create test script
cat > /home/xx/dev/n8n-workflows/regression_tests/my_test.sh << 'EOF'
#!/bin/bash
WORKFLOW_IDS="$1"
source /home/xx/dev/n8n-workflows/.secrets 2>/dev/null || exit 1

# Your test logic here
for wid in $WORKFLOW_IDS; do
  # Validate workflow
  echo "Checking $wid"
done

exit 0
EOF

# 2. Make executable
chmod +x /home/xx/dev/n8n-workflows/regression_tests/my_test.sh

# 3. Test runs automatically on next workflow factory execution
```

### Use Template
```bash
cd /home/xx/dev/n8n-workflows/regression_tests
mv example_webhook_test.sh.template webhook_test.sh
chmod +x webhook_test.sh
# Edit webhook_test.sh as needed
```

## Built-in Tests

| Test | What It Checks | Failure Criteria |
|------|----------------|------------------|
| workflow_nodes_exist | Workflows have nodes | Empty workflow (0 nodes) |
| connections_valid | Multi-node connections | Multi-node workflow with 0 connections |
| previous_run_intact | Historical workflows exist | Workflows from previous runs deleted |
| custom_regression_test | Custom *.sh scripts | Script exits with non-zero code |

## Output Format

```json
{
  "check": "regression",
  "tests_run": 3,
  "tests_passed": 3,
  "tests_failed": 0,
  "pass": true,
  "details": [
    {"test": "workflow_nodes_exist", "workflow_id": "abc", "passed": true},
    {"test": "connections_valid", "workflow_id": "abc", "passed": true},
    {"test": "previous_run_intact", "run_id": "run_123", "passed": true}
  ]
}
```

## Decision Logic

- **All pass** → No impact
- **Any fail** → Decision becomes `REWORK` (unless already `FAIL`)
- **Failed tests** → Logged to console

## Execution Flow

```
Workflow Factory Run
    ↓
QC Phase
    ↓
[7/7+1] Regression Tests
    ↓
4 built-in tests + custom *.sh scripts
    ↓
Generate regression.json
    ↓
Decision checks regression.pass
    ↓
If fail → REWORK
```

## Common Tasks

### View Last Test Results
```bash
# Find latest run
ls -t /home/xx/data/runs/ | head -1

# View regression results
cat /home/xx/data/runs/$(ls -t /home/xx/data/runs/ | head -1)/qc/regression.json | jq '.'
```

### Debug Failed Test
```bash
# Run custom test manually
bash /home/xx/dev/n8n-workflows/regression_tests/my_test.sh "workflow_id_1 workflow_id_2"
```

### Disable Specific Test
```bash
# Rename to .disabled
mv my_test.sh my_test.sh.disabled
```

## Files & Locations

| File | Purpose |
|------|---------|
| `/home/xx/bin/workflow-factory.sh` | Main script with regression tests |
| `/home/xx/dev/n8n-workflows/regression_tests/` | Test scripts directory |
| `$STATE_DIR/qc/regression.json` | Test results for each run |
| `regression_tests/README.md` | Detailed test documentation |

## Test Script Template

```bash
#!/bin/bash
# Test: Description

WORKFLOW_IDS="$1"

# Load credentials
source /home/xx/dev/n8n-workflows/.secrets 2>/dev/null || {
  echo "Error: Cannot load secrets"
  exit 1
}

# Validate each workflow
for wid in $WORKFLOW_IDS; do
  if [[ -z "$wid" ]]; then continue; fi

  # Fetch workflow
  wf=$(curl -s -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
    "https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/$wid")

  # Your validation here
  # ...

  if [[ $validation_failed ]]; then
    echo "Error: Validation failed for $wid"
    exit 1
  fi
done

echo "Test passed"
exit 0
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Test not running | Check file extension is `.sh`, not `.sh.template` |
| Permission denied | Run `chmod +x test_name.sh` |
| API errors | Verify `.secrets` file has valid `N8N_REST_API_KEY` |
| No tests found | Create at least one `.sh` file in `regression_tests/` |

## Performance

- Execution time: ~2 seconds
- API calls: ~3 per workflow + 3 historical
- Storage: ~1-2 KB per run

## See Also

- Full Guide: `REGRESSION_TESTING_GUIDE.md`
- Implementation Summary: `REGRESSION_TESTING_SUMMARY.md`
- Test Examples: `regression_tests/*.template`
