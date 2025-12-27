# ping-1 Webhook Workflow

简单的 n8n webhook 工作流，用于测试和演示基本的 webhook 功能。

## 概述

**Workflow ID**: `xc3nT8Jtjp9ncpMj`
**创建方式**: Template
**节点数**: 3
**状态**: ✅ Active

ping-1 是一个最小化的 webhook 工作流，展示如何在 n8n 中创建和配置 webhook 触发器。

## 功能

- 接收 HTTP GET/POST 请求
- 返回基本的 pong 响应
- 用于测试 webhook 连接和 n8n 集成

## 工作流配置

### 节点组成

1. **Webhook Trigger** - 监听 HTTP 请求
   - 方法: GET, POST
   - 路径: `/webhook/ping-1`

2. **Respond to Webhook** - 返回响应
   - 状态码: 200
   - 响应体: 包含 pong 状态

3. **Logic Node** (如适用)
   - 请求处理和验证

## API 端点

```
GET/POST https://146.190.52.84/webhook/ping-1
```

### 请求示例

```bash
# POST 请求
curl -X POST https://146.190.52.84/webhook/ping-1 \
  -H "Content-Type: application/json" \
  -d '{"message": "ping"}'

# GET 请求
curl https://146.190.52.84/webhook/ping-1
```

### 响应示例

```json
{
  "status": "pong",
  "timestamp": "2025-12-26T...",
  "success": true
}
```

## 快速开始

### 前置要求

- n8n 实例运行中
- Nginx Proxy Manager 配置完成
- 公网访问到 146.190.52.84

### 启动工作流

1. 登录 n8n (http://localhost:5678)
2. 找到工作流 `ping-1`
3. 点击 "Activate" 按钮启用 webhook
4. 复制 webhook URL
5. 向端点发送请求进行测试

## 测试

### 本地测试

```bash
# 测试本地 webhook
curl -X POST http://localhost:5678/webhook/ping-1

# 测试公网 webhook
curl -X POST https://146.190.52.84/webhook/ping-1
```

### 验证响应

工作流应该返回 200 状态码和 pong 响应体。

## 监控和日志

- 在 n8n 执行历史中查看每个请求
- 检查工作流执行日志了解状态
- 使用 Claude Monitor 监控健康状态

## 部署架构

```
Internet Request
    ↓
Nginx Proxy Manager (Port 443)
    ↓
n8n Instance (localhost:5678)
    ↓
ping-1 Workflow
    ↓
HTTP Response (200 OK)
```

## 常见问题

### Webhook 不响应

1. 确保工作流已激活（Active 状态）
2. 验证 Nginx Proxy Manager 配置正确
3. 检查网络防火墙规则
4. 查看 n8n 执行日志获取错误信息

### 端口冲突

注意全局规则的端口禁区：
- **443, 8443** - VPN (xray-reality) - 不要动
- **80, 81, 3000** - Nginx Proxy Manager - HTTPS 服务用 3000
- **3456, 5173** - Claude Monitor

### 权限问题

- 确保用户有权限激活工作流
- 检查 webhook 是否有访问限制
- 验证 n8n 凭据配置

## 文件结构

```
n8n-workflows/
├── ping-1-README.md       # 项目说明（本文件）
├── ping-1-DEPLOY.md       # 部署步骤
├── ping-1-API.md          # API 文档
└── workflows/
    └── ping-1.json        # 工作流定义
```

## 维护

- 定期检查工作流执行状态
- 监控错误日志
- 定期测试 webhook 可用性
- 检查日志文件大小

## 相关资源

- [n8n 官方文档](https://docs.n8n.io/)
- [Webhook 节点文档](https://docs.n8n.io/workflows/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- 服务器: 146.190.52.84
- n8n 本地地址: http://localhost:5678

## 版本信息

- 创建日期: 2025-12-26
- 执行计划 ID: concurrent-1
- 创建结果: 成功
