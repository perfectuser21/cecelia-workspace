# Health Check Webhook - 部署步骤

## 部署状态

| 阶段 | 状态 | 完成时间 |
|------|------|---------|
| ✅ Workflow 创建 | 完成 | 2025-12-26 |
| 📋 文档生成 | 完成 | 2025-12-26 |
| 🔧 配置验证 | 待执行 | - |
| 🚀 生产部署 | 待执行 | - |

---

## 前置条件

### 系统要求
- n8n 服务 >= v1.0.0
- Node.js >= 16.x
- 网络连接正常

### 权限要求
- n8n 管理员账户（用于激活 workflow）
- Webhook 端口可访问（通常为 80/443）

### 环境变量
```bash
# n8n 主机
N8N_HOST=your-n8n-server
# n8n 端口
N8N_PORT=5678
# Webhook URL 前缀
WEBHOOK_PREFIX=webhook
```

---

## 部署步骤

### Step 1: 验证 Workflow 创建

```bash
# 确认 workflow 已创建
curl -X GET "http://$N8N_HOST:$N8N_PORT/api/v1/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" | jq '.data[] | select(.id == "MOVxug1XoLspA4Hp")'
```

**预期结果**：
```json
{
  "id": "MOVxug1XoLspA4Hp",
  "name": "Health Check Webhook",
  "active": true,
  "nodes": 3
}
```

### Step 2: 激活 Workflow

#### 方法 A: 通过 n8n UI
1. 打开 n8n Dashboard
2. 导航到 **Workflows**
3. 找到 "Health Check Webhook"
4. 点击右上角 **Activate** 按钮
5. 确认 workflow 状态变为 "Active"

#### 方法 B: 通过 API
```bash
curl -X PATCH "http://$N8N_HOST:$N8N_PORT/api/v1/workflows/MOVxug1XoLspA4Hp" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "active": true
  }'
```

### Step 3: 测试 Webhook 端点

#### 基础健康检查
```bash
curl -X GET "http://$N8N_HOST:$N8N_PORT/webhook/health"
```

**预期响应**（200 OK）：
```json
{
  "status": "ok",
  "timestamp": "2025-12-26T10:30:45.123Z"
}
```

#### 详细测试
```bash
curl -v -X GET "http://$N8N_HOST:$N8N_PORT/webhook/health" \
  -H "User-Agent: HealthCheck/1.0" \
  -w "\nHTTP Status: %{http_code}\n"
```

### Step 4: 验证响应时间

```bash
# 多次请求性能测试
for i in {1..10}; do
  time curl -s "http://$N8N_HOST:$N8N_PORT/webhook/health" > /dev/null
done
```

**性能目标**：平均响应时间 < 100ms

### Step 5: 配置监控告警

#### 集成到 Prometheus
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'n8n-health'
    static_configs:
      - targets: ['your-n8n-server:5678']
    metrics_path: '/webhook/health'
```

#### 集成到 Kubernetes
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: n8n
spec:
  containers:
  - name: n8n
    livenessProbe:
      httpGet:
        path: /webhook/health
        port: 5678
      initialDelaySeconds: 30
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /webhook/health
        port: 5678
      initialDelaySeconds: 10
      periodSeconds: 5
```

#### 集成到 Docker Compose
```yaml
services:
  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5678/webhook/health"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 40s
```

---

## 配置选项

### 修改 Webhook 路径

如需更改端点路径，编辑 Webhook 节点：

1. 打开 Health Check Workflow
2. 点击 Webhook 节点
3. 修改 **Path** 字段（例如：`/api/health`）
4. 点击 **Save** 保存
5. 重新激活 workflow

### 添加认证

为 webhook 添加 API Key 认证：

1. 编辑 Webhook 节点
2. 展开 **Authentication** 部分
3. 选择 **API Key** 或 **Bearer Token**
4. 配置相应的认证规则
5. 测试时在请求头添加认证信息

```bash
curl -X GET "http://$N8N_HOST:$N8N_PORT/webhook/health" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 扩展响应数据

修改 Output 节点以返回更多信息：

```json
{
  "status": "ok",
  "timestamp": "{{$now}}",
  "workflow_id": "MOVxug1XoLspA4Hp",
  "execution_time_ms": "{{$execution.startTime}}",
  "uptime": "24h 30m"
}
```

---

## 故障排除

### Issue 1: Webhook 返回 404

**原因**: Workflow 未激活或路径错误

**解决方案**:
```bash
# 检查 workflow 是否激活
curl -X GET "http://$N8N_HOST:$N8N_PORT/api/v1/workflows/MOVxug1XoLspA4Hp" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" | jq '.active'

# 应返回 true，若返回 false，使用 Step 2 中的方法激活
```

### Issue 2: 超时错误

**原因**: n8n 服务未运行或网络不可达

**解决方案**:
```bash
# 检查 n8n 服务状态
curl -I "http://$N8N_HOST:$N8N_PORT/api/v1/health"

# 检查网络连接
ping -c 4 $N8N_HOST
```

### Issue 3: 响应时间过长

**原因**: 系统负载高或网络延迟

**解决方案**:
- 检查 n8n 日志：`docker logs n8n-container`
- 检查系统资源：`htop`
- 减少其他 workflow 的并发执行

### Issue 4: CORS 错误

**原因**: 浏览器跨域请求被阻止

**解决方案**:
```bash
# 服务端不需要 CORS，但如需浏览器访问，配置 n8n CORS
# 编辑 .env 或 docker-compose.yml
N8N_CORS_ORIGIN=*
```

---

## 回滚步骤

如需禁用此 workflow：

### 方法 A: 通过 UI
1. 打开 n8n Dashboard
2. 找到 Health Check Workflow
3. 点击 **Deactivate** 按钮

### 方法 B: 通过 API
```bash
curl -X PATCH "http://$N8N_HOST:$N8N_PORT/api/v1/workflows/MOVxug1XoLspA4Hp" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "active": false
  }'
```

---

## 生产检查清单

- [ ] Workflow 已激活且运行正常
- [ ] Webhook 端点可从外部网络访问
- [ ] 响应时间 < 100ms
- [ ] 已配置监控和告警
- [ ] 有备用方案或回滚计划
- [ ] 团队成员了解维护流程
- [ ] 文档已更新到最新版本

---

## 相关资源

- [n8n Webhook 文档](https://docs.n8n.io/integrations/webhooks/)
- [n8n API 参考](https://docs.n8n.io/api/api-reference/)
- [n8n 部署指南](https://docs.n8n.io/hosting/)

---

**最后更新**: 2025-12-26
**维护人**: DevOps Team
**支持联系**: devops@company.com
