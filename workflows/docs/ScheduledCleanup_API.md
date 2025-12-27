# 定时清理任务 - API 文档

## API 概览

本文档描述如何通过 n8n API 或 Webhook 与"定时清理任务" Workflow 集成。

## Workflow 基本信息

```
ID: GVzOCR4c1MRpcZkO
名称: Scheduled Cleanup - Feishu Notify
类型: Timer-triggered Workflow
API 版本: n8n v1.0+
```

## API 端点

### 1. 获取 Workflow 信息

#### 请求

```http
GET /api/v1/workflows/GVzOCR4c1MRpcZkO
Authorization: Bearer <api-key>
```

#### 响应

```json
{
  "id": "GVzOCR4c1MRpcZkO",
  "name": "Scheduled Cleanup - Feishu Notify",
  "active": true,
  "nodes": [
    {
      "id": "node_1",
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.schedule",
      "parameters": {
        "rule": "0 3 * * *"
      }
    },
    {
      "id": "node_2",
      "name": "Execute Command",
      "type": "n8n-nodes-base.execute",
      "parameters": {
        "command": "find /tmp -type f -mtime +7 -delete"
      }
    },
    {
      "id": "node_3",
      "name": "Feishu Notification",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "https://open.feishu.cn/open-apis/bot/v2/hook/..."
      }
    }
  ],
  "createdAt": "2025-12-26T00:00:00.000Z",
  "updatedAt": "2025-12-26T00:00:00.000Z"
}
```

### 2. 手动触发 Workflow

#### 请求

```http
POST /api/v1/workflows/GVzOCR4c1MRpcZkO/execute
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "triggerData": {
    "node": "Schedule Trigger"
  }
}
```

#### 响应 (成功)

```json
{
  "id": "execution-12345",
  "workflowId": "GVzOCR4c1MRpcZkO",
  "mode": "webhook",
  "startedAt": "2025-12-26T03:00:00.000Z",
  "stoppedAt": "2025-12-26T03:05:23.000Z",
  "status": "success",
  "data": {
    "resultData": {
      "runData": {
        "Execute Command": [
          {
            "stdout": "42 files deleted",
            "deletedSize": "2.3GB"
          }
        ],
        "Feishu Notification": [
          {
            "statusCode": 200,
            "body": {
              "code": 0,
              "msg": "ok"
            }
          }
        ]
      }
    }
  }
}
```

#### 响应 (失败)

```json
{
  "id": "execution-12346",
  "workflowId": "GVzOCR4c1MRpcZkO",
  "mode": "webhook",
  "status": "error",
  "error": {
    "name": "NodeExecutionError",
    "message": "Failed to execute command",
    "nodeId": "node_2"
  }
}
```

### 3. 获取执行历史

#### 请求

```http
GET /api/v1/workflows/GVzOCR4c1MRpcZkO/executions?limit=10&order=DESC
Authorization: Bearer <api-key>
```

#### 响应

```json
{
  "data": [
    {
      "id": "execution-12345",
      "workflowId": "GVzOCR4c1MRpcZkO",
      "status": "success",
      "startedAt": "2025-12-26T03:00:00.000Z",
      "stoppedAt": "2025-12-26T03:05:23.000Z",
      "duration": 323000
    },
    {
      "id": "execution-12344",
      "workflowId": "GVzOCR4c1MRpcZkO",
      "status": "success",
      "startedAt": "2025-12-25T03:00:00.000Z",
      "stoppedAt": "2025-12-25T03:04:15.000Z",
      "duration": 255000
    }
  ],
  "count": 2,
  "total": 100,
  "page": 1
}
```

### 4. 获取执行详情

#### 请求

```http
GET /api/v1/workflows/GVzOCR4c1MRpcZkO/executions/execution-12345
Authorization: Bearer <api-key>
```

#### 响应

```json
{
  "id": "execution-12345",
  "workflowId": "GVzOCR4c1MRpcZkO",
  "status": "success",
  "mode": "webhook",
  "startedAt": "2025-12-26T03:00:00.000Z",
  "stoppedAt": "2025-12-26T03:05:23.000Z",
  "duration": 323000,
  "data": {
    "resultData": {
      "runData": {
        "Schedule Trigger": [
          {
            "status": "success"
          }
        ],
        "Execute Command": [
          {
            "stdout": "42 files deleted, 2.3GB freed",
            "statusCode": 0
          }
        ],
        "Feishu Notification": [
          {
            "statusCode": 200,
            "body": {
              "code": 0,
              "msg": "ok",
              "data": {
                "message_id": "om_xxxxxxxxxxxxx"
              }
            }
          }
        ]
      }
    }
  }
}
```

### 5. 启用/禁用 Workflow

#### 启用

```http
PATCH /api/v1/workflows/GVzOCR4c1MRpcZkO
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "active": true
}
```

#### 禁用

```http
PATCH /api/v1/workflows/GVzOCR4c1MRpcZkO
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "active": false
}
```

#### 响应

```json
{
  "id": "GVzOCR4c1MRpcZkO",
  "active": true,
  "message": "Workflow activated"
}
```

## Webhook API

### 自定义 Webhook 触发

如果需要通过自定义事件触发清理任务，可创建 Webhook 节点。

#### 配置

1. 在 Workflow 中添加 "Webhook" 节点
2. 配置路径: `/cleanup-trigger`
3. 获取 Webhook URL:
   ```
   https://zenithjoy21xx.app.n8n.cloud/webhook/cleanup-trigger
   ```

#### 请求

```http
POST https://zenithjoy21xx.app.n8n.cloud/webhook/cleanup-trigger
Content-Type: application/json

{
  "triggerReason": "manual",
  "timestamp": "2025-12-26T10:30:00Z"
}
```

#### 响应

```json
{
  "status": "queued",
  "executionId": "execution-12347"
}
```

## 数据格式

### 清理命令输出格式

Execute Command 节点输出：

```json
{
  "stdout": "find /tmp -type f -mtime +7 -delete",
  "stderr": "",
  "exitCode": 0,
  "deletedCount": 42,
  "freedSpace": "2.3GB",
  "executionTime": "5.23s"
}
```

### 飞书 Webhook 消息格式

发送到飞书的消息体：

```json
{
  "msg_type": "card",
  "card": {
    "header": {
      "title": {
        "content": "定时清理任务 - 执行报告",
        "tag": "plain_text"
      },
      "subtitle": {
        "content": "自动化临时文件清理",
        "tag": "plain_text"
      },
      "template": "blue"
    },
    "elements": [
      {
        "tag": "div",
        "text": {
          "content": "**执行时间**: 2025-12-26 03:00:00\n**清理目录**: /tmp\n**文件年龄**: 7+ 天\n**删除文件**: 42 个\n**释放空间**: 2.3 GB\n**执行状态**: ✅ 成功",
          "tag": "lark_md"
        }
      },
      {
        "tag": "hr"
      },
      {
        "tag": "note",
        "elements": [
          {
            "tag": "text",
            "text": "更新时间: 2025-12-26 03:05:23",
            "style": {
              "is_underline": false
            }
          }
        ]
      }
    ]
  }
}
```

## 状态码

| 状态码 | 说明 | 处理方式 |
|--------|------|---------|
| `200` | 请求成功 | 正常处理 |
| `400` | 请求参数错误 | 检查请求体 |
| `401` | 认证失败 | 检查 API Key |
| `404` | Workflow 不存在 | 确认 ID 正确 |
| `500` | 服务器错误 | 联系管理员 |

## 错误处理

### 常见错误

#### 错误 1: Workflow 不存在

```json
{
  "code": 404,
  "message": "Workflow not found",
  "workflowId": "GVzOCR4c1MRpcZkO"
}
```

**解决**: 确认 Workflow ID 正确

#### 错误 2: 认证失败

```json
{
  "code": 401,
  "message": "Invalid API key",
  "hint": "Check your Bearer token"
}
```

**解决**: 检查 n8n API Key 配置

#### 错误 3: 执行超时

```json
{
  "code": 408,
  "message": "Workflow execution timeout",
  "executionId": "execution-12345"
}
```

**解决**: 增加执行超时时间

#### 错误 4: 命令执行失败

```json
{
  "status": "error",
  "error": {
    "message": "Command failed: Permission denied",
    "nodeId": "Execute Command",
    "exitCode": 1
  }
}
```

**解决**: 检查文件权限和 SSH 连接

## 集成示例

### 示例 1: Python 脚本手动触发

```python
import requests
import json

API_KEY = "your-n8n-api-key"
WORKFLOW_ID = "GVzOCR4c1MRpcZkO"
API_URL = "https://zenithjoy21xx.app.n8n.cloud/api/v1"

def trigger_cleanup():
    url = f"{API_URL}/workflows/{WORKFLOW_ID}/execute"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    response = requests.post(url, headers=headers, json={})

    if response.status_code == 200:
        data = response.json()
        print(f"Execution ID: {data['id']}")
        print(f"Status: {data['status']}")
    else:
        print(f"Error: {response.text}")

if __name__ == "__main__":
    trigger_cleanup()
```

### 示例 2: Curl 命令手动触发

```bash
#!/bin/bash

API_KEY="your-n8n-api-key"
WORKFLOW_ID="GVzOCR4c1MRpcZkO"
BASE_URL="https://zenithjoy21xx.app.n8n.cloud"

curl -X POST \
  "${BASE_URL}/api/v1/workflows/${WORKFLOW_ID}/execute" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 示例 3: 获取最近执行状态

```bash
#!/bin/bash

API_KEY="your-n8n-api-key"
WORKFLOW_ID="GVzOCR4c1MRpcZkO"
BASE_URL="https://zenithjoy21xx.app.n8n.cloud"

# 获取最近 5 次执行
curl -X GET \
  "${BASE_URL}/api/v1/workflows/${WORKFLOW_ID}/executions?limit=5&order=DESC" \
  -H "Authorization: Bearer ${API_KEY}" | jq '.'
```

### 示例 4: 监控脚本

```python
import requests
import json
from datetime import datetime

API_KEY = "your-n8n-api-key"
WORKFLOW_ID = "GVzOCR4c1MRpcZkO"
API_URL = "https://zenithjoy21xx.app.n8n.cloud/api/v1"

def check_cleanup_status():
    """检查最近一次清理任务状态"""
    url = f"{API_URL}/workflows/{WORKFLOW_ID}/executions?limit=1"
    headers = {"Authorization": f"Bearer {API_KEY}"}

    response = requests.get(url, headers=headers)
    data = response.json()

    if data['count'] > 0:
        execution = data['data'][0]
        print(f"执行 ID: {execution['id']}")
        print(f"状态: {execution['status']}")
        print(f"开始时间: {execution['startedAt']}")
        print(f"完成时间: {execution['stoppedAt']}")
        print(f"耗时: {execution['duration']}ms")

        if execution['status'] == 'success':
            print("✅ 最近一次清理任务成功")
        else:
            print("❌ 最近一次清理任务失败")
    else:
        print("未找到执行记录")

if __name__ == "__main__":
    check_cleanup_status()
```

## 速率限制

| 限制项 | 值 | 说明 |
|--------|-----|------|
| 请求速率 | 100/分钟 | API 请求频率 |
| 并发执行 | 5 | 同时执行的 Workflow 数 |
| 执行超时 | 3600 秒 | 单个执行最长时间 |
| 结果保留期 | 30 天 | 执行记录保留时间 |

## 认证

### API Key 配置

1. 登录 n8n Cloud
2. 账户设置 → API Keys
3. 创建新 Key
4. 复制 Key 值
5. 在请求头中使用:
   ```
   Authorization: Bearer <api-key>
   ```

### 示例请求

```bash
curl -X GET \
  https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/GVzOCR4c1MRpcZkO \
  -H "Authorization: Bearer sk_prod_xxxxxxxxxxxxx"
```

## 变更日志

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2025-12-26 | 初始版本，支持基础 API |
| - | - | - |

## 常见问题

**Q: 如何获取 API Key?**

A: 登录 n8n Cloud → Account Settings → API Keys → Create new key

**Q: API 调用是否有费用?**

A: 不额外计费，包含在 n8n 订阅中

**Q: 执行结果保留多久?**

A: 默认 30 天，可在设置中调整

**Q: 是否支持异步执行?**

A: 支持，Webhook 触发返回立即返回，实际执行异步进行

**Q: 如何处理执行失败?**

A: 通过 Error Handler 节点捕获，发送告警通知

---

**文档版本**: 1.0.0
**最后更新**: 2025-12-26
**API 版本**: v1
**技术支持**: Claude Code
