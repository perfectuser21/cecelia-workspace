# 模板使用示例

## 示例 1: 使用 webhook-trigger 模板

**PRD**:
```
创建一个 API 端点接收飞书 webhook，解析消息内容，保存到数据库，返回成功响应。
```

**匹配模板**: webhook-trigger

**预期任务分解**:
```json
{
  "tasks": [
    {
      "id": "task_1",
      "name": "创建 Webhook 触发节点",
      "description": "配置 webhook 接收飞书回调",
      "depends_on": [],
      "complexity": 2,
      "model": "haiku"
    },
    {
      "id": "task_2",
      "name": "解析和处理消息",
      "description": "Code 节点解析飞书消息格式，提取关键字段",
      "depends_on": ["task_1"],
      "complexity": 3,
      "model": "sonnet"
    },
    {
      "id": "task_3",
      "name": "保存到数据库",
      "description": "使用 PostgreSQL 节点保存数据",
      "depends_on": ["task_2"],
      "complexity": 2,
      "model": "haiku"
    },
    {
      "id": "task_4",
      "name": "返回响应",
      "description": "Respond to Webhook 节点返回成功状态",
      "depends_on": ["task_3"],
      "complexity": 1,
      "model": "haiku"
    }
  ]
}
```

---

## 示例 2: 使用 scheduled-job 模板

**PRD**:
```
每天凌晨 3 点自动备份数据库，备份成功后发送飞书通知。
```

**匹配模板**: scheduled-job

**预期任务分解**:
```json
{
  "tasks": [
    {
      "id": "task_1",
      "name": "配置定时触发器",
      "description": "Schedule Trigger 节点设置为每天 03:00 UTC",
      "depends_on": [],
      "complexity": 1,
      "model": "haiku"
    },
    {
      "id": "task_2",
      "name": "执行备份脚本",
      "description": "SSH 节点执行 pg_dump 备份命令",
      "depends_on": ["task_1"],
      "complexity": 3,
      "model": "sonnet"
    },
    {
      "id": "task_3",
      "name": "发送通知",
      "description": "HTTP Request 节点调用飞书 webhook 发送备份结果",
      "depends_on": ["task_2"],
      "complexity": 2,
      "model": "haiku"
    }
  ]
}
```

---

## 示例 3: 使用 data-sync 模板

**PRD**:
```
每小时同步微博热搜数据，转换为标准格式，保存到 PostgreSQL。
```

**匹配模板**: data-sync

**预期任务分解**:
```json
{
  "tasks": [
    {
      "id": "task_1",
      "name": "配置定时触发",
      "description": "Schedule Trigger 每小时执行一次",
      "depends_on": [],
      "complexity": 1,
      "model": "haiku"
    },
    {
      "id": "task_2",
      "name": "获取微博热搜",
      "description": "HTTP Request 节点调用微博 API",
      "depends_on": ["task_1"],
      "complexity": 2,
      "model": "haiku"
    },
    {
      "id": "task_3",
      "name": "数据转换",
      "description": "Code 节点将原始数据转换为标准格式",
      "depends_on": ["task_2"],
      "complexity": 3,
      "model": "sonnet"
    },
    {
      "id": "task_4",
      "name": "保存数据",
      "description": "PostgreSQL 节点批量插入数据",
      "depends_on": ["task_3"],
      "complexity": 2,
      "model": "haiku"
    }
  ]
}
```

---

## 示例 4: 使用 error-handling 模板

**PRD**:
```
调用第三方 API 获取数据，失败时重试 3 次，最终失败发送告警。
```

**匹配模板**: error-handling

**预期任务分解**:
```json
{
  "tasks": [
    {
      "id": "task_1",
      "name": "配置错误捕获",
      "description": "使用 Error Trigger 和 Try-Catch 结构",
      "depends_on": [],
      "complexity": 3,
      "model": "sonnet"
    },
    {
      "id": "task_2",
      "name": "API 调用逻辑",
      "description": "HTTP Request 节点调用第三方 API",
      "depends_on": ["task_1"],
      "complexity": 2,
      "model": "haiku"
    },
    {
      "id": "task_3",
      "name": "重试逻辑",
      "description": "配置 HTTP Request 的 retry 选项（3次）",
      "depends_on": ["task_2"],
      "complexity": 2,
      "model": "haiku"
    },
    {
      "id": "task_4",
      "name": "错误通知",
      "description": "在 Catch 分支发送飞书告警",
      "depends_on": ["task_3"],
      "complexity": 2,
      "model": "haiku"
    }
  ]
}
```

---

## 示例 5: 组合多个模板

**PRD**:
```
创建一个定时任务，每 10 分钟同步抖音数据，如果失败重试 2 次，
成功后通过 webhook 通知其他系统。
```

**匹配模板**: scheduled-job + data-sync + error-handling

**说明**: 复杂的 workflow 可能组合多个模板的特性

**预期任务分解**:
```json
{
  "tasks": [
    {
      "id": "task_1",
      "name": "配置定时触发器",
      "description": "Schedule Trigger 每 10 分钟执行",
      "depends_on": [],
      "complexity": 1,
      "model": "haiku"
    },
    {
      "id": "task_2",
      "name": "配置错误处理",
      "description": "添加 Error Trigger 和重试逻辑",
      "depends_on": ["task_1"],
      "complexity": 3,
      "model": "sonnet"
    },
    {
      "id": "task_3",
      "name": "SSH 执行爬虫",
      "description": "SSH 节点调用抖音爬虫脚本（带重试）",
      "depends_on": ["task_2"],
      "complexity": 4,
      "model": "opus"
    },
    {
      "id": "task_4",
      "name": "数据转换",
      "description": "Code 节点解析爬虫返回的 JSON",
      "depends_on": ["task_3"],
      "complexity": 3,
      "model": "sonnet"
    },
    {
      "id": "task_5",
      "name": "保存数据库",
      "description": "PostgreSQL 节点批量保存",
      "depends_on": ["task_4"],
      "complexity": 2,
      "model": "haiku"
    },
    {
      "id": "task_6",
      "name": "Webhook 通知",
      "description": "HTTP Request 通知其他系统",
      "depends_on": ["task_5"],
      "complexity": 2,
      "model": "haiku"
    },
    {
      "id": "task_7",
      "name": "失败告警",
      "description": "Error Trigger 分支发送飞书告警",
      "depends_on": ["task_2"],
      "complexity": 2,
      "model": "haiku"
    }
  ]
}
```

---

## 测试方法

### 1. 通过 webhook 测试

```bash
curl -X POST "https://zenithjoy21xx.app.n8n.cloud/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{
    "prd": "创建一个 API 端点接收飞书 webhook，解析消息内容，保存到数据库，返回成功响应",
    "project": "testing"
  }'
```

### 2. 查看任务分解结果

执行后检查 `/home/xx/dev/zenithjoy-autopilot/workflows/ai-factory-runs/{run_id}/plan.json`

### 3. 验证模板匹配

检查 plan.json 中的任务是否符合预期的模板结构。

---

## 注意事项

1. **模板是参考，不是强制**：AI 会根据实际需求调整
2. **复杂度影响模型选择**：高复杂度自动使用 opus
3. **依赖关系自动处理**：拓扑排序确保正确的执行顺序
4. **模板可扩展**：可以在 templates.json 添加新模板

