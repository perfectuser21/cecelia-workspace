# Regression Tests

This directory contains regression test scripts for the AI Workflow Factory.

## Purpose

Regression tests ensure that modifications to workflows don't break existing functionality. They are executed automatically during the QC phase of the workflow factory.

## Test Structure

Each test is a bash script that:
1. Receives workflow IDs as the first argument
2. Performs validation checks
3. Exits with 0 for success, non-zero for failure

## Writing Tests

Create a new test file (must end in `.sh`):

```bash
#!/bin/bash
# Test: Check for specific node configuration

WORKFLOW_IDS="$1"

# Your test logic here
# Return 0 for pass, 1 for fail

exit 0
```

## Built-in Tests

The regression testing system includes these built-in checks:

1. **workflow_nodes_exist** - Validates that workflows have nodes
2. **connections_valid** - Ensures multi-node workflows have connections
3. **previous_run_intact** - Checks that workflows from previous successful runs still exist
4. **custom_regression_test** - Executes any `.sh` scripts in this directory

## Output Format

Test results are saved to `$STATE_DIR/qc/regression.json`:

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

## Best Practices

1. Keep tests lightweight and fast
2. Use descriptive test names
3. Provide clear failure reasons in output
4. Don't modify workflows - only validate them
5. Make tests idempotent (can run multiple times)

## Integration

Regression tests run automatically during QC as step 7/7+1, after all other quality checks.
