# N8n Live Status

实时监控 n8n 工作流执行状态的 Feature 模块。

## 功能

- 今日统计：运行中/成功/失败/总数/成功率
- 运行中工作流：实时显示正在执行的工作流及耗时
- 最近完成：最近 10 条完成的执行记录
- 执行详情：单个执行的详细信息，包括节点执行时间线

## API 端点

### 获取实例状态
```
GET /api/v1/n8n-live-status/instances/status
```

### 获取实时状态概览
```
GET /api/v1/n8n-live-status/instances/:instance/overview
```

响应：
```json
{
  "todayStats": {
    "running": 2,
    "success": 45,
    "error": 3,
    "total": 50,
    "successRate": 90
  },
  "runningExecutions": [
    {
      "id": "exec-123",
      "workflowId": "wf-456",
      "workflowName": "数据采集",
      "startedAt": "2025-01-06T10:30:00Z",
      "duration": 120
    }
  ],
  "recentCompleted": [...],
  "timestamp": 1704532800000
}
```

### 获取执行详情
```
GET /api/v1/n8n-live-status/instances/:instance/executions/:executionId
```

响应：
```json
{
  "id": "exec-123",
  "workflowId": "wf-456",
  "workflowName": "数据采集",
  "status": "success",
  "mode": "trigger",
  "startedAt": "2025-01-06T10:30:00Z",
  "stoppedAt": "2025-01-06T10:32:00Z",
  "finished": true,
  "duration": 120,
  "nodes": [
    {
      "name": "Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "duration": 5,
      "status": "success"
    }
  ],
  "errorMessage": null
}
```

## 环境变量

```bash
# Local n8n instance
N8N_LOCAL_URL=http://localhost:5679
N8N_LOCAL_API_KEY=your-api-key

# Cloud n8n instance (optional)
N8N_CLOUD_URL=https://your-instance.app.n8n.cloud
N8N_CLOUD_API_KEY=your-cloud-api-key
```

## 刷新策略

- 运行中区域：前端轮询 10 秒
- 统计区域：前端轮询 30 秒
- 详情页：不自动刷新

## 依赖

- n8n REST API (v1)
- 需要 n8n API Key

---

**创建时间**: 2025-01-06
