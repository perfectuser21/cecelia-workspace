# Webhook Pong Test - 部署指南

## 部署信息

| 项目 | 值 |
|------|-----|
| Workflow ID | `cfTMmeg9Srv1bJch` |
| 创建方式 | Template-based |
| 节点数 | 5 |
| 创建时间 | 2025-12-26 |
| 状态 | ✅ Ready for Production |

## 环境配置

### 服务器信息

```
IP Address: 146.190.52.84
反向代理: Nginx Proxy Manager (Container: nginx-proxy-manager)
系统 nginx: Disabled
```

### 端口配置

| 端口 | 服务 | 状态 |
|------|------|------|
| 443, 8443 | VPN (xray-reality) | ⛔ DO NOT TOUCH |
| 80, 81 | Nginx Proxy Manager | In Use |
| 3000 | n8n (HTTPS) | In Use |

## 部署步骤

### 第 1 步：验证 n8n 环境

```bash
# 检查 n8n 服务状态
docker ps | grep n8n

# 验证 Webhook 功能是否启用
curl -X GET http://localhost:5678/api/v1/webhooks \
  -H "X-N8N-API-KEY: YOUR_API_KEY"
```

### 第 2 步：导入工作流

#### 方式 A：通过 n8n UI（推荐）

1. 登录 n8n 仪表板：`https://146.190.52.84:3000`
2. 点击 "+" 创建新工作流
3. 点击 "Template" 或导入已有工作流
4. 选择或粘贴工作流 JSON
5. 点击 "Save" 保存工作流

#### 方式 B：通过 API

```bash
# 需要替换 YOUR_API_KEY
curl -X POST http://localhost:5678/api/v1/workflows \
  -H "X-N8N-API-KEY: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d @webhook_pong_test.json
```

### 第 3 步：激活工作流

1. 打开已导入的工作流
2. 点击右上角的 "Activate" 按钮
3. 确认激活：工作流状态应显示为 "Active"

```
Status Indicator: 🟢 Active
```

### 第 4 步：获取 Webhook URL

工作流激活后，n8n 会自动生成 Webhook URL：

```
https://146.190.52.84:3000/webhook/webhook_pong_test
```

或如果通过 Nginx Proxy Manager 配置了域名：

```
https://your-domain.com/webhook/webhook_pong_test
```

### 第 5 步：配置 Nginx Proxy Manager（可选）

如需通过自定义域名访问 Webhook：

1. 打开 Nginx Proxy Manager UI（通常在 `http://localhost:81`）
2. 添加新的 Proxy Host：
   - **Domain Names**: `webhook.your-domain.com`
   - **Scheme**: http
   - **Forward Hostname / IP**: localhost
   - **Forward Port**: 5678
   - **Enable SSL**: Yes
3. 生成或选择 SSL 证书
4. 保存配置

## 测试部署

### 基础功能测试

```bash
# 测试 Webhook 端点
curl -X POST https://146.190.52.84:3000/webhook/webhook_pong_test \
  -H "Content-Type: application/json" \
  -d '{"test": "value"}'

# 预期响应（状态码 200）：
# {"message": "pong"}
```

### 通过脚本自动化测试

创建 `test_webhook.sh`:

```bash
#!/bin/bash

WEBHOOK_URL="https://146.190.52.84:3000/webhook/webhook_pong_test"
MAX_RETRIES=3
RETRY_DELAY=2

for i in $(seq 1 $MAX_RETRIES); do
  echo "Test attempt $i..."

  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d '{"timestamp": "'$(date -u +'%Y-%m-%dT%H:%M:%SZ')'"}'
  )

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n-1)

  if [ "$HTTP_CODE" == "200" ]; then
    echo "✅ Test passed!"
    echo "Response: $BODY"
    exit 0
  else
    echo "❌ Test failed with HTTP $HTTP_CODE"
    if [ $i -lt $MAX_RETRIES ]; then
      sleep $RETRY_DELAY
    fi
  fi
done

echo "❌ All tests failed"
exit 1
```

运行测试：

```bash
chmod +x test_webhook.sh
./test_webhook.sh
```

## 监控和维护

### 查看执行日志

1. n8n UI → 打开工作流
2. 点击 "Executions" 标签页
3. 查看历史执行记录和详细日志

### 常见问题排查

#### 问题 1：Webhook 返回 404

**原因**: 工作流未激活或路径错误

**解决方案**:
```bash
# 验证工作流激活状态
curl -X GET http://localhost:5678/api/v1/workflows/cfTMmeg9Srv1bJch \
  -H "X-N8N-API-KEY: YOUR_API_KEY"

# 检查响应中的 "active" 字段是否为 true
```

#### 问题 2：无法连接到 Webhook

**原因**: 网络或防火墙问题

**解决方案**:
```bash
# 从服务器内部测试
docker exec n8n curl -X POST http://localhost:5678/webhook/webhook_pong_test

# 检查防火墙规则
sudo iptables -L -n | grep 3000

# 验证反向代理配置
curl -I https://146.190.52.84:3000/webhook/webhook_pong_test
```

#### 问题 3：响应格式异常

**原因**: Respond 节点配置错误

**解决方案**:
1. 打开工作流编辑器
2. 选择 "Respond to Webhook" 节点
3. 验证响应体配置：`{"message": "pong"}`
4. 检查 HTTP 状态码是否为 200
5. 重新保存并测试

### 健康检查

定期运行健康检查脚本（可通过 cron 配置）：

```bash
#!/bin/bash
# healthcheck.sh

WEBHOOK_URL="https://146.190.52.84:3000/webhook/webhook_pong_test"
TIMEOUT=5

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time $TIMEOUT \
  -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{}')

if [ "$HTTP_CODE" == "200" ]; then
  echo "$(date): Webhook healthy (HTTP $HTTP_CODE)" >> /var/log/webhook_health.log
  exit 0
else
  echo "$(date): Webhook unhealthy (HTTP $HTTP_CODE)" >> /var/log/webhook_health.log
  # 可选：发送告警
  exit 1
fi
```

### Cron 定时执行

```bash
# 每 5 分钟执行一次健康检查
*/5 * * * * /path/to/healthcheck.sh
```

## 备份和恢复

### 备份工作流

```bash
# 通过 API 导出工作流
curl -X GET http://localhost:5678/api/v1/workflows/cfTMmeg9Srv1bJch \
  -H "X-N8N-API-KEY: YOUR_API_KEY" \
  > webhook_pong_test_backup.json
```

### 恢复工作流

```bash
# 导入备份的工作流
curl -X POST http://localhost:5678/api/v1/workflows \
  -H "X-N8N-API-KEY: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d @webhook_pong_test_backup.json
```

## 性能考虑

| 指标 | 值 |
|------|-----|
| 平均响应时间 | < 100ms |
| 吞吐量 | > 100 req/s |
| 可用性目标 | 99.9% |
| 并发连接数 | 无限制 |

## 安全建议

1. **启用 Webhook 认证**
   - 在 Webhook 节点启用 "Authentication"
   - 选择 "Query" 参数认证方式
   - 配置 API Key 验证

2. **使用 HTTPS**
   - 所有 Webhook 调用必须使用 HTTPS
   - 确保 SSL 证书有效

3. **IP 白名单**
   - 如可能，限制允许的源 IP
   - 通过 Nginx 配置实现

4. **监控异常**
   - 定期检查执行日志
   - 设置告警规则（如可用）

## 回滚计划

如需回滚工作流：

1. 使用备份的工作流 JSON
2. 通过 n8n UI 删除当前工作流
3. 导入备份版本
4. 重新激活工作流

```bash
# 删除工作流
curl -X DELETE http://localhost:5678/api/v1/workflows/cfTMmeg9Srv1bJch \
  -H "X-N8N-API-KEY: YOUR_API_KEY"
```

## 下一步

- 配置监控和告警
- 设置自动化健康检查
- 与其他系统集成
- 添加请求验证（可选）

## 支持和文档

- [n8n 官方文档](https://docs.n8n.io/)
- [Webhook 集成指南](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- API 文档：见 [API.md](WebhookPongTest_API.md)

## 更新日志

| 日期 | 版本 | 说明 |
|------|------|------|
| 2025-12-26 | 1.0 | 初始部署 |
