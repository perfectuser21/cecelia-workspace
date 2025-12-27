# Collector API Contract

## Base URL
All endpoints are prefixed with the `COLLECTOR_API_BASE` environment variable.

## Authentication
All requests must include:
```
Authorization: Bearer {COLLECTOR_API_KEY}
```

## Endpoints

### 1. Get Accounts List
```
GET /v1/accounts
```

**Response 200:**
```json
[
  {
    "platform": "xhs",
    "accountId": "a1",
    "displayName": "小红书-主号"
  },
  {
    "platform": "weibo",
    "accountId": "a2",
    "displayName": "微博-主号"
  }
]
```

---

### 2. Health Check (Login Status)
```
POST /v1/healthcheck
```

**Request Body:**
```json
{
  "platform": "xhs",
  "accountId": "a1"
}
```

**Response 200 (Logged In):**
```json
{
  "loggedIn": true
}
```

**Response 200 (Not Logged In):**
```json
{
  "loggedIn": false,
  "reason": "storageState expired or redirected to login"
}
```

---

### 3. Collect Daily Metrics
```
POST /v1/collect_daily
```

**Request Body:**
```json
{
  "platform": "xhs",
  "accountId": "a1",
  "date": "2025-12-19"
}
```

**Response 200:**
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

---

### 4. Store Metrics
```
POST /v1/store_metrics
```

**Request Body:**
Pass through the metrics object from `collect_daily`

**Response 200:**
```json
{
  "ok": true,
  "id": "metric_12345"
}
```

---

### 5. Generate Daily Report
```
POST /v1/report_daily
```

**Request Body:**
```json
{
  "date": "2025-12-19"
}
```

**Response 200:**
```json
{
  "ok": true,
  "notionPageId": "page_xxx",
  "summaryText": "Today's summary: 10 accounts processed, +1234 followers total...",
  "metrics": {
    "total_accounts": 10,
    "total_followers_delta": 1234,
    "total_impressions": 567890,
    "total_engagements": 45678
  }
}
```

---

### 6. Notify: Login Required
```
POST /v1/notify/login_required
```

**Request Body:**
```json
{
  "platform": "xhs",
  "accountId": "a1",
  "reason": "storageState expired",
  "loginUrl": "https://console.yourdomain.com/login/xhs/a1"
}
```

**Response 200:**
```json
{
  "ok": true,
  "notified": ["admin@example.com"]
}
```

---

### 7. Notify: Team Daily Report
```
POST /v1/notify/team_daily
```

**Request Body:**
```json
{
  "date": "2025-12-19",
  "summaryText": "...",
  "notionUrl": "https://notion.so/page_xxx"
}
```

**Response 200:**
```json
{
  "ok": true,
  "channels": ["slack", "feishu"]
}
```

---

### 8. Notify: Ops Alert
```
POST /v1/notify/ops_alert
```

**Request Body:**
```json
{
  "where": "n8n",
  "workflow": "social_metrics_master",
  "node": "collect_daily",
  "platform": "xhs",
  "accountId": "a1",
  "error": "Timeout after 120s",
  "meta": {}
}
```

**Response 200:**
```json
{
  "ok": true,
  "alertId": "alert_12345"
}
```

---

### 9. Logging
```
POST /v1/logs
```

**Request Body:**
```json
{
  "level": "error",
  "platform": "xhs",
  "accountId": "a1",
  "message": "Collection failed",
  "meta": {
    "workflow": "social_metrics_master",
    "node": "collect_daily"
  }
}
```

**Response 200:**
```json
{
  "ok": true,
  "logId": "log_12345"
}
```

---

## Error Responses

All endpoints may return:

**400 Bad Request:**
```json
{
  "error": "Invalid request",
  "details": "Missing required field: platform"
}
```

**401 Unauthorized:**
```json
{
  "error": "Invalid API key"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error",
  "message": "Database connection failed"
}
```

## Rate Limiting
- Default: 100 requests per minute per API key
- Burst: 20 requests per second

## Timeouts
- Health Check: 30s
- Collect Daily: 120s
- Other endpoints: 30s
