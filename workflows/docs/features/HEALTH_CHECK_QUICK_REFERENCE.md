# Health Check Workflow 快速参考

## 访问端点

```bash
https://zenithjoy21xx.app.n8n.cloud/webhook/health-check
```

## 快速测试

```bash
# 最简单的测试
curl https://zenithjoy21xx.app.n8n.cloud/webhook/health-check | jq

# 带漂亮的格式化输出
curl -s https://zenithjoy21xx.app.n8n.cloud/webhook/health-check | \
  jq '{status: .status, time: .timestamp, service: .service}'
```

## 响应示例

```json
{
  "status": "ok",
  "timestamp": "2025-12-25T10:30:45.123Z",
  "service": "n8n workflows"
}
```

## Bash 集成

```bash
# 一行式检查
[ "$(curl -s https://zenithjoy21xx.app.n8n.cloud/webhook/health-check | jq -r '.status')" = "ok" ] && echo "✅ OK" || echo "❌ ERROR"

# 定时检查脚本
while true; do
  curl -s https://zenithjoy21xx.app.n8n.cloud/webhook/health-check | jq '.'
  sleep 30
done
```

## Docker 健康检查

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -f https://zenithjoy21xx.app.n8n.cloud/webhook/health-check || exit 1
```

## Kubernetes 配置

```yaml
livenessProbe:
  httpGet:
    path: /webhook/health-check
    port: 443
    scheme: HTTPS
  initialDelaySeconds: 30
  periodSeconds: 30
  timeoutSeconds: 5
  failureThreshold: 3
```

## 常用场景

### 场景 1: 监控面板刷新

```bash
# JavaScript
fetch('https://zenithjoy21xx.app.n8n.cloud/webhook/health-check')
  .then(r => r.json())
  .then(data => console.log(data.status))
```

### 场景 2: Cron 定时监控

```bash
# crontab 配置
*/5 * * * * curl -s https://zenithjoy21xx.app.n8n.cloud/webhook/health-check >> /var/log/n8n-health.log
```

### 场景 3: 告警通知

```bash
# 如果服务不健康则发送通知
status=$(curl -s https://zenithjoy21xx.app.n8n.cloud/webhook/health-check | jq -r '.status')
if [ "$status" != "ok" ]; then
  # 发送告警（邮件/Slack/飞书等）
  notify_admin "n8n 服务异常: $status"
fi
```

## 故障快速排查

| 问题 | 排查命令 |
|------|---------|
| 无响应 | `curl -v https://zenithjoy21xx.app.n8n.cloud/webhook/health-check` |
| 返回 404 | 检查 workflow 是否激活 |
| 返回 500 | `curl -s https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows` |
| 响应慢 | `time curl https://zenithjoy21xx.app.n8n.cloud/webhook/health-check` |

## 性能指标

- 响应时间: < 100ms
- 可用性: 99.9%
- 推荐轮询间隔: 30-60 秒

## 文档链接

- 详细部署: [HEALTH_CHECK_DEPLOYMENT.md](./HEALTH_CHECK_DEPLOYMENT.md)
- 完整 API: [API.md](./API.md)
- 项目概览: [README.md](./README.md)

---

**最后更新**: 2025-12-25
