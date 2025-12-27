# Social Metrics Master Workflow Specification

## Overview
This is the master workflow that orchestrates daily social media metrics collection across multiple platforms and accounts.

## Workflow Name
`social_metrics_master`

## Trigger
- **Type**: Cron
- **Schedule**: `5 9 * * *` (Every day at 09:05)
- **Timezone**: UTC

## Node Flow

### 1. Cron Trigger
- **Name**: Daily Trigger
- **Type**: Schedule Trigger
- **Schedule**: 09:05 daily

### 2. Get Accounts List
- **Name**: Get Accounts
- **Type**: HTTP Request
- **Method**: GET
- **URL**: `{{$env.COLLECTOR_API_BASE}}/v1/accounts`
- **Headers**:
  - `Authorization: Bearer {{$env.COLLECTOR_API_KEY}}`
- **Output**: Array of accounts with platform, accountId, displayName

### 3. Loop Accounts
- **Name**: Loop Each Account
- **Type**: Split In Batches
- **Batch Size**: 1
- **Options**: Keep Input Data

### 4. Health Check
- **Name**: Check Login Status
- **Type**: HTTP Request
- **Method**: POST
- **URL**: `{{$env.COLLECTOR_API_BASE}}/v1/healthcheck`
- **Headers**:
  - `Authorization: Bearer {{$env.COLLECTOR_API_KEY}}`
  - `Content-Type: application/json`
- **Body**:
```json
{
  "platform": "{{$json.platform}}",
  "accountId": "{{$json.accountId}}"
}
```
- **Retry**: 3 times, exponential backoff
- **Timeout**: 30s

### 5. Check Login Branch
- **Name**: Is Logged In?
- **Type**: IF
- **Condition**: `{{$json.loggedIn}} === true`

#### Branch A: Not Logged In
- **Name**: Notify Login Required
- **Type**: HTTP Request
- **Method**: POST
- **URL**: `{{$env.COLLECTOR_API_BASE}}/v1/notify/login_required`
- **Body**:
```json
{
  "platform": "{{$node['Loop Each Account'].json.platform}}",
  "accountId": "{{$node['Loop Each Account'].json.accountId}}",
  "reason": "{{$json.reason}}",
  "loginUrl": "https://console.yourdomain.com/login/{{$node['Loop Each Account'].json.platform}}/{{$node['Loop Each Account'].json.accountId}}"
}
```
- **Then**: Continue to next account (skip collection)

#### Branch B: Logged In
Continue to collection

### 6. Collect Daily Metrics
- **Name**: Collect Metrics
- **Type**: HTTP Request
- **Method**: POST
- **URL**: `{{$env.COLLECTOR_API_BASE}}/v1/collect_daily`
- **Headers**:
  - `Authorization: Bearer {{$env.COLLECTOR_API_KEY}}`
  - `Content-Type: application/json`
- **Body**:
```json
{
  "platform": "{{$node['Loop Each Account'].json.platform}}",
  "accountId": "{{$node['Loop Each Account'].json.accountId}}",
  "date": "{{new Date().toISOString().split('T')[0]}}"
}
```
- **Retry**: 3 times
- **Timeout**: 120s

### 7. Store Metrics
- **Name**: Store to Database
- **Type**: HTTP Request
- **Method**: POST
- **URL**: `{{$env.COLLECTOR_API_BASE}}/v1/store_metrics`
- **Body**: Pass through from Collect Metrics
- **Retry**: 3 times

### 8. Loop Complete Check
- **Name**: All Accounts Done?
- **Type**: IF
- **Condition**: Check if loop is complete

### 9. Generate Daily Report
- **Name**: Generate Report
- **Type**: HTTP Request
- **Method**: POST
- **URL**: `{{$env.COLLECTOR_API_BASE}}/v1/report_daily`
- **Body**:
```json
{
  "date": "{{new Date().toISOString().split('T')[0]}}"
}
```

### 10. Notify Team
- **Name**: Send Team Notification
- **Type**: HTTP Request
- **Method**: POST
- **URL**: `{{$env.COLLECTOR_API_BASE}}/v1/notify/team_daily`
- **Body**: Pass through from Generate Report

## Error Handling

### Global Error Workflow
For any node that fails after retries:

1. **Log Error**
   - **Type**: HTTP Request
   - **Method**: POST
   - **URL**: `{{$env.COLLECTOR_API_BASE}}/v1/logs`
   - **Body**:
```json
{
  "level": "error",
  "workflow": "social_metrics_master",
  "node": "{{$node.name}}",
  "platform": "{{$node['Loop Each Account'].json.platform}}",
  "accountId": "{{$node['Loop Each Account'].json.accountId}}",
  "error": "{{$json.error}}",
  "meta": "{{$json}}"
}
```

2. **Send Alert**
   - **Type**: HTTP Request
   - **Method**: POST
   - **URL**: `{{$env.COLLECTOR_API_BASE}}/v1/notify/ops_alert`
   - **Body**: Similar to log

## Environment Variables Required
- `COLLECTOR_API_BASE`: Base URL for Collector API
- `COLLECTOR_API_KEY`: API key for authentication

## Expected Data Structures

### Account Object
```json
{
  "platform": "xhs",
  "accountId": "a1",
  "displayName": "小红书-主号"
}
```

### Health Check Response
```json
{
  "loggedIn": true
}
```
or
```json
{
  "loggedIn": false,
  "reason": "storageState expired or redirected to login"
}
```

### Metrics Response
```json
{
  "platform": "xhs",
  "accountId": "a1",
  "date": "2025-12-19",
  "followers_total": 12345,
  "followers_delta": 120,
  "impressions": 456789,
  "engagements": 12345,
  "posts_published": 2,
  "top_post_url": "https://...",
  "top_post_engagement": 3456
}
```

## Activation
- **Default**: `active: false`
- **Manual Activation**: After visual confirmation in n8n UI
- **Script Activation**: Use `--activate` flag in deploy script
