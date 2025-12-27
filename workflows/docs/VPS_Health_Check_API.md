# VPS Health Check Monitor - API 文档

## 概览

VPS 健康检查 Workflow 通过 n8n 提供的 Webhook 接口，支持手动触发、查询状态等操作。本文档描述所有可用的 API 接口。

## 基础信息

- **Workflow ID**：peDp8QA5AZPPL43l
- **API 基础 URL**：`http://<n8n-instance>:5678/api/v1`
- **认证方式**：API Key（必须配置）

## Webhook 接口

### 1. 手动触发 Workflow

**请求：**
```http
POST /webhooks/webhook_id
Content-Type: application/json

{
  "trigger": "manual"
}
```

**参数说明：**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| trigger | string | 否 | 触发源标识，用于日志记录 |

**响应：**
```json
{
  "status": "success",
  "execution_id": "abc123def456",
  "workflow_id": "peDp8QA5AZPPL43l"
}
```

**cURL 示例：**
```bash
curl -X POST http://localhost:5678/api/v1/webhooks/VPS_Health_Check \
  -H "Content-Type: application/json" \
  -d '{"trigger":"manual"}'
```

---

## 工作流执行 API

### 2. 获取执行历史

**请求：**
```http
GET /workflows/peDp8QA5AZPPL43l/executions?limit=10&status=success
Authorization: Bearer YOUR_API_KEY
```

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| limit | integer | 25 | 返回结果数量（最大 100） |
| offset | integer | 0 | 分页偏移 |
| status | string | - | 执行状态：success/failed/error/waiting |
| sort | string | createdAt DESC | 排序字段 |

**响应：**
```json
{
  "data": [
    {
      "id": "exec_001",
      "workflowId": "peDp8QA5AZPPL43l",
      "mode": "scheduled",
      "status": "success",
      "startedAt": "2025-12-26T10:00:00Z",
      "stoppedAt": "2025-12-26T10:00:05Z",
      "executionTime": 5000
    }
  ],
  "pagination": {
    "pageSize": 10,
    "page": 1,
    "itemCount": 50
  }
}
```

**cURL 示例：**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:5678/api/v1/workflows/peDp8QA5AZPPL43l/executions?limit=10
```

---

### 3. 获取单次执行详情

**请求：**
```http
GET /workflows/peDp8QA5AZPPL43l/executions/:execution_id
Authorization: Bearer YOUR_API_KEY
```

**路径参数：**

| 参数 | 说明 |
|------|------|
| execution_id | 执行 ID |

**响应：**
```json
{
  "id": "exec_001",
  "workflowId": "peDp8QA5AZPPL43l",
  "mode": "scheduled",
  "status": "success",
  "startedAt": "2025-12-26T10:00:00Z",
  "stoppedAt": "2025-12-26T10:00:05Z",
  "data": {
    "resultData": {
      "runData": {
        "Schedule Trigger": [
          {
            "startTime": 1703587200000
          }
        ],
        "SSH 执行磁盘检查": [
          {
            "stdout": "Filesystem     Size  Used Avail Use% Mounted on\n/dev/sda1       50G   40G   10G  80% /"
          }
        ],
        "Code 节点": [
          {
            "partitions": [
              {
                "filesystem": "/dev/sda1",
                "mountpoint": "/",
                "size": "50G",
                "used": "40G",
                "avail": "10G",
                "percent": 80
              }
            ],
            "alert_triggered": true
          }
        ],
        "IF 节点": [
          {
            "condition_met": true
          }
        ],
        "Feishu 告警": [
          {
            "status": "success",
            "message_id": "msg_xyz789"
          }
        ]
      }
    }
  }
}
```

**cURL 示例：**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:5678/api/v1/workflows/peDp8QA5AZPPL43l/executions/exec_001
```

---

### 4. 获取最近执行状态

**请求：**
```http
GET /workflows/peDp8QA5AZPPL43l
Authorization: Bearer YOUR_API_KEY
```

**响应：**
```json
{
  "id": "peDp8QA5AZPPL43l",
  "name": "VPS Health Check Monitor",
  "active": true,
  "nodes": [
    {
      "id": "node_1",
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.cronTrigger"
    },
    {
      "id": "node_2",
      "name": "SSH 执行磁盘检查",
      "type": "n8n-nodes-base.ssh"
    },
    {
      "id": "node_3",
      "name": "Code 节点",
      "type": "n8n-nodes-base.code"
    },
    {
      "id": "node_4",
      "name": "IF 节点",
      "type": "n8n-nodes-base.if"
    },
    {
      "id": "node_5",
      "name": "Feishu 告警",
      "type": "n8n-nodes-base.feishu"
    }
  ],
  "connections": {},
  "lastExecution": {
    "id": "exec_001",
    "status": "success",
    "timestamp": "2025-12-26T10:00:00Z"
  }
}
```

---

## 数据模型

### SSH 输出数据结构

从 SSH 节点获取的磁盘使用信息：

```json
{
  "stdout": "Filesystem     Size  Used Avail Use% Mounted on\n/dev/sda1       50G   40G   10G  80% /\n/dev/sda2      100G   50G   50G  50% /home",
  "stderr": "",
  "exit_code": 0
}
```

### Code 节点处理后的数据

```json
{
  "partitions": [
    {
      "filesystem": "/dev/sda1",
      "mountpoint": "/",
      "size": "50G",
      "used": "40G",
      "avail": "10G",
      "percent": 80,
      "alert": true
    },
    {
      "filesystem": "/dev/sda2",
      "mountpoint": "/home",
      "size": "100G",
      "used": "50G",
      "avail": "50G",
      "percent": 50,
      "alert": false
    }
  ],
  "alert_triggered": true,
  "alert_count": 1,
  "timestamp": "2025-12-26T10:00:00Z"
}
```

### Feishu 告警消息

```json
{
  "msg_type": "interactive",
  "card": {
    "config": {
      "wide_screen_mode": true
    },
    "elements": [
      {
        "tag": "div",
        "text": {
          "content": "⚠️ VPS 磁盘空间告警\n\n主机：146.190.52.84\n分区：/dev/sda1 (/)\n总容量：50GB\n已用：40GB\n可用：10GB\n使用率：80%\n\n请及时清理或扩容！",
          "tag": "lark_md"
        }
      }
    ]
  }
}
```

---

## 错误处理

### 常见错误码

| 状态码 | 错误信息 | 原因 | 解决方案 |
|--------|--------|------|--------|
| 400 | Bad Request | 请求参数无效 | 检查 JSON 格式和参数类型 |
| 401 | Unauthorized | API Key 无效或缺失 | 检查 Authorization 头 |
| 404 | Not Found | Workflow 或执行不存在 | 验证 Workflow ID 和执行 ID |
| 500 | Internal Server Error | 服务器错误 | 查看 n8n 日志 |

### 错误响应示例

```json
{
  "status": "error",
  "message": "Workflow execution failed",
  "error": {
    "code": "SSH_CONNECTION_ERROR",
    "message": "SSH connection timeout",
    "details": "Unable to connect to 146.190.52.84:22"
  }
}
```

---

## 速率限制

- **频率限制**：每分钟 60 请求
- **并发限制**：最多 10 个并发执行
- **执行超时**：30 秒

超过限制会返回 429 状态码。

---

## 认证

### API Key 获取

1. 登录 n8n 实例
2. 导航到 Settings → API → Generate API Key
3. 复制 API Key

### 使用 API Key

在所有请求中添加 Authorization 头：

```bash
Authorization: Bearer YOUR_API_KEY
```

---

## 集成示例

### Python 调用示例

```python
import requests
import json

API_KEY = "YOUR_API_KEY"
BASE_URL = "http://localhost:5678/api/v1"
WORKFLOW_ID = "peDp8QA5AZPPL43l"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# 手动触发 Workflow
def trigger_workflow():
    response = requests.post(
        f"{BASE_URL}/webhooks/VPS_Health_Check",
        json={"trigger": "manual"}
    )
    return response.json()

# 获取最近执行记录
def get_recent_executions(limit=10):
    response = requests.get(
        f"{BASE_URL}/workflows/{WORKFLOW_ID}/executions?limit={limit}",
        headers=headers
    )
    return response.json()

# 获取执行详情
def get_execution_details(execution_id):
    response = requests.get(
        f"{BASE_URL}/workflows/{WORKFLOW_ID}/executions/{execution_id}",
        headers=headers
    )
    return response.json()

if __name__ == "__main__":
    print("手动触发:", trigger_workflow())
    print("\n最近执行:", get_recent_executions(5))
```

### Node.js 调用示例

```javascript
const axios = require('axios');

const API_KEY = 'YOUR_API_KEY';
const BASE_URL = 'http://localhost:5678/api/v1';
const WORKFLOW_ID = 'peDp8QA5AZPPL43l';

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};

// 获取执行历史
async function getExecutions(limit = 10) {
  try {
    const response = await axios.get(
      `${BASE_URL}/workflows/${WORKFLOW_ID}/executions?limit=${limit}`,
      { headers }
    );
    return response.data;
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// 调用示例
getExecutions(5).then(data => console.log(JSON.stringify(data, null, 2)));
```

---

## 监控与告警

### 获取告警统计

```bash
# 获取过去 24 小时的告警执行
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://localhost:5678/api/v1/workflows/peDp8QA5AZPPL43l/executions?status=success&limit=100" | \
  jq '.data | length'
```

### 实时监控脚本

```bash
#!/bin/bash

API_KEY="YOUR_API_KEY"
WORKFLOW_ID="peDp8QA5AZPPL43l"

# 每 5 分钟检查一次最近执行
while true; do
  echo "检查时间: $(date)"
  curl -s -H "Authorization: Bearer $API_KEY" \
    "http://localhost:5678/api/v1/workflows/$WORKFLOW_ID/executions?limit=1" | \
    jq '.data[0] | {status, startedAt, stoppedAt}'
  echo "---"
  sleep 300
done
```

---

## 参考资源

- [n8n API 文档](https://docs.n8n.io/api/)
- [Feishu Webhook API](https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot)
- [SSH 节点文档](https://docs.n8n.io/integrations/builtin/credentials/ssh/)
