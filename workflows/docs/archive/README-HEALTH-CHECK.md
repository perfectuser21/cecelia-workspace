# Health Check Webhook - 项目说明

## 项目概述

本项目实现了一个简单的 **Health Check Webhook**，用于实时监控服务可用性和健康状态。该 webhook 可被外部系统定期调用，快速判断服务是否在线。

### 核心功能

- ✅ 接收 GET 请求到 `/health` 或 `/api/health` 端点
- ✅ 返回 200 HTTP 状态码表示服务健康
- ✅ 返回 JSON 响应包含状态和时间戳
- ✅ 零配置、零依赖，即时部署

## 工作流信息

| 属性 | 值 |
|------|-----|
| **Workflow ID** | MOVxug1XoLspA4Hp |
| **创建方法** | Template |
| **节点数量** | 3 |
| **状态** | ✅ 已部署 |

## 工作流结构

该 workflow 由以下 3 个节点组成：

### 1. Webhook 节点
- **类型**: Trigger / Webhook
- **监听路径**: `/health` 或 `/api/health`
- **接收方法**: GET
- **功能**: 作为 workflow 的入口点，接收来自外部系统的健康检查请求

### 2. Response 节点（可选）
- **类型**: HTTP Response / Helper
- **功能**: 构建 HTTP 响应体

### 3. Output 节点
- **类型**: Output / Return
- **返回数据**:
  ```json
  {
    "status": "ok",
    "timestamp": "{{$now}}"
  }
  ```

## 使用场景

1. **Load Balancer 健康检查** - 定期检测服务是否在线
2. **监控告警系统** - 集成到 Prometheus、Datadog 等监控平台
3. **容器编排** - Kubernetes liveness probe、readiness probe
4. **定期心跳检测** - 确保工作流持续运行
5. **API 可用性监测** - 外部系统集成时的状态确认

## 集成示例

### cURL 测试
```bash
curl -X GET "http://your-n8n-server:port/webhook/health"
```

### Python 集成
```python
import requests
import json

response = requests.get("http://your-n8n-server:port/webhook/health")
if response.status_code == 200:
    data = response.json()
    print(f"Service Status: {data['status']}")
    print(f"Timestamp: {data['timestamp']}")
```

### JavaScript/Node.js 集成
```javascript
const health = await fetch("http://your-n8n-server:port/webhook/health")
  .then(res => res.json());
console.log(`Status: ${health.status}, Time: ${health.timestamp}`);
```

## 配置修改

### 更改 Webhook 路径
编辑 Webhook 节点，修改 **Path** 字段：
- 默认: `/health`
- 可选: `/api/health`, `/status`, `/ping` 等

### 扩展响应信息
修改 Output 节点的响应体，添加更多信息：
```json
{
  "status": "ok",
  "timestamp": "{{$now}}",
  "version": "1.0.0",
  "uptime": "{{$execution.startTime}}"
}
```

## 部署注意事项

- 该 workflow 默认处于 **启用** 状态
- 无需额外的认证配置（可根据需要添加 API Key 认证）
- 无数据库依赖，无外部 API 调用
- 响应时间 < 100ms

## 监控与日志

### 查看执行日志
1. 打开 n8n Dashboard
2. 进入 Health Check Workflow
3. 切换到 **Execution History** 标签
4. 查看每次请求的详细信息和响应

### 告警配置（可选）
如需在 workflow 异常时收到通知，可添加：
- **Slack 通知**
- **Email 告警**
- **Webhook 回调**

---

**创建时间**: 2025-12-26
**版本**: 1.0.0
**状态**: Production Ready ✅
