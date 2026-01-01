# Ping Webhook 部署指南

## 部署信息

| 项目 | 详情 |
|------|------|
| Workflow 名称 | Ping Webhook |
| 执行 ID | 20251224234639-5ciy6h |
| 创建时间 | 2025-12-24 |
| 部署状态 | ✅ 成功 |
| 总任务数 | 1 |
| 成功任务 | 1 |
| 失败任务 | 0 |

## 部署步骤

### 1. Webhook 配置

**Workflow**: Ping Webhook

**触发器配置**:
```json
{
  "node": "Webhook",
  "type": "Webhook",
  "settings": {
    "path": "ping",
    "method": ["GET", "POST"],
    "authentication": "none",
    "responseMode": "responseNode"
  }
}
```

### 2. 响应节点配置

**节点**: Respond to Webhook

**设置**:
```json
{
  "node": "Respond to Webhook",
  "type": "Webhook Response",
  "settings": {
    "statusCode": 200,
    "body": {
      "message": "pong"
    }
  }
}
```

### 3. 工作流激活

- ✅ Workflow 已激活
- Webhook 可立即接收请求

## 验证部署

### 方式 1: 命令行测试

```bash
# 测试 GET 请求
curl -v http://localhost:5679/webhook/ping

# 测试 POST 请求
curl -v -X POST http://localhost:5679/webhook/ping
```

预期输出:
```
< HTTP/2 200
< content-type: application/json

{"message":"pong"}
```

### 方式 2: n8n UI 验证

1. 登录 n8n: http://localhost:5679
2. 打开 Workflow 列表
3. 搜索 "Ping Webhook"
4. 确认 workflow 状态为 **Active**（绿色）
5. 点击 Webhook 节点，查看 URL 显示

### 方式 3: 集成测试

```bash
#!/bin/bash

# 测试脚本
WEBHOOK_URL="http://localhost:5679/webhook/ping"

# 测试 GET
echo "Testing GET request..."
GET_RESPONSE=$(curl -s "$WEBHOOK_URL")
if echo "$GET_RESPONSE" | jq -e '.message == "pong"' > /dev/null; then
    echo "✅ GET request passed"
else
    echo "❌ GET request failed"
    exit 1
fi

# 测试 POST
echo "Testing POST request..."
POST_RESPONSE=$(curl -s -X POST "$WEBHOOK_URL")
if echo "$POST_RESPONSE" | jq -e '.message == "pong"' > /dev/null; then
    echo "✅ POST request passed"
else
    echo "❌ POST request failed"
    exit 1
fi

echo "✅ All tests passed"
```

## 监控和维护

### 实时日志查看

在 n8n UI 中：
1. 打开 Ping Webhook workflow
2. 点击 "Executions" 标签
3. 查看最近的请求日志

### 警告信息

- 如果收到 404 错误，确保 workflow 已激活
- 如果响应时间超过 5 秒，检查 n8n 服务性能
- 如果频繁失败，检查 webhook 日志

## 回滚步骤

如需回滚该 workflow：

1. **禁用 Workflow**
   ```bash
   curl -X PATCH http://localhost:5679/api/v1/workflows/{id} \
     -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"active": false}'
   ```

2. **删除 Workflow**
   ```bash
   curl -X DELETE http://localhost:5679/api/v1/workflows/{id} \
     -H "X-N8N-API-KEY: $N8N_REST_API_KEY"
   ```

## 性能指标

| 指标 | 目标 | 说明 |
|------|------|------|
| 响应时间 | < 1s | P99 延迟 |
| 可用性 | 99.9% | 月度 SLA |
| 错误率 | < 0.1% | 失败请求占比 |

## 故障排查

### Issue: Webhook 返回 404

**症状**: 请求返回 404 Not Found

**解决方案**:
1. 确认 workflow 已激活（UI 中显示绿色状态）
2. 检查 webhook 路径是否为 `/webhook/ping`
3. 尝试重新保存 workflow

### Issue: 响应时间过长

**症状**: 响应时间 > 5s

**解决方案**:
1. 检查 n8n 服务状态
2. 查看 n8n 日志: `docker logs social-metrics-n8n`
3. 考虑重启 n8n 服务

### Issue: CORS 错误

**症状**: 浏览器报 CORS 错误

**解决方案**:
- 当前 workflow 为简单 HTTP 响应，CORS 在 n8n 层面配置
- 如需跨域请求，在 n8n 设置中启用 CORS

## 下一步

- [ ] 集成到监控系统
- [ ] 添加请求日志记录
- [ ] 创建负载测试脚本
- [ ] 配置告警规则

## 联系方式

如遇问题，请检查:
- n8n 日志: `docker logs social-metrics-n8n`
- 系统状态: https://status.n8n.cloud
- 官方文档: https://docs.n8n.io/webhooks/
