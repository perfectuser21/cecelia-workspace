# ping-3 Webhook Workflow

## 概述

ping-3 是一个轻量级的 webhook 服务，用于健康检查和服务可用性验证。该 workflow 部署在 n8n 中，通过 HTTP 端点提供基本的 ping/pong 响应。

## 功能特性

- **HTTP Webhook 支持**: 同时支持 POST 和 GET 请求
- **即时响应**: 返回时间戳和服务状态信息
- **轻量化**: 最小化依赖，快速响应
- **可靠性**: 基于 n8n 工作流引擎，确保持续运行

## 快速开始

### 访问 Webhook

```bash
# GET 请求
curl -X GET https://your-domain/webhook/ping-3

# POST 请求
curl -X POST https://your-domain/webhook/ping-3
```

### 响应示例

```json
{
  "status": "pong",
  "timestamp": "2025-12-26T10:30:45.123Z",
  "workflow_id": "rdasZtQ3YeJN1tfy"
}
```

## 技术规格

- **Workflow ID**: rdasZtQ3YeJN1tfy
- **节点数**: 3
- **创建方式**: Template-based
- **请求方法**: GET, POST
- **响应格式**: JSON

## 部署信息

- **状态**: ✅ 已部署
- **创建时间**: 2025-12-26
- **模式**: 并发部署（concurrent-3）

## 架构

```
[HTTP Request] → [Webhook Node] → [Response Builder] → [JSON Response]
```

## 文件结构

```
.
├── ping-3.json              # Workflow 定义文件
├── ping-3-README.md         # 项目说明（本文件）
├── ping-3-DEPLOY.md         # 部署步骤
└── ping-3-API.md            # API 文档
```

## 维护

- 如需修改响应格式，编辑 workflow 中的 Response Builder 节点
- 如需更改 webhook 路径，需在 n8n 管理界面重新配置
- 日志可在 n8n 执行历史中查看

## 支持

如有问题或需要修改，请参考 ping-3-DEPLOY.md 中的维护章节。
