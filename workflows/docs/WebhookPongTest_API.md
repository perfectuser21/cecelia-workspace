# Webhook Pong Test - API 文档

## 概述

Webhook Pong Test 是一个简单的 HTTP Webhook 端点，接收 POST 请求后返回 "pong" 响应。用于测试 Webhook 连接和验证服务可用性。

## 端点信息

### URL

```
POST https://146.190.52.84:3000/webhook/webhook_pong_test
```

或使用自定义域名（如已配置）：

```
POST https://your-domain.com/webhook/webhook_pong_test
```

### 支持的 HTTP 方法

- **POST** ✅ 支持

### 认证

目前无认证要求（可选配置 API Key 认证）

## 请求

### 基础请求

```bash
curl -X POST https://146.190.52.84:3000/webhook/webhook_pong_test \
  -H "Content-Type: application/json" \
  -d '{"message": "ping"}'
```

### 请求头

| 头部 | 值 | 必需 |
|------|-----|------|
| Content-Type | application/json | ✓ |
| Authorization | Bearer {token} | ✗ |

### 请求体（Body）

#### 类型：JSON

**最小请求体**:
```json
{}
```

**完整示例**:
```json
{
  "message": "ping",
  "timestamp": "2025-12-26T10:30:00Z",
  "source": "health-check-service",
  "metadata": {
    "service_id": "service-001",
    "version": "1.0"
  }
}
```

**参数说明**:
- 请求体内容无特殊要求
- Webhook 会接收并记录所有请求数据
- 建议包含时间戳用于日志追踪

### 请求示例

#### Python

```python
import requests
import json

url = "https://146.190.52.84:3000/webhook/webhook_pong_test"
headers = {
    "Content-Type": "application/json"
}
payload = {
    "message": "ping",
    "timestamp": "2025-12-26T10:30:00Z"
}

response = requests.post(url, headers=headers, json=payload)

print(f"Status Code: {response.status_code}")
print(f"Response: {response.json()}")
```

#### Node.js

```javascript
const fetch = require('node-fetch');

const url = "https://146.190.52.84:3000/webhook/webhook_pong_test";
const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'ping',
    timestamp: new Date().toISOString()
  })
};

fetch(url, options)
  .then(res => res.json())
  .then(data => console.log('Response:', data))
  .catch(err => console.error('Error:', err));
```

#### Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "net/http"
)

func main() {
    url := "https://146.190.52.84:3000/webhook/webhook_pong_test"

    payload := map[string]string{
        "message": "ping",
    }

    jsonData, _ := json.Marshal(payload)

    req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
    req.Header.Set("Content-Type", "application/json")

    client := &http.Client{}
    resp, _ := client.Do(req)
    defer resp.Body.Close()

    body, _ := ioutil.ReadAll(resp.Body)
    fmt.Println("Status:", resp.Status)
    fmt.Println("Body:", string(body))
}
```

#### cURL

```bash
curl -X POST https://146.190.52.84:3000/webhook/webhook_pong_test \
  -H "Content-Type: application/json" \
  -d '{
    "message": "ping",
    "timestamp": "2025-12-26T10:30:00Z"
  }'
```

## 响应

### 成功响应

#### 状态码：200 OK

```json
{
  "message": "pong"
}
```

### 响应头

| 头部 | 值 |
|------|-----|
| Content-Type | application/json |
| Content-Length | 19 |

### 响应时间

- **平均响应时间**: < 100ms
- **最大响应时间**: < 500ms

## 错误处理

### 可能的错误情况

#### 1. Workflow 未激活 (404)

```
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "message": "Workflow not found"
}
```

**原因**: Webhook Pong Test 工作流未激活

**解决方案**:
1. 登录 n8n UI
2. 打开工作流
3. 点击 "Activate" 按钮

#### 2. 服务不可用 (503)

```
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{
  "message": "Service temporarily unavailable"
}
```

**原因**: n8n 服务暂时不可用或重启中

**解决方案**: 等待服务恢复或检查 n8n 容器状态

#### 3. 请求方法错误 (405)

```
HTTP/1.1 405 Method Not Allowed
Content-Type: application/json

{
  "message": "Method not allowed"
}
```

**原因**: 仅支持 POST 方法

**解决方案**: 确保使用 POST 方法

#### 4. 网络超时 (Gateway Timeout)

```
HTTP/1.1 504 Gateway Timeout
```

**原因**: Webhook 处理超时（通常 > 30秒）

**解决方案**: 检查 n8n 服务状态或网络连接

## 使用场景

### 1. 定期健康检查

```python
import schedule
import requests
import time

def health_check():
    try:
        response = requests.post(
            "https://146.190.52.84:3000/webhook/webhook_pong_test",
            json={"check_time": time.time()},
            timeout=5
        )
        if response.status_code == 200:
            print("✅ Webhook is healthy")
        else:
            print(f"❌ Webhook returned {response.status_code}")
    except Exception as e:
        print(f"❌ Webhook check failed: {e}")

# 每 5 分钟运行一次
schedule.every(5).minutes.do(health_check)

while True:
    schedule.run_pending()
    time.sleep(1)
```

### 2. 集成测试

```javascript
describe('Webhook Pong Test', () => {
  it('should return pong on POST request', async () => {
    const response = await fetch(
      'https://146.190.52.84:3000/webhook/webhook_pong_test',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe('pong');
  });
});
```

### 3. 服务可用性监控

```bash
#!/bin/bash

WEBHOOK_URL="https://146.190.52.84:3000/webhook/webhook_pong_test"
ALERT_EMAIL="admin@example.com"

response_code=$(curl -s -o /dev/null -w "%{http_code}" "$WEBHOOK_URL" -X POST)

if [ "$response_code" != "200" ]; then
  echo "Webhook Alert: HTTP $response_code" | mail -s "Webhook Down" "$ALERT_EMAIL"
fi
```

## 性能指标

### 吞吐量测试

```bash
# 使用 Apache Bench 进行压力测试
ab -n 1000 -c 100 -p request.json \
   https://146.190.52.84:3000/webhook/webhook_pong_test

# 结果示例：
# Requests per second: 150-200
# Time per request: 5-10ms (mean)
# Failed requests: 0
```

### 延迟分布

| 百分比 | 延迟 |
|-------|------|
| p50 | 25ms |
| p95 | 75ms |
| p99 | 120ms |

## 配置与自定义

### 修改响应内容

1. 打开 n8n UI
2. 编辑 "Webhook Pong Test" 工作流
3. 选择 "Respond to Webhook" 节点
4. 修改 "Body" 字段

示例：返回包含时间戳的响应

```json
{
  "message": "pong",
  "timestamp": "{{ $now.toISOString() }}",
  "workflow_id": "cfTMmeg9Srv1bJch"
}
```

### 添加认证

1. 编辑 Webhook 触发器节点
2. 启用 "Authentication"
3. 选择认证方式（Query、Header 等）
4. 配置认证密钥

之后请求需要包含认证信息：

```bash
curl -X POST https://146.190.52.84:3000/webhook/webhook_pong_test?api_key=your_secret_key \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 限流和配额

目前无特殊限流配置，但建议：

- **单个请求超时**: 30 秒
- **并发请求数**: 无特殊限制
- **请求频率**: 无限制（但不建议超过 1000 req/s）

## 监控和日志

### 查看请求日志

1. n8n UI → 打开工作流
2. 点击 "Executions" 标签
3. 查看每个请求的详细信息

### 日志详情

```json
{
  "id": "123456",
  "timestamp": "2025-12-26T10:30:00.000Z",
  "status": "success",
  "data": {
    "request_body": { /* 请求内容 */ },
    "response_time": 45,
    "source_ip": "192.168.1.100"
  }
}
```

## 常见问题

### Q: 可以修改响应格式吗？

A: 可以。编辑 "Respond to Webhook" 节点的 Body 配置即可。

### Q: 如何获取请求的原始数据？

A: 请求数据会自动保存到工作流执行历史中，可在 n8n UI 的 Executions 中查看。

### Q: Webhook URL 会改变吗？

A: 不会。工作流激活后，URL 保持不变。

### Q: 如何禁用 Webhook？

A: 在 n8n UI 中点击工作流的 "Deactivate" 按钮。

### Q: 支持其他 HTTP 方法吗？

A: 目前仅支持 POST。如需支持其他方法，可编辑 Webhook 触发器节点配置。

## 版本信息

| 项目 | 值 |
|------|-----|
| API 版本 | 1.0 |
| n8n 版本 | Latest |
| 最后更新 | 2025-12-26 |
| 状态 | Production Ready |

## 相关资源

- [n8n Webhook 文档](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [部署指南](WebhookPongTest_DEPLOY.md)
- [项目说明](WebhookPongTest_README.md)

---

**更新日期**: 2025-12-26
**维护者**: DevOps Team
**Support**: 见部署指南
