# Ping Webhook 部署指南

## 快速开始

### 1. Workflow 已创建

| 属性 | 值 |
|------|-----|
| Workflow ID | vaOcL9wAjducmP5a |
| Webhook 路径 | `/webhook/ping` |
| 状态 | ✅ 已激活 |
| 创建方法 | 模板 (3 个节点) |

### 2. 立即测试

```bash
# 测试 Ping Webhook
curl http://localhost:5679/webhook/ping

# 预期输出
# {"status": "pong", "timestamp": "2025-12-25T..."}
```

---

## 部署步骤

### 步骤 1: 验证 Workflow 激活状态

```bash
# 方式 1: 通过 n8n Web UI
# 访问 http://localhost:5679/workflows

# 方式 2: 通过 n8n API
curl -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
  http://localhost:5679/api/v1/workflows/vaOcL9wAjducmP5a
```

### 步骤 2: 配置 Nginx Proxy Manager (可选)

如果需要通过自定义域名暴露 webhook：

```bash
# 在 Nginx Proxy Manager 中添加代理规则
# 域名: ping.zenjoymedia.media
# 上游服务: http://localhost:5679/webhook/ping
# SSL: 使用 Nginx 管理的证书
```

### 步骤 3: 配置监控 (可选)

在 Claude Monitor 中添加监控任务：

```json
{
  "name": "n8n Ping Webhook",
  "type": "http",
  "url": "http://localhost:5679/webhook/ping",
  "interval": 60,
  "timeout": 5000,
  "expected_status": 200,
  "expected_body": "pong"
}
```

### 步骤 4: 集成到其他 Workflow

在其他 workflow 中引用该 webhook 作为健康检查：

```javascript
// 在 HTTP Request 节点中
GET http://localhost:5679/webhook/ping

// 在 JavaScript 节点中验证
const response = await fetch('http://localhost:5679/webhook/ping');
if (!response.ok) throw new Error('n8n service is down');
```

---

## 验证清单

- [x] Workflow 已创建 (ID: vaOcL9wAjducmP5a)
- [x] Webhook 节点已配置 (路径: /webhook/ping)
- [x] 响应节点已配置 (返回 pong)
- [x] Workflow 已激活
- [ ] 通过 curl 测试成功
- [ ] 集成到监控系统 (可选)
- [ ] 配置告警规则 (可选)

---

## 测试命令

### 基础测试

```bash
# 简单的 ping 测试
curl http://localhost:5679/webhook/ping

# 显示响应头和响应体
curl -i http://localhost:5679/webhook/ping

# JSON 格式化输出
curl -s http://localhost:5679/webhook/ping | jq .
```

### 负载测试

```bash
# 使用 Apache Bench 进行负载测试 (100 并发请求)
ab -n 1000 -c 100 http://localhost:5679/webhook/ping/

# 使用 wrk 进行性能测试 (4 个线程, 100 个连接, 30 秒)
wrk -t4 -c100 -d30s http://localhost:5679/webhook/ping
```

### 监控响应时间

```bash
# 连续 10 次请求，显示响应时间
for i in {1..10}; do
  echo "Request $i:"
  curl -w "HTTP Code: %{http_code}, Time: %{time_total}s\n" \
    -o /dev/null -s \
    http://localhost:5679/webhook/ping
  sleep 1
done
```

---

## 故障排除

### 症状 1: 404 Not Found

```bash
curl -v http://localhost:5679/webhook/ping
# < HTTP/1.1 404 Not Found
```

**原因**: Workflow 未激活或路径配置错误

**解决方案**:
```bash
# 1. 检查 workflow 是否已激活
curl -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
  http://localhost:5679/api/v1/workflows/vaOcL9wAjducmP5a \
  | jq .active

# 2. 如果返回 false，激活 workflow
curl -X PATCH -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active": true}' \
  http://localhost:5679/api/v1/workflows/vaOcL9wAjducmP5a
```

### 症状 2: 500 Internal Error

```bash
curl -v http://localhost:5679/webhook/ping
# < HTTP/1.1 500 Internal Server Error
```

**原因**: Webhook 节点或响应节点配置错误

**解决方案**:
```bash
# 1. 查看 n8n 容器日志
docker logs social-metrics-n8n | tail -50

# 2. 编辑 workflow，检查节点连接
# 在 n8n Web UI 中打开 vaOcL9wAjducmP5a

# 3. 确保响应节点返回有效的 JSON
```

### 症状 3: 连接超时

```bash
curl --max-time 5 http://localhost:5679/webhook/ping
# curl: (28) Operation timed out after 5000 milliseconds
```

**原因**: n8n 服务不可用或网络问题

**解决方案**:
```bash
# 1. 检查 n8n 容器状态
docker ps | grep social-metrics-n8n
# 应该显示容器正在运行

# 2. 检查容器日志
docker logs social-metrics-n8n

# 3. 重启容器
docker restart social-metrics-n8n

# 4. 检查网络连接
ping localhost:5679
```

### 症状 4: 503 Service Unavailable

```bash
curl -v http://localhost:5679/webhook/ping
# < HTTP/1.1 503 Service Unavailable
```

**原因**: Nginx Proxy Manager 或反向代理问题

**解决方案**:
```bash
# 1. 检查 Nginx Proxy Manager 容器
docker ps | grep nginx-proxy-manager

# 2. 检查 Nginx 配置
docker exec nginx-proxy-manager cat /data/nginx/proxy_host/1.conf

# 3. 重载 Nginx 配置
docker exec nginx-proxy-manager nginx -s reload
```

---

## 性能指标

### 预期响应时间

| 指标 | 目标值 | 说明 |
|------|--------|------|
| P50 响应时间 | < 100ms | 中位数响应时间 |
| P95 响应时间 | < 200ms | 95 分位数响应时间 |
| P99 响应时间 | < 500ms | 99 分位数响应时间 |
| 可用性 | > 99.9% | 月均可用性 |
| 成功率 | 100% | 正常情况下所有请求成功 |

### 监控收集

```bash
# 使用脚本收集 24 小时的响应时间数据
cat > monitor-ping.sh << 'EOF'
#!/bin/bash
endpoint="http://localhost:5679/webhook/ping"
duration=86400  # 24 小时
interval=60     # 每 60 秒采样一次

echo "timestamp,http_code,response_time_ms" > ping_metrics.csv

start_time=$(date +%s)
while true; do
  current_time=$(date +%s)
  elapsed=$((current_time - start_time))

  if [ $elapsed -ge $duration ]; then
    break
  fi

  response=$(curl -w "\n%{http_code}\n%{time_total}" -o /dev/null -s "$endpoint")
  http_code=$(echo "$response" | tail -1)
  response_time=$(echo "$response" | tail -2 | head -1)
  response_time_ms=$(echo "$response_time * 1000" | bc)

  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "$timestamp,$http_code,$response_time_ms" >> ping_metrics.csv

  sleep $interval
done

echo "Monitoring complete. Results saved to ping_metrics.csv"
EOF

chmod +x monitor-ping.sh
./monitor-ping.sh
```

---

## 回滚步骤

如果需要禁用 webhook：

```bash
# 停用 workflow
curl -X PATCH -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active": false}' \
  http://localhost:5679/api/v1/workflows/vaOcL9wAjducmP5a

# 验证已停用
curl -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
  http://localhost:5679/api/v1/workflows/vaOcL9wAjducmP5a \
  | jq .active
# 应该返回 false
```

---

## 下一步

1. **测试集成**: 在现有 workflow 中调用 ping webhook
2. **配置监控**: 在 Claude Monitor 中添加性能监控
3. **告警设置**: 配置告警规则 (连续 5 次失败则通知飞书)
4. **文档更新**: 更新其他 workflow 文档中的健康检查部分

---

## 相关文档

- [n8n Webhook 官方文档](https://docs.n8n.io/integrations/webhooks/)
- [AI Factory Workflow 生产线](./AI-FACTORY-README.md)
- [Health Check 标准 (RFC 7231)](https://tools.ietf.org/html/rfc7231#section-6.3.1)
