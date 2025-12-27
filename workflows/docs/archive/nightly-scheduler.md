# Nightly Scheduler Workflow

## Overview

Master scheduler workflow that orchestrates 4 sub-workflows daily at 19:00 UTC with failure handling and retry logic.

## Workflow Details

**Workflow ID**: `YFqEplFiSl5Qd3x9`
**URL**: https://zenithjoy21xx.app.n8n.cloud/workflow/YFqEplFiSl5Qd3x9
**Status**: Active
**MCP Availability**: Enabled
**Schedule**: Daily at 19:00 UTC (cron: `0 19 * * *`)

## Architecture

```
Schedule Trigger (19:00 UTC)
  → Initialize State
    → Execute: health-check → Record Result
      → Execute: log-triage → Record Result
        → Execute: backup → Record Result
          → Execute: cleanup → Record Result
            → Check Failures
              → Has Failures?
                ├─ Yes → Prepare Retries → Format Notification → Send Feishu
                └─ No  → Success Summary
```

## Sub-Workflows (Executed Serially)

| Order | Workflow | ID | Status |
|-------|----------|-----|--------|
| 1 | health-check | `iQcAqekgAq5VqDoW` | Deactivated |
| 2 | log-triage | `I8Y6qbuHQj2kZli8` | Deactivated |
| 3 | backup | `vYgFzW0938ZKnqE1` | Deactivated |
| 4 | cleanup | `I0QKU3f0ekgeDMdS` | Deactivated |

Note: Sub-workflows are deactivated because the master scheduler manages their execution timing.

## Features

### 1. Serial Execution
- Workflows execute one after another in defined order
- Each workflow's result is recorded before proceeding to the next
- `continueOnFail: true` ensures failures don't stop the chain

### 2. Result Tracking
After each workflow execution, a Code node records:
- Workflow name
- Success/failure status
- Error message (if failed)
- Attempt number
- Timestamp

### 3. Failure Detection
The "Check Failures" node analyzes all results and determines:
- Total workflows executed
- Number of failures
- Which workflows failed
- Detailed error messages

### 4. Retry Logic
The "Prepare Retries" node:
- Identifies failed workflows
- Prepares retry information (up to 2 additional attempts)
- Tracks retry attempts

Note: Current implementation documents retry logic but requires manual intervention. Full automated retry would need additional Execute Workflow nodes.

### 5. Notification System
If any workflow fails, sends a Feishu notification with:
- Total workflows executed
- Number of failures
- List of failed workflows with error details
- Retry status

**Feishu Webhook**: https://open.feishu.cn/open-apis/bot/v2/hook/5bde68e0-9879-4a45-88ed-461a88229136

## Workflow Configuration

### Settings
```json
{
  "executionOrder": "v1",
  "saveManualExecutions": true,
  "callerPolicy": "workflowsFromSameOwner",
  "availableInMCP": true
}
```

### Node Details

#### 1. Schedule Trigger
- Type: `n8n-nodes-base.scheduleTrigger`
- Cron: `0 19 * * *` (19:00 UTC daily)

#### 2. Initialize State
- Type: `n8n-nodes-base.set`
- Creates arrays for workflow IDs and results tracking

#### 3-6. Execute Workflow Nodes
- Type: `n8n-nodes-base.executeWorkflow`
- `continueOnFail: true` (prevents chain breaking)
- Dynamically references workflow IDs from state

#### 7-10. Record Nodes
- Type: `n8n-nodes-base.code`
- JavaScript code to track execution results
- Maintains results array throughout chain

#### 11. Check Failures
- Type: `n8n-nodes-base.code`
- Analyzes all results
- Filters for failures
- Calculates statistics

#### 12. Has Failures? (If Node)
- Type: `n8n-nodes-base.if`
- Condition: `$json.hasFailures === true`
- Two branches: failures → notification, success → summary

#### 13. Prepare Retries
- Type: `n8n-nodes-base.code`
- Documents retry logic for failed workflows

#### 14. Format Notification
- Type: `n8n-nodes-base.code`
- Formats message for Feishu
- Includes failure details

#### 15. Send Feishu Notification
- Type: `n8n-nodes-base.httpRequest`
- POST to Feishu webhook
- Sends formatted failure notification

#### 16. Success Summary
- Type: `n8n-nodes-base.code`
- Generates success report when no failures

## Testing

You can manually trigger the workflow via:
- n8n UI: Click "Test workflow" button
- MCP: Call via Claude Code MCP tools
- API: POST to execute endpoint

## Monitoring

Check execution history at:
https://zenithjoy21xx.app.n8n.cloud/workflow/YFqEplFiSl5Qd3x9/executions

## Future Enhancements

1. **Automated Retry**: Add actual retry execution nodes (not just documentation)
2. **Success Notifications**: Optional success notifications to Feishu
3. **Metrics Dashboard**: Track success/failure rates over time
4. **Parallel Execution**: Option to run non-dependent workflows in parallel
5. **Custom Schedules**: Different timing for different workflows
6. **Alert Escalation**: Progressive alerts for repeated failures

## Maintenance

To modify the scheduler:
1. Navigate to workflow in n8n UI
2. Edit nodes as needed
3. Test thoroughly before activating
4. Monitor first few scheduled runs

To add a new workflow:
1. Update "Initialize State" node with new workflow ID
2. Add Execute Workflow node
3. Add Record node after it
4. Update connections
5. Test the flow

---

**Created**: 2025-12-23
**Last Updated**: 2025-12-23
