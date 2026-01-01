# Ping Webhook API 文档

## 基本信息

- **基础 URL**: `http://localhost:5679`
- **Webhook 路径**: `/webhook/ping`
- **支持方法**: GET, POST
- **认证**: 无需认证
- **响应格式**: JSON

## 端点

### GET /webhook/ping

获取 pong 响应，用于健康检查。

**请求**:
```bash
curl http://localhost:5679/webhook/ping
```

**响应**:
```json
{
  "message": "pong"
}
```

**状态码**: `200 OK`

**响应头**:
```
Content-Type: application/json
Content-Length: 19
```

### POST /webhook/ping

发送 POST 请求并获得 pong 响应。

**请求**:
```bash
curl -X POST http://localhost:5679/webhook/ping
```

**请求体**: 无（可选）

**响应**:
```json
{
  "message": "pong"
}
```

**状态码**: `200 OK`

## 请求示例

### 示例 1: 基本 GET 请求

```bash
curl -X GET \
  http://localhost:5679/webhook/ping \
  -H "Accept: application/json"
```

**响应**:
```json
{
  "message": "pong"
}
```

### 示例 2: POST 请求带自定义数据

```bash
curl -X POST \
  http://localhost:5679/webhook/ping \
  -H "Content-Type: application/json" \
  -d '{"client": "test-client"}'
```

**响应**:
```json
{
  "message": "pong"
}
```

> **注意**: 当前版本忽略请求体，总是返回相同的 pong 响应

### 示例 3: 使用 JavaScript Fetch API

```javascript
// GET 请求
fetch('http://localhost:5679/webhook/ping')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));

// POST 请求
fetch('http://localhost:5679/webhook/ping', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ timestamp: Date.now() })
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
```

### 示例 4: Python 请求

```python
import requests
import json

# GET 请求
response = requests.get('http://localhost:5679/webhook/ping')
print(response.json())  # {'message': 'pong'}

# POST 请求
response = requests.post('http://localhost:5679/webhook/ping')
print(response.status_code)  # 200
print(response.json())  # {'message': 'pong'}
```

### 示例 5: PowerShell

```powershell
# GET 请求
$response = Invoke-RestMethod -Uri "http://localhost:5679/webhook/ping"
$response | ConvertTo-Json

# POST 请求
$response = Invoke-RestMethod -Uri "http://localhost:5679/webhook/ping" -Method POST
$response | ConvertTo-Json
```

## 响应模式

### 成功响应 (200 OK)

```json
{
  "message": "pong"
}
```

**字段描述**:
| 字段 | 类型 | 说明 |
|------|------|------|
| message | string | 固定值 "pong" |

### 错误响应

#### 404 Not Found

**原因**: Workflow 未激活或路径错误

```json
{
  "message": "Workflow not found or inactive"
}
```

#### 500 Internal Server Error

**原因**: n8n 服务内部错误

```json
{
  "message": "Internal server error"
}
```

## 使用场景

### 1. 健康检查

```bash
#!/bin/bash

WEBHOOK_URL="http://localhost:5679/webhook/ping"
MAX_RETRIES=3
RETRY_DELAY=5

for i in $(seq 1 $MAX_RETRIES); do
    if curl -f -s "$WEBHOOK_URL" > /dev/null 2>&1; then
        echo "✅ Webhook is healthy"
        exit 0
    fi

    if [ $i -lt $MAX_RETRIES ]; then
        echo "⏳ Attempt $i failed, retrying in ${RETRY_DELAY}s..."
        sleep $RETRY_DELAY
    fi
done

echo "❌ Webhook health check failed"
exit 1
```

### 2. 依赖性检查（CI/CD）

```yaml
# .github/workflows/health-check.yml
name: Health Check

on: [push, pull_request]

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - name: Check webhook availability
        run: |
          curl -f http://localhost:5679/webhook/ping
```

### 3. 监控脚本

```python
import requests
import time
from datetime import datetime

def monitor_webhook(interval=60):
    """持续监控 webhook 可用性"""
    url = "http://localhost:5679/webhook/ping"

    while True:
        try:
            start = time.time()
            response = requests.get(url, timeout=5)
            elapsed = time.time() - start

            if response.status_code == 200:
                print(f"[{datetime.now()}] ✅ OK (${elapsed*1000:.0f}ms)")
            else:
                print(f"[{datetime.now()}] ⚠️ Status {response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"[{datetime.now()}] ❌ Error: {e}")

        time.sleep(interval)

if __name__ == "__main__":
    monitor_webhook()
```

### 4. 负载均衡器健康检查

```nginx
# nginx 配置示例
upstream n8n {
    server localhost:5679;
}

server {
    listen 80;

    location / {
        proxy_pass https://n8n;
    }
}

# 在负载均衡器中配置健康检查
# Path: /webhook/ping
# Expected: {"message":"pong"}
# Interval: 30s
# Timeout: 5s
```

## 速率限制

当前无速率限制。为防止滥用，建议：
- 健康检查间隔不低于 30 秒
- 不在循环中频繁调用

## 认证

此端点**不需要认证**，任何人都可调用。如需添加认证保护，请：

1. 在 Webhook 节点启用认证
2. 选择认证方法（API Key、Basic Auth 等）
3. 更新所有客户端的请求头

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2025-12-24 | 初始发布 |

## 常见问题

### Q: 可以传递查询参数吗？

A: 当前版本不处理查询参数，总是返回相同的响应。如需处理参数，请修改 workflow。

### Q: 支持 JSONP 吗？

A: 不支持，如需跨域请求，请使用 CORS。

### Q: 响应时间有保证吗？

A: 正常情况下 < 1 秒，但取决于 n8n 服务负载。

### Q: 可以用来测试网络连接吗？

A: 可以，这是常见用法。结合重试逻辑可用于故障检测。

## 相关资源

- [Webhook 部署指南](./PING_WEBHOOK_DEPLOY.md)
- [项目说明](./PING_WEBHOOK_README.md)
- [n8n 官方文档](https://docs.n8n.io/webhooks/)
- [REST API 参考](https://docs.n8n.io/api/getting-started/overview/)

## 支持

如遇问题，请：
1. 查看 [故障排查指南](./PING_WEBHOOK_DEPLOY.md#故障排查)
2. 检查 n8n 日志: `docker logs social-metrics-n8n`
3. 联系系统管理员
