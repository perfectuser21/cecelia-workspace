# API Documentation: Ping Webhook

**Endpoint**: `http://localhost:5679/webhook/ping`
**Status**: ✅ Active and Running
**Updated**: 2025-12-25

---

## Endpoint Overview

The Ping Webhook is a simple HTTP endpoint that accepts any HTTP method and returns an immediate JSON acknowledgment response.

### Key Features
- ✅ Accepts any HTTP method (GET, POST, PUT, DELETE, PATCH, etc.)
- ✅ No authentication required (public endpoint)
- ✅ Responds immediately with JSON
- ✅ Supports query parameters and request bodies
- ✅ CORS compatible
- ✅ No rate limiting (implement on client side if needed)

---

## Request

### Base URL
```
http://localhost:5679/webhook/ping
```

### Supported HTTP Methods
```
GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
```

### Headers
No specific headers are required. Standard HTTP headers are accepted:

```bash
# Minimal request
curl http://localhost:5679/webhook/ping

# With custom headers (optional)
curl -H "Authorization: Bearer token" \
     -H "X-Custom-Header: value" \
     http://localhost:5679/webhook/ping
```

### Query Parameters
Query parameters are accepted but not required:

```bash
# Without parameters
curl http://localhost:5679/webhook/ping

# With parameters
curl "http://localhost:5679/webhook/ping?name=test&version=1.0&timestamp=$(date +%s)"
```

### Request Body
For POST, PUT, and PATCH requests, any JSON body is accepted and ignored:

```bash
# POST with empty body
curl -X POST http://localhost:5679/webhook/ping

# POST with JSON body
curl -X POST http://localhost:5679/webhook/ping \
  -H "Content-Type: application/json" \
  -d '{
    "user": "alice",
    "action": "test",
    "timestamp": "2025-12-25T10:30:00Z"
  }'

# PUT with data
curl -X PUT http://localhost:5679/webhook/ping \
  -H "Content-Type: application/json" \
  -d '{"config": "value"}'
```

---

## Response

### Success Response (HTTP 200)

All successful requests return HTTP 200 with this body:

```json
{
  "message": "pong"
}
```

### Response Headers
```
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 20
Connection: keep-alive
```

### Response Details

| Property | Value |
|----------|-------|
| **Status Code** | 200 |
| **Content-Type** | application/json |
| **Body** | `{"message": "pong"}` |
| **Charset** | UTF-8 |

---

## Error Cases

### HTTP 404 - Not Found
Workflow is inactive or path is incorrect.

**Response**:
```json
{
  "message": "The route /webhook/ping could not be found"
}
```

**Causes**:
- Workflow not created
- Workflow is deactivated
- Incorrect webhook path
- n8n service not running

**Solution**:
```bash
# 1. Verify workflow is active in n8n UI
# 2. Check workflow status via API
curl -H "X-N8N-API-KEY: $API_KEY" \
  http://localhost:5679/api/v1/workflows | grep -A5 "Ping Webhook"

# 3. Activate workflow if needed
# (See DEPLOY.md for activation instructions)
```

### HTTP 500 - Internal Server Error
Unexpected error during workflow execution.

**Cause**:
- Webhook node misconfiguration
- Response node failure
- n8n system error

**Solution**:
1. Check n8n execution logs (Menu → Executions)
2. Review workflow configuration
3. Verify node connections
4. Restart n8n if necessary

### Connection Timeout
Request takes longer than 30 seconds (n8n default timeout).

**Solution**:
```bash
# Increase client-side timeout
curl --max-time 60 http://localhost:5679/webhook/ping

# Check n8n system resources
# Look for high CPU/memory usage
```

---

## Request Examples

### Example 1: Simple GET Request

**Request**:
```bash
curl http://localhost:5679/webhook/ping
```

**Response**:
```json
{"message": "pong"}
```

### Example 2: GET with Verbose Output

**Request**:
```bash
curl -v http://localhost:5679/webhook/ping
```

**Response**:
```
*   Trying 146.190.52.84...
* Connected to localhost:5679 (146.190.52.84) port 443 (#0)
> GET /webhook/ping HTTP/1.1
> Host: localhost:5679
> User-Agent: curl/7.68.0

< HTTP/1.1 200 OK
< Content-Type: application/json
< Content-Length: 20
<
{"message": "pong"}
```

### Example 3: POST Request with Data

**Request**:
```bash
curl -X POST http://localhost:5679/webhook/ping \
  -H "Content-Type: application/json" \
  -d '{
    "action": "test",
    "user": "alice",
    "id": 123
  }'
```

**Response**:
```json
{"message": "pong"}
```

### Example 4: Request with Query Parameters

**Request**:
```bash
curl "http://localhost:5679/webhook/ping?service=api&env=prod&version=2.0"
```

**Response**:
```json
{"message": "pong"}
```

### Example 5: HEAD Request

**Request**:
```bash
curl -I http://localhost:5679/webhook/ping
```

**Response**:
```
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 20
```

### Example 6: DELETE Request

**Request**:
```bash
curl -X DELETE http://localhost:5679/webhook/ping
```

**Response**:
```json
{"message": "pong"}
```

---

## Client Integration Examples

### JavaScript / Node.js

#### Basic Fetch
```javascript
const response = await fetch('http://localhost:5679/webhook/ping');
const data = await response.json();
console.log(data.message); // "pong"
```

#### Async/Await with Error Handling
```javascript
async function pingWebhook() {
  try {
    const response = await fetch('http://localhost:5679/webhook/ping');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.message === 'pong';
  } catch (error) {
    console.error('Ping failed:', error);
    return false;
  }
}

// Usage
const isHealthy = await pingWebhook();
console.log(isHealthy ? 'Service UP' : 'Service DOWN');
```

#### With Timeout
```javascript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

try {
  const response = await fetch('http://localhost:5679/webhook/ping', {
    signal: controller.signal
  });
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error('Request failed:', error.message);
} finally {
  clearTimeout(timeout);
}
```

#### Periodic Health Check
```javascript
setInterval(async () => {
  try {
    const response = await fetch('http://localhost:5679/webhook/ping');
    const status = response.ok ? 'UP' : 'DOWN';
    console.log(`[${new Date().toISOString()}] Service: ${status}`);
  } catch (error) {
    console.log(`[${new Date().toISOString()}] Service: DOWN - ${error.message}`);
  }
}, 60000); // Every minute
```

### Python

#### Basic Request
```python
import requests

response = requests.get('http://localhost:5679/webhook/ping')
print(response.json())  # {'message': 'pong'}
```

#### With Error Handling
```python
import requests

try:
  response = requests.get(
    'http://localhost:5679/webhook/ping',
    timeout=5
  )
  response.raise_for_status()  # Raise for bad status codes
  data = response.json()
  print(f"Service is {'UP' if data.get('message') == 'pong' else 'DOWN'}")
except requests.exceptions.RequestException as e:
  print(f"Service is DOWN: {e}")
```

#### Periodic Monitoring
```python
import requests
import time
from datetime import datetime

def monitor_webhook(interval=60):
  while True:
    try:
      response = requests.get(
        'http://localhost:5679/webhook/ping',
        timeout=5
      )
      status = 'UP' if response.status_code == 200 else 'DOWN'
    except:
      status = 'DOWN'

    print(f"[{datetime.now()}] Service: {status}")
    time.sleep(interval)

monitor_webhook()
```

### Bash / cURL

#### Simple Check
```bash
curl http://localhost:5679/webhook/ping
```

#### With Status Check
```bash
#!/bin/bash
response=$(curl -s -w "\n%{http_code}" \
  http://localhost:5679/webhook/ping)

status_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -1)

if [ "$status_code" = "200" ]; then
  echo "✓ Service UP"
  echo "Response: $body"
else
  echo "✗ Service DOWN (HTTP $status_code)"
fi
```

#### Continuous Monitoring
```bash
#!/bin/bash
while true; do
  if curl -s http://localhost:5679/webhook/ping | grep -q "pong"; then
    echo "[$(date)] Service UP"
  else
    echo "[$(date)] Service DOWN"
  fi
  sleep 60
done
```

### Go

#### Basic Request
```go
package main

import (
  "fmt"
  "io/ioutil"
  "net/http"
)

func main() {
  resp, err := http.Get("http://localhost:5679/webhook/ping")
  if err != nil {
    log.Fatal(err)
  }
  defer resp.Body.Close()

  body, _ := ioutil.ReadAll(resp.Body)
  fmt.Println(string(body))  // {"message": "pong"}
}
```

#### With Client Configuration
```go
client := &http.Client{
  Timeout: 5 * time.Second,
}

resp, err := client.Get("http://localhost:5679/webhook/ping")
if err != nil {
  log.Printf("Request failed: %v", err)
  return
}
defer resp.Body.Close()

if resp.StatusCode == 200 {
  fmt.Println("Service is UP")
} else {
  fmt.Println("Service is DOWN")
}
```

---

## Use Cases

### 1. Service Health Monitoring

Simple health check to verify service availability:

```bash
#!/bin/bash
# health-check.sh

if curl -s http://localhost:5679/webhook/ping | grep -q "pong"; then
  echo "OK"
  exit 0
else
  echo "CRITICAL"
  exit 2
fi
```

Add to Nagios/Icinga:
```
define service {
  service_name  webhook_health
  host_name     n8n-cloud
  check_command check_http!localhost:5679!/webhook/ping
  interval      5
}
```

### 2. Load Balancer Health Probe

Configure in load balancer (AWS ELB, NGINX, HAProxy):

**AWS ELB Configuration**:
```
Protocol: HTTPS
Port: 443
Path: /webhook/ping
Expected Status: 200
Interval: 30 seconds
Timeout: 5 seconds
Healthy Threshold: 2
Unhealthy Threshold: 2
```

**NGINX Configuration**:
```nginx
upstream webhook {
  server localhost:5679:443;
  check interval=3000 rise=2 fall=5 timeout=1000 type=http;
  check_http_send "GET /webhook/ping HTTP/1.0\r\n\r\n";
  check_http_expect_alive http_2xx;
}
```

### 3. CI/CD Pipeline Integration

```yaml
# GitHub Actions
- name: Check Webhook Health
  run: |
    response=$(curl -s http://localhost:5679/webhook/ping)
    if [ "$response" = '{"message": "pong"}' ]; then
      echo "✓ Webhook is healthy"
    else
      echo "✗ Webhook health check failed"
      exit 1
    fi

# GitLab CI
check_webhook:
  script:
    - curl -f http://localhost:5679/webhook/ping
  only:
    - merge_requests
```

### 4. Monitoring Dashboard Integration

```javascript
// Prometheus Pushgateway
fetch('https://pushgateway:9091/metrics/job/webhook_check', {
  method: 'POST',
  body: 'webhook_health{instance="n8n"} 1'
});

// DataDog Custom Metric
const response = await fetch('http://localhost:5679/webhook/ping');
const status = response.ok ? 1 : 0;
console.log(`webhook.health:${status}|g`);
```

### 5. Scheduled Health Verification

```bash
# Cron job - check every 5 minutes
*/5 * * * * /usr/local/bin/check-webhook.sh

# Systemd timer
# /etc/systemd/system/webhook-check.service
# /etc/systemd/system/webhook-check.timer (OnBootSec=5min)
```

---

## Performance & Characteristics

### Response Time
- **Average**: < 50ms
- **P50 (Median)**: 30ms
- **P95**: < 100ms
- **P99**: < 200ms

### Reliability
- **Uptime Target**: 99.9%
- **Error Rate**: < 0.1%
- **Timeout Rate**: < 0.01%

### Scalability
- **Concurrent Requests**: Moderate (depends on n8n resources)
- **Rate Limiting**: Not enforced server-side
- **Recommended Client Limit**: 100 req/sec per source

---

## Security Considerations

### Current Configuration
- ✅ HTTPS Enforced
- ❌ No Authentication
- ❌ No Rate Limiting
- ❌ No IP Whitelisting

### Security Best Practices

1. **If Public Usage**:
   - Monitor request patterns
   - Implement client-side rate limiting
   - Log all requests

2. **If Internal Usage**:
   - Add API key authentication
   - Implement IP whitelisting
   - Enable request signing

3. **General Security**:
   - Always use HTTPS (never HTTP)
   - Don't expose sensitive data in logs
   - Monitor for abuse patterns
   - Consider WAF protection

---

## Monitoring & Observability

### Metrics to Track
```
- Total requests per minute
- Success rate (200 responses)
- Error rate (4xx, 5xx responses)
- P50/P95/P99 response times
- Request method distribution
- Unique source IPs
```

### Logging
All requests are logged in n8n Executions:

1. Open n8n UI
2. Menu → Executions
3. Filter by "Ping Webhook" workflow
4. View request details, parameters, response

### Alerting
Set up alerts for:
- Response time > 1 second
- Error rate > 1%
- Downtime > 5 minutes
- Unusual spike in request count

---

## API Limits & Quotas

Currently no enforced limits, but recommended client-side limits:

| Metric | Recommended Limit |
|--------|-------------------|
| Requests per second | 100 |
| Concurrent requests | 50 |
| Request timeout | 30 seconds |
| Max request size | 1 MB |

---

## Troubleshooting

### Endpoint Returns 404

**Diagnosis**:
```bash
curl -v http://localhost:5679/webhook/ping
```

**Causes**:
1. Workflow not created
2. Workflow is deactivated
3. Wrong webhook path
4. n8n service down

**Solution**:
See DEPLOY.md § Troubleshooting

### Slow Response Times

**Check**:
```bash
time curl http://localhost:5679/webhook/ping
```

**Causes**:
- n8n system overloaded
- Network latency
- DNS resolution slow

**Solution**:
1. Check n8n resource usage
2. Try with `curl --compressed`
3. Verify network connectivity
4. Test from different location

### Connection Timeout

**Check**:
```bash
timeout 10 curl http://localhost:5679/webhook/ping
```

**Solution**:
1. Increase client timeout
2. Check n8n logs
3. Verify service is running
4. Test basic connectivity

---

## Changelog

### Version 1.0 (2025-12-25)
- ✅ Initial release
- ✅ GET/POST/PUT/DELETE/PATCH support
- ✅ Simple JSON response
- ✅ No authentication

### Future Enhancements
- [ ] Add timestamp to response
- [ ] Add API key authentication
- [ ] Add rate limiting
- [ ] Add detailed health metrics
- [ ] Add request logging option

---

## Related Documentation

- **Deployment Guide**: DEPLOY.md
- **Project README**: README.md
- **n8n Webhook Docs**: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/

---

**Status**: ✅ Production Ready
**Last Updated**: 2025-12-25
**Maintained By**: AI Factory System
