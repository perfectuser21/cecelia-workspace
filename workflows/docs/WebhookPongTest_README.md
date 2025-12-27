# Webhook Pong Test Workflow

## 项目概述

这是一个简单的 Webhook 测试工作流，用于验证 n8n 的 Webhook 功能。

### 功能特性

- 📨 接收 HTTP POST 请求
- 🔄 即时响应 `pong` 消息
- ✅ 用于服务健康检查和连接验证

## 工作流架构

```
HTTP POST Request
        ↓
   Webhook Trigger
        ↓
 Respond to Webhook
        ↓
  HTTP 200 Response
   {"message": "pong"}
```

## 使用场景

1. **连接验证** - 确保 Webhook 端点正常工作
2. **健康检查** - 作为服务可用性检查的简单探针
3. **集成测试** - 验证其他系统能否正确调用 Webhook

## 工作流 ID

- **Workflow ID**: `cfTMmeg9Srv1bJch`
- **创建方式**: Template-based
- **节点数**: 5

## 快速开始

### 前置要求

- n8n 实例正在运行
- 具有管理员权限的 n8n 账户
- 能够访问 Webhook 的外部系统（可选）

### 部署流程

详见 [DEPLOY.md](WebhookPongTest_DEPLOY.md)

### 测试工作流

#### 方式 1：使用 curl

```bash
curl -X POST https://your-n8n-instance.com/webhook/webhook_pong_test \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

#### 方式 2：使用在线工具

访问任何在线 API 测试工具（如 Postman、REST Client），发送 POST 请求到 Webhook URL。

#### 预期响应

```json
{
  "message": "pong"
}
```

HTTP Status: `200 OK`

## 配置说明

### Webhook 触发器节点

- **Authentication**: None（可选：添加 API Key 认证）
- **HTTP Method**: POST
- **Path**: `webhook_pong_test`

### Respond to Webhook 节点

- **Response Body**: `{"message": "pong"}`
- **Status Code**: 200
- **Response Headers**: `Content-Type: application/json`

## 常见问题

### Q: 如何修改响应内容？

A: 编辑 "Respond to Webhook" 节点的响应体即可。

### Q: 如何添加请求验证？

A: 在 Webhook 触发器节点中启用 "Authentication" 选项，选择合适的认证方式。

### Q: 工作流如何监视日志？

A: 通过 n8n UI 的 "Executions" 选项卡查看工作流执行历史和详细日志。

## 维护

- 定期检查执行日志确保正常运行
- 如需修改响应格式，直接编辑对应节点
- 无需定期更新或维护

## 相关资源

- [n8n Webhook 文档](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [n8n API 响应文档](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/)

## 版本信息

- **创建日期**: 2025-12-26
- **Last Updated**: 2025-12-26
- **Status**: Active ✅
