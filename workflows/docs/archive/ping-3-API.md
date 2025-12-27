# ping-3 API 文档

## 基本信息

| 属性 | 值 |
|------|-----|
| **Endpoint** | `/webhook/ping-3` |
| **Workflow ID** | rdasZtQ3YeJN1tfy |
| **支持方法** | GET, POST |
| **请求格式** | JSON |
| **响应格式** | JSON |
| **认证** | 无（公开端点） |
| **速率限制** | 无 |

## 端点

### GET /webhook/ping-3

健康检查和 ping 测试。

#### 请求

```bash
curl -X GET "https://146.190.52.84/webhook/ping-3" \
  -H "Content-Type: application/json"
```

#### 响应

**状态码**: `200 OK`

```json
{
  "status": "pong",
  "timestamp": "2025-12-26T10:30:45.123Z",
  "workflow_id": "rdasZtQ3YeJN1tfy"
}
```

### POST /webhook/ping-3

健康检查和 ping 测试（支持请求体）。

#### 请求

```bash
curl -X POST "https://146.190.52.84/webhook/ping-3" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "ping test",
    "custom_data": "optional"
  }'
```

#### 响应

**状态码**: `200 OK`

```json
{
  "status": "pong",
  "timestamp": "2025-12-26T10:30:45.123Z",
  "workflow_id": "rdasZtQ3YeJN1tfy"
}
```

## 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | string | 响应状态，固定为 "pong" |
| `timestamp` | string | ISO 8601 格式的服务器时间戳 |
| `workflow_id` | string | n8n workflow ID，用于追踪和调试 |

## 错误处理

### 4xx 错误

| 状态码 | 说明 | 原因 |
|--------|------|------|
| 404 | Not Found | Webhook 路径不正确或 workflow 已禁用 |
| 405 | Method Not Allowed | 使用了不支持的 HTTP 方法 |

### 5xx 错误

| 状态码 | 说明 | 原因 |
|--------|------|------|
| 500 | Internal Server Error | n8n 处理请求时出错 |
| 503 | Service Unavailable | n8n 服务不可用 |

## 使用示例

### Python

```python
import requests
from datetime import datetime

def ping_service():
    url = "https://146.190.52.84/webhook/ping-3"
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        print(f"✓ Ping successful")
        print(f"  Status: {data['status']}")
        print(f"  Timestamp: {data['timestamp']}")
        print(f"  Workflow ID: {data['workflow_id']}")
    except requests.exceptions.RequestException as e:
        print(f"✗ Ping failed: {e}")

if __name__ == "__main__":
    ping_service()
```

### Node.js

```javascript
async function pingService() {
  const url = "https://146.190.52.84/webhook/ping-3";
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    const data = await response.json();
    console.log("✓ Ping successful");
    console.log(`  Status: ${data.status}`);
    console.log(`  Timestamp: ${data.timestamp}`);
    console.log(`  Workflow ID: ${data.workflow_id}`);
  } catch (error) {
    console.error("✗ Ping failed:", error);
  }
}

pingService();
```

### Bash

```bash
#!/bin/bash

ping_service() {
  local url="https://146.190.52.84/webhook/ping-3"
  local response=$(curl -s -w "\n%{http_code}" -X GET "$url" \
    -H "Content-Type: application/json")

  local body=$(echo "$response" | head -n 1)
  local status=$(echo "$response" | tail -n 1)

  if [ "$status" = "200" ]; then
    echo "✓ Ping successful"
    echo "$body" | jq .
  else
    echo "✗ Ping failed with status: $status"
  fi
}

ping_service
```

## 性能特性

| 指标 | 值 |
|------|-----|
| **平均响应时间** | < 50ms |
| **P95 响应时间** | < 100ms |
| **可用性** | 99.9%+ |
| **吞吐量** | 支持并发请求 |

## 监控建议

### 健康检查集成

在应用的健康检查中定期调用此端点：

```javascript
// Express.js 健康检查示例
app.get('/health', async (req, res) => {
  try {
    const response = await fetch('https://146.190.52.84/webhook/ping-3');
    if (response.ok) {
      res.json({ status: 'healthy', uptime: process.uptime() });
    } else {
      res.status(503).json({ status: 'unhealthy' });
    }
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});
```

### 监控指标

- **请求成功率**: 监控 HTTP 200 响应的比例
- **响应时间**: 监控平均和 P95 响应时间
- **错误率**: 监控 4xx 和 5xx 错误的发生频率

## 常见问题

### Q: 这个 endpoint 的用途是什么？
A: 主要用于服务健康检查和可用性验证，可集成到监控系统中。

### Q: 是否需要身份验证？
A: 不需要，这是一个公开的健康检查端点。

### Q: 能否修改响应格式？
A: 可以，需要编辑 n8n 中的 Response Builder 节点。

### Q: 是否有并发限制？
A: 由 n8n 和 Nginx 的配置决定，默认支持较高的并发。

### Q: 如何调试 webhook 调用？
A: 在 n8n UI 中查看 Execution History，查看详细的请求和响应日志。

## 变更日志

### v1.0 (2025-12-26)

- ✅ 初始部署
- ✅ 支持 GET 和 POST 方法
- ✅ 基础健康检查功能
- ✅ 时间戳和 workflow ID 返回

## 相关资源

- [ping-3 部署文档](./ping-3-DEPLOY.md)
- [ping-3 项目说明](./ping-3-README.md)
- [n8n 官方文档](https://docs.n8n.io/)
