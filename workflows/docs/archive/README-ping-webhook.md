# Ping Webhook

简单的健康检查 webhook，用于验证 n8n 服务可用性。

## 功能

- 接收 HTTP GET/POST 请求到 `/webhook/ping`
- 返回 JSON 格式的 pong 响应及当前时间戳
- 用于监控和负载均衡器健康检查

## 基本信息

| 属性 | 值 |
|------|-----|
| **Workflow ID** | vaOcL9wAjducmP5a |
| **Webhook 路径** | `/webhook/ping` |
| **支持方法** | GET, POST |
| **响应格式** | JSON |
| **创建时间** | 2025-12-25 |
| **状态** | 已激活 ✅ |

## 架构

该 workflow 包含 3 个节点：

1. **Webhook** - 监听 HTTP 请求
   - 路径：`/webhook/ping`
   - 支持 GET/POST 方法
   - 自动化启用

2. **JavaScript** (可选) - 处理请求数据
   - 格式化时间戳
   - 添加额外的元数据

3. **Respond to Webhook** - 返回 HTTP 响应
   - 状态码：200
   - 响应体：`{"status": "pong", "timestamp": "2025-12-25T..."}`

## 使用场景

### 1. 健康检查

```bash
curl http://localhost:5679/webhook/ping
```

### 2. 监控集成

在监控系统中配置：
- 端点：`http://localhost:5679/webhook/ping`
- 间隔：30 秒或 1 分钟
- 期望状态码：200
- 期望响应：`"status": "pong"`

### 3. 负载均衡器健康检查

```nginx
upstream n8n {
    server localhost:5679;

    check interval=3000 rise=2 fall=5 timeout=1000 type=http;
    check_http_send "GET /webhook/ping HTTP/1.0\r\n\r\n";
    check_http_expect_alive http_2xx;
}
```

## 响应示例

### 成功响应 (200)

```json
{
  "status": "pong",
  "timestamp": "2025-12-25T12:34:56.789Z"
}
```

### HTTP Headers

```
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-cache
```

## 测试

### cURL

```bash
# GET 请求
curl -v http://localhost:5679/webhook/ping

# POST 请求
curl -X POST -v http://localhost:5679/webhook/ping
```

### JavaScript/Node.js

```javascript
const response = await fetch('http://localhost:5679/webhook/ping');
const data = await response.json();
console.log(data); // { status: "pong", timestamp: "..." }
```

### Python

```python
import requests

response = requests.get('http://localhost:5679/webhook/ping')
print(response.json())  # {'status': 'pong', 'timestamp': '...'}
```

## 故障排除

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 404 Not Found | Webhook 未激活或路径错误 | 检查 workflow 是否已激活，确认路径为 `/webhook/ping` |
| 500 Internal Error | Webhook 节点配置错误 | 在 n8n 中编辑 workflow，检查节点连接和配置 |
| 超时 | n8n 服务不可用 | 检查 n8n 容器状态：`docker ps \| grep n8n` |
| 503 Service Unavailable | Nginx Proxy Manager 问题 | 检查反向代理配置 |

## 维护

- **日志位置**：n8n 容器 logs
- **监控**：Claude Monitor 可监控该 webhook 的响应时间
- **备份**：workflow 定义每日自动备份

## 相关资源

- [n8n Webhook 文档](https://docs.n8n.io/integrations/webhooks/)
- [Health Check 最佳实践](https://tools.ietf.org/html/draft-inadarei-api-health-check)
- [Claude Monitor](https://monitor.zenjoymedia.media:3000)
