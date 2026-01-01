# API Documentation: Ping Webhook

**Workflow**: Simple Ping Webhook  
**Run ID**: `20251225-simple-test`  
**Endpoint**: `http://localhost:5679/webhook/ping`

## Overview

The Ping Webhook is a minimal HTTP endpoint that responds with a simple acknowledgment message. It accepts any HTTP method and returns a JSON payload.

## Endpoint Specification

```
Base URL: http://localhost:5679/webhook/ping
Methods:  GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
Response: application/json
Timeout:  30 seconds (n8n default)
```

## Request

### HTTP Methods

All methods are supported without modification:

| Method | Use Case |
|--------|----------|
| GET | Health check, simple ping |
| POST | Send data for processing |
| PUT | Update operations |
| DELETE | Cleanup or removal |
| PATCH | Partial updates |
| HEAD | Check availability |
| OPTIONS | CORS preflight |

### Headers

Standard HTTP headers are accepted. None are required.

```bash
# Minimal request (no headers)
curl http://localhost:5679/webhook/ping

# With custom headers (optional)
curl -H "X-Custom-Header: value" \
  http://localhost:5679/webhook/ping
```

### Query Parameters

Query parameters are accepted but not required by this workflow.

```bash
# With query parameters
curl "http://localhost:5679/webhook/ping?name=test&version=1.0"
```

### Request Body

For POST/PUT/PATCH requests, any JSON body is accepted:

```bash
curl -X POST http://localhost:5679/webhook/ping \
  -H "Content-Type: application/json" \
  -d '{
    "user": "alice",
    "timestamp": "2025-12-25T10:30:00Z"
  }'
```

## Response

### Success Response (HTTP 200)

```json
{
  "message": "pong"
}
```

### Response Headers

```
Content-Type: application/json
Content-Length: 20
```

## Examples

### Example 1: Simple GET Request

**Request:**
```bash
curl -v http://localhost:5679/webhook/ping
```

**Response:**
```
HTTP/1.1 200 OK
Content-Type: application/json

{"message": "pong"}
```

### Example 2: POST with Data

**Request:**
```bash
curl -X POST http://localhost:5679/webhook/ping \
  -H "Content-Type: application/json" \
  -d '{"action": "test"}'
```

**Response:**
```json
{
  "message": "pong"
}
```

### Example 3: Health Check with Timeout

**Request:**
```bash
curl --max-time 5 \
  http://localhost:5679/webhook/ping
```

**Response:**
```json
{
  "message": "pong"
}
```

## Use Cases

### 1. Service Health Check

Monitor service availability with simple ping requests:

```bash
#!/bin/bash
response=$(curl -s http://localhost:5679/webhook/ping)
if [ $? -eq 0 ]; then
  echo "Service is UP"
else
  echo "Service is DOWN"
fi
```

### 2. Load Balancer Probe

Configure as a health check endpoint:

```
Health Check URL: http://localhost:5679/webhook/ping
Method: GET
Expected Status: 200
Interval: 30 seconds
Timeout: 5 seconds
```

### 3. Uptime Monitoring

Periodic monitoring from external service:

```javascript
setInterval(async () => {
  const response = await fetch('http://localhost:5679/webhook/ping');
  console.log('Status:', response.status === 200 ? 'UP' : 'DOWN');
}, 60000); // Every minute
```

### 4. Webhook Testing

Validate webhook connectivity before deploying to production:

```bash
# Test webhook from CI/CD pipeline
if curl -f http://localhost:5679/webhook/ping > /dev/null 2>&1; then
  echo "Webhook is reachable"
  exit 0
else
  echo "Webhook is unreachable"
  exit 1
fi
```

## Error Handling

### HTTP 404 - Not Found

Workflow is inactive or path is incorrect.

**Solution:**
```bash
# Verify workflow is active
n8n-api GET /workflows/{id}

# Activate if needed
n8n-api PATCH /workflows/{id} -d '{"active": true}'
```

### HTTP 500 - Internal Server Error

Unexpected error in workflow execution.

**Solution:**
- Check n8n logs
- Review workflow in n8n UI
- Verify webhook trigger configuration
- Check response node setup

### Timeout

Workflow execution exceeds timeout.

**Solution:**
- Simplify workflow if possible
- Check n8n system resources
- Increase client timeout if acceptable

## Performance

### Response Time

Expected response time: **< 100ms** for simple ping

### Throughput

- n8n Cloud: Supports moderate concurrent requests
- Rate limiting: Not configured (use client-side throttling)

### Scalability

For high-volume scenarios:
1. Consider dedicated webhook runner
2. Implement request queuing
3. Use load balancing if needed

## Security

### HTTPS

All endpoints use HTTPS. HTTP is not supported.

### Authentication

Currently no authentication is configured. For sensitive operations:

```bash
# Add authentication token requirement in future iterations
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:5679/webhook/ping
```

### CORS

CORS headers are handled by n8n. For cross-origin requests:

```javascript
fetch('http://localhost:5679/webhook/ping', {
  method: 'GET',
  mode: 'cors',
  credentials: 'include'
})
.then(r => r.json())
.catch(err => console.error('CORS error:', err));
```

## Monitoring

### Log Execution

View webhook executions in n8n UI:

```
Menu → Executions → Filter by Webhook
```

### Metrics to Track

- Response time per request
- Success vs failure rate
- Total requests per day
- Error types and frequencies

## Integration Examples

### JavaScript/Node.js

```javascript
const response = await fetch('http://localhost:5679/webhook/ping');
const data = await response.json();
console.log(data.message); // "pong"
```

### Python

```python
import requests

response = requests.get('http://localhost:5679/webhook/ping')
print(response.json())  # {'message': 'pong'}
```

### Bash/cURL

```bash
curl http://localhost:5679/webhook/ping
```

### Go

```go
resp, err := http.Get("http://localhost:5679/webhook/ping")
if err != nil {
  log.Fatal(err)
}
defer resp.Body.Close()
```

## Webhook Activation Status

| Status | Accessible | Notes |
|--------|-----------|-------|
| Active | ✅ Yes | Responds to requests |
| Inactive | ❌ No | Returns 404 |
| Deleted | ❌ No | Not found in n8n |

## Future Enhancements

Potential improvements for this workflow:

1. **Authentication**: Add API key validation
2. **Logging**: Detailed request/response logging
3. **Metrics**: Return uptime and latency stats
4. **Versioning**: Support API versioning
5. **Rate Limiting**: Implement request throttling
6. **Caching**: Cache responses if applicable
7. **Analytics**: Track usage patterns

## Support & Troubleshooting

### Webhook Not Responding

```bash
# 1. Verify endpoint is reachable
curl -v http://localhost:5679/webhook/ping

# 2. Check workflow status in n8n UI
# Menu → Workflows → Simple Ping Webhook

# 3. Review execution logs
# Menu → Executions → Filter by workflow name

# 4. Test connectivity
ping localhost:5679
```

### Related Documentation

- Deployment Guide: `DEPLOY-20251225-simple-test.md`
- AI Factory: `AI-FACTORY-README.md`
- n8n Webhook Docs: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/
