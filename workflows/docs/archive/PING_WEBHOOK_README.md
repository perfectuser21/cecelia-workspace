# Ping Webhook 工作流

## 概述

Ping Webhook 是一个轻量级的 n8n 工作流，用于健康检查和连接测试。它接收 HTTP 请求（GET 或 POST），返回 `{"message": "pong"}` 响应。

## 功能

- **健康检查**: 快速验证 n8n 和 webhook 系统是否正常运行
- **支持多种方法**: 接收 GET 和 POST 请求
- **简单响应**: 返回 JSON 格式的 pong 消息

## 工作流结构

```
Webhook Trigger (GET/POST /webhook/ping)
         ↓
Respond to Webhook (返回 {"message": "pong"})
```

## 使用场景

- CI/CD 管道中的依赖性检查
- 负载均衡器的健康检查探针
- 客户端连接测试
- 服务可用性监控

## 配置详情

| 参数 | 值 |
|------|-----|
| Webhook 路径 | `/webhook/ping` |
| HTTP 方法 | GET, POST |
| 响应格式 | JSON |
| 状态码 | 200 |
| 激活状态 | ✅ 已激活 |

## 快速开始

### 测试 Ping Webhook

使用 curl 命令：

```bash
# GET 请求
curl http://localhost:5679/webhook/ping

# POST 请求
curl -X POST http://localhost:5679/webhook/ping
```

预期响应：
```json
{
  "message": "pong"
}
```

## 集成示例

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

### Bash

```bash
curl -s http://localhost:5679/webhook/ping | jq .
```

## 故障排除

| 问题 | 解决方案 |
|------|---------|
| 返回 404 | 确保 workflow 已激活，检查 webhook 路径是否正确 |
| 返回 403 | 检查 n8n API 密钥配置 |
| 超时 | n8n 服务可能不可用，检查服务状态 |

## 相关文档

- [部署指南](./DEPLOY.md)
- [API 文档](./API.md)
- [n8n 官方文档](https://docs.n8n.io)
