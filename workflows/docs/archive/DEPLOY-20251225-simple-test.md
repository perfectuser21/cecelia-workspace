# Deployment Guide: Simple Ping Webhook

**Run ID**: `20251225-simple-test`  
**Created**: 2025-12-25  
**Status**: ⚠️ Failed (0/1 completed)

## Overview

This document covers the attempted deployment of a simple Ping webhook workflow in n8n Cloud.

## Requirements

### Prerequisites
- n8n Cloud account (zenithjoy21xx.app.n8n.cloud)
- n8n REST API Key (stored in `.secrets`)
- n8n MCP Server access

### Environment

```
n8n Server: https://zenithjoy21xx.app.n8n.cloud
MCP Endpoint: https://zenithjoy21xx.app.n8n.cloud/mcp-server/http
Region: Cloud
```

## Deployment Steps

### Step 1: Verify Prerequisites

```bash
# Check API credentials
grep N8N_MCP_API_KEY ~/.secrets

# Test connectivity
curl -s https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows \
  -H "X-N8N-API-KEY: $(grep N8N_REST_API_KEY ~/.secrets | cut -d= -f2)"
```

### Step 2: Create Workflow via MCP

The workflow creation failed during automated execution. Use one of these approaches:

#### Option A: Manual Creation via n8n UI

1. Open https://zenithjoy21xx.app.n8n.cloud
2. Click "New Workflow"
3. Add nodes:
   - **Webhook**: Path `/webhook/ping`, Method `ANY`
   - **Respond to Webhook**: JSON body `{"message": "pong"}`
4. Save and activate
5. Copy workflow ID from URL

#### Option B: Retry via MCP

```bash
# Re-execute the factory workflow
curl -X POST "https://zenithjoy21xx.app.n8n.cloud/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{
    "prd": "创建一个简单的 Ping webhook 返回 pong",
    "project": "simple-test"
  }'
```

#### Option C: Direct n8n REST API

```bash
# Get your API key
export N8N_API_KEY=$(grep N8N_REST_API_KEY ~/.secrets | cut -d= -f2)

# Create workflow
curl -X POST "https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ping Webhook",
    "nodes": [
      {
        "id": "webhook",
        "type": "n8n-nodes-base.webhook",
        "position": [250, 300],
        "parameters": {
          "path": "ping",
          "responseMode": "responseNode",
          "httpMethod": "ANY"
        }
      },
      {
        "id": "response",
        "type": "n8n-nodes-base.respondToWebhook",
        "position": [500, 300],
        "parameters": {
          "responseBody": "{\"message\": \"pong\"}"
        }
      }
    ],
    "connections": {
      "webhook": {
        "main": [
          [{"node": "response", "branch": 0, "type": "main", "index": 0}]
        ]
      }
    }
  }'
```

### Step 3: Activate Workflow

After creation, activate the workflow:

```bash
export N8N_API_KEY=$(grep N8N_REST_API_KEY ~/.secrets | cut -d= -f2)
export WORKFLOW_ID="<copy-from-previous-response>"

curl -X PATCH "https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/$WORKFLOW_ID" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active": true}'
```

### Step 4: Test Endpoint

```bash
# Test the webhook
curl -X GET "https://zenithjoy21xx.app.n8n.cloud/webhook/ping"

# Expected response
# {"message": "pong"}
```

## Workflow Specification

| Property | Value |
|----------|-------|
| Name | Ping Webhook |
| Webhook Path | `/webhook/ping` |
| HTTP Methods | ANY (GET, POST, PUT, DELETE, PATCH) |
| Response | `{"message": "pong"}` |
| Response Mode | Send immediately from response node |
| Status | Should be Active |

## Nodes

### 1. Webhook (Trigger)
- **Type**: n8n-nodes-base.webhook
- **Path**: `ping`
- **Methods**: ANY
- **Response Mode**: Response Node

### 2. Respond to Webhook
- **Type**: n8n-nodes-base.respondToWebhook
- **Response Body**: `{"message": "pong"}`

## Testing

### Basic Test
```bash
curl https://zenithjoy21xx.app.n8n.cloud/webhook/ping
```

### With Parameters
```bash
curl "https://zenithjoy21xx.app.n8n.cloud/webhook/ping?name=test"
```

### POST Request
```bash
curl -X POST https://zenithjoy21xx.app.n8n.cloud/webhook/ping \
  -H "Content-Type: application/json" \
  -d '{"data": "test"}'
```

## Troubleshooting

### Webhook Returns 404
- Ensure workflow is **Active**
- Verify correct webhook path (`/webhook/ping`)
- Check n8n logs for errors

### MCP Execution Failed
- Verify API key in `.secrets` is correct
- Test n8n connectivity: `curl https://zenithjoy21xx.app.n8n.cloud`
- Check firewall/proxy rules

### Webhook Not Responding
- Access n8n UI and check execution logs
- Verify webhook trigger is configured correctly
- Check response node has correct JSON payload

## Rollback

If issues occur, simply deactivate the workflow:

```bash
export N8N_API_KEY=$(grep N8N_REST_API_KEY ~/.secrets | cut -d= -f2)
export WORKFLOW_ID="<workflow-id>"

curl -X PATCH "https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/$WORKFLOW_ID" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active": false}'
```

## Execution Log

```
Run ID: 20251225-simple-test
Task 1: Create Ping Webhook Workflow
  Status: ❌ Failed
  Model: Haiku
  Duration: Unknown
  
Summary:
  - Total tasks: 1
  - Success: 0
  - Failed: 1
  - Skipped: 0
```

## References

- **AI Factory**: Workflow Production Line (ID: VQSeOX886lchEATW)
- **n8n Docs**: https://docs.n8n.io/
- **Webhook Trigger**: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/
- **HTTP Methods**: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS

## Support

For issues with this deployment:

1. Check `.secrets` file has correct API keys
2. Review n8n execution logs in UI
3. Test n8n connectivity directly
4. Consult AI Factory error analysis
5. Fall back to manual creation in n8n UI
