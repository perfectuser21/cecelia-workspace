# Webhook Validator Feature

Webhook 回调验证模块，用于测试和监控 n8n Webhook 端点状态。

## 文件结构

```
webhook-validator/
  index.ts                    # 模块导出
  webhook-validator.route.ts  # API 路由
  webhook-validator.service.ts # 验证服务
  webhook-validator.types.ts  # 类型定义
  config.yaml                 # 配置文件
```

## API 端点

- `GET /api/webhook-validator/status` - 获取 Webhook 状态报告
- `POST /api/webhook-validator/test` - 手动测试 Webhook
- `POST /api/webhook-validator/test-execution` - 发送测试执行回调
- `POST /api/webhook-validator/test-retry` - 测试重试机制
- `POST /api/webhook-validator/generate-report` - 生成完整测试报告

## 状态报告

检查项目：
1. n8n 容器运行状态
2. 端口 5679 可达性
3. Webhook 端点响应
4. 重试机制配置

## 配置

- Webhook URL: `http://localhost:5679/webhook/execution-callback`
- n8n 容器: `n8n-self-hosted`
- 重试次数: 3
- 重试延迟: 2 秒

## 报告输出

- `webhook-status.json` - JSON 格式状态报告
- `webhook-test-report.md` - Markdown 格式测试报告
