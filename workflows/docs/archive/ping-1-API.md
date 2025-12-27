# ping-1 Webhook API 文档

## API 概述

ping-1 是一个简单的 HTTP webhook 服务，用于测试和验证 webhook 连接。该 API 接收 ping 请求并返回 pong 响应。

## 基本信息

| 字段 | 值 |
|------|-----|
| **Base URL** | https://146.190.52.84/webhook/ping-1 |
| **本地 URL** | http://localhost:5678/webhook/ping-1 |
| **协议** | HTTP/HTTPS |
| **版本** | 1.0 |
| **Workflow ID** | xc3nT8Jtjp9ncpMj |

## 端点

### Ping Endpoint

**URL**: `/webhook/ping-1`
**方法**: GET, POST
**认证**: 无（可选配置）
**内容类型**: application/json

## 请求

### GET 请求

**描述**: 发送 GET 请求到 webhook

```bash
curl -X GET https://146.190.52.84/webhook/ping-1
```

**查询参数**: 无（可选传递）

```bash
curl -X GET "https://146.190.52.84/webhook/ping-1?message=hello&user=test"
```

### POST 请求

**描述**: 发送 JSON 数据到 webhook

```bash
curl -X POST https://146.190.52.84/webhook/ping-1 \
  -H "Content-Type: application/json" \
  -d '{"message": "ping", "timestamp": "2025-12-26T00:00:00Z"}'
```

#### 请求体格式

```json
{
  "message": "string",              // 必需：消息内容
  "timestamp": "ISO 8601 datetime", // 可选：请求时间戳
  "user": "string",                 // 可选：用户标识
  "metadata": "object"              // 可选：其他元数据
}
```

#### 请求体示例 1: 基本 Ping

```json
{
  "message": "ping"
}
```

#### 请求体示例 2: 带时间戳的 Ping

```json
{
  "message": "ping",
  "timestamp": "2025-12-26T10:30:45Z"
}
```

#### 请求体示例 3: 完整请求

```json
{
  "message": "ping",
  "timestamp": "2025-12-26T10:30:45Z",
  "user": "test-user",
  "metadata": {
    "source": "integration-test",
    "version": "1.0",
    "retry_count": 0
  }
}
```

## 响应

### 成功响应

**状态码**: 200 OK

```json
{
  "status": "pong",
  "timestamp": "2025-12-26T10:30:45.123Z",
  "success": true,
  "message": "Webhook received and processed successfully",
  "workflow_id": "xc3nT8Jtjp9ncpMj",
  "execution_id": "12345"
}
```

#### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| status | string | 响应状态，值为 "pong" |
| timestamp | ISO 8601 | 服务器处理时间 |
| success | boolean | 处理是否成功 |
| message | string | 状态消息 |
| workflow_id | string | n8n 工作流 ID |
| execution_id | string | 本次执行的 ID |

### 错误响应

**状态码**: 400/500 Bad Request or Server Error

```json
{
  "status": "error",
  "success": false,
  "message": "Error description",
  "error_code": "WEBHOOK_ERROR"
}
```

## 使用示例

### 使用 cURL

#### 简单 GET 请求

```bash
curl -X GET https://146.190.52.84/webhook/ping-1
```

#### 带数据的 POST 请求

```bash
curl -X POST https://146.190.52.84/webhook/ping-1 \
  -H "Content-Type: application/json" \
  -d '{
    "message": "hello",
    "user": "developer"
  }'
```

#### 详细请求（含响应头）

```bash
curl -v -X POST https://146.190.52.84/webhook/ping-1 \
  -H "Content-Type: application/json" \
  -H "User-Agent: MyApp/1.0" \
  -d '{"message": "ping"}'
```

### 使用 JavaScript

#### 异步 Fetch

```javascript
async function ping() {
  const response = await fetch('https://146.190.52.84/webhook/ping-1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'ping',
      timestamp: new Date().toISOString()
    })
  });

  const data = await response.json();
  console.log(data);
  // {
  //   status: 'pong',
  //   timestamp: '2025-12-26T...',
  //   success: true
  // }
}

ping();
```

#### 使用 Axios

```javascript
const axios = require('axios');

axios.post('https://146.190.52.84/webhook/ping-1', {
  message: 'ping',
  user: 'test'
})
.then(response => {
  console.log('Pong received:', response.data);
})
.catch(error => {
  console.error('Error:', error.message);
});
```

### 使用 Python

#### 使用 Requests

```python
import requests
import json
from datetime import datetime

url = 'https://146.190.52.84/webhook/ping-1'
payload = {
    'message': 'ping',
    'timestamp': datetime.now().isoformat(),
    'user': 'python-client'
}

response = requests.post(
    url,
    json=payload,
    headers={'Content-Type': 'application/json'}
)

print(f'Status Code: {response.status_code}')
print(f'Response: {response.json()}')
```

### 使用 Node.js

#### 使用 node-fetch

```javascript
const fetch = require('node-fetch');

const payload = {
  message: 'ping',
  timestamp: new Date().toISOString()
};

fetch('https://146.190.52.84/webhook/ping-1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));
```

## 性能指标

### 响应时间

| 场景 | 平均响应时间 |
|------|------------|
| 本地请求 | < 100ms |
| 公网请求 | 100-500ms |
| 高负载情况 | 500-2000ms |

### 吞吐量

| 指标 | 值 |
|------|-----|
| 并发请求数 | 100+ |
| 每秒请求数 (RPS) | 100+ |
| 最大 Payload 大小 | 10MB |

## 速率限制

当前配置：

| 限制 | 值 |
|------|-----|
| 请求频率 | 无限制 |
| 并发连接 | 100+ |
| 单个 Payload | 10MB |

## 错误处理

### 常见错误

#### 1. 404 Not Found

```json
{
  "status": "error",
  "message": "Webhook not found",
  "code": 404
}
```

**原因**: 工作流未激活或路径不正确

**解决方案**:
- 检查工作流是否已激活
- 验证 Webhook URL 路径
- 查看 n8n 执行日志

#### 2. 500 Internal Server Error

```json
{
  "status": "error",
  "message": "Internal server error",
  "code": 500
}
```

**原因**: n8n 服务错误

**解决方案**:
- 检查 n8n 服务状态
- 查看 n8n 日志文件
- 检查网络连接

#### 3. 422 Unprocessable Entity

```json
{
  "status": "error",
  "message": "Invalid request payload",
  "code": 422
}
```

**原因**: 请求体格式不正确

**解决方案**:
- 验证 JSON 格式
- 检查字段类型
- 参考请求体示例

## 集成指南

### 与其他系统集成

#### 与 Zapier 集成

1. 创建 Zap
2. 选择触发器（如 Schedule）
3. 添加 Action：Webhooks by Zapier → POST
4. 填入 Webhook URL: `https://146.190.52.84/webhook/ping-1`
5. 配置请求体
6. 测试并激活

#### 与 IFTTT 集成

1. 创建 Applet
2. 选择 Webhooks 服务
3. 配置 Webhook 请求
4. URL: `https://146.190.52.84/webhook/ping-1`
5. 激活 Applet

#### 与定时任务集成

```bash
# Cron 定时执行
*/5 * * * * curl -X POST https://146.190.52.84/webhook/ping-1 \
  -H "Content-Type: application/json" \
  -d '{"message":"ping","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'
```

## 监控和告警

### 健康检查

```bash
# 简单健康检查脚本
check_webhook() {
  response=$(curl -s -w "\n%{http_code}" https://146.190.52.84/webhook/ping-1)
  http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" == "200" ]; then
    echo "✅ Webhook is healthy"
  else
    echo "❌ Webhook returned HTTP $http_code"
  fi
}

check_webhook
```

### 监控指标

- 响应时间
- 成功率
- 错误率
- 吞吐量

## 安全建议

### 1. HTTPS 使用

始终使用 HTTPS 访问 webhook:
- ✅ `https://146.190.52.84/webhook/ping-1`
- ❌ `http://146.190.52.84/webhook/ping-1`

### 2. 请求验证

考虑添加认证：
- API Key 认证
- OAuth 2.0
- JWT Token

### 3. 日志记录

记录所有 webhook 请求：
- 请求时间
- 请求来源 IP
- 请求体（脱敏）
- 响应状态

### 4. 速率限制

实现速率限制防止滥用：
- 限制单 IP 的请求频率
- 限制单个 payload 大小
- 实现黑名单/白名单

## 文件和资源

### 相关文件

| 文件 | 说明 |
|------|------|
| `ping-1-README.md` | 项目说明 |
| `ping-1-DEPLOY.md` | 部署指南 |
| `ping-1-API.md` | API 文档（本文件） |
| `ping-1.json` | 工作流定义 |

### 外部资源

- [n8n 官方文档](https://docs.n8n.io/)
- [Webhook 最佳实践](https://docs.n8n.io/workflows/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [HTTP 状态码参考](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)

## 常见问题 (FAQ)

### Q: 可以同时发送 GET 和 POST 请求吗？

A: 是的，webhook 支持两种方法。GET 请求可以使用查询参数，POST 请求使用 JSON 请求体。

### Q: Webhook URL 会改变吗？

A: 工作流 ID 和路径固定，但如果重新生成工作流可能会改变。建议保存当前 URL。

### Q: 支持 Basic Auth 吗？

A: 当前配置不需要认证，但可以通过编辑工作流添加。

### Q: 请求超时多少时间？

A: 默认超时 30-60 秒（取决于 n8n 和 Nginx 配置）。

### Q: 可以更改响应格式吗？

A: 可以，在 n8n UI 中编辑 "Respond to Webhook" 节点的响应体。

### Q: 如何查看请求日志？

A: 打开 n8n 工作流，点击 "Executions" 标签查看所有执行记录。

## 更新日志

### v1.0 (2025-12-26)

- ✅ 初始发布
- ✅ 支持 GET/POST 方法
- ✅ 返回基本 pong 响应
- ✅ 完整的 API 文档

## 联系和支持

- **Bug 报告**: 检查 n8n 执行日志
- **功能请求**: 编辑工作流添加新节点
- **问题排查**: 参考部署指南中的故障排查部分

---

**最后更新**: 2025-12-26
**工作流 ID**: xc3nT8Jtjp9ncpMj
**服务器**: 146.190.52.84
