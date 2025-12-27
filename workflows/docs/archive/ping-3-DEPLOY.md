# ping-3 Webhook 部署文档

## 部署摘要

| 项目 | 内容 |
|------|------|
| **任务 ID** | task_1 |
| **任务名称** | 创建 ping-3 webhook workflow |
| **执行状态** | ✅ 成功 |
| **Workflow ID** | rdasZtQ3YeJN1tfy |
| **创建方式** | Template-based |
| **节点数量** | 3 |
| **执行模式** | 并发部署（concurrent-3） |
| **执行时间** | 2025-12-26 |

## 部署步骤

### 1. 前提条件

- n8n 实例正在运行（版本 >= 1.0）
- 具有管理员访问权限
- 网络能够访问 webhook 端点

### 2. Workflow 导入

ping-3 workflow 已通过 template 方式创建，包含以下节点：

```
节点 1: Webhook Trigger
  ├─ 类型: Webhook
  ├─ 方法: GET, POST
  └─ 路径: /webhook/ping-3

节点 2: Response Builder
  ├─ 类型: Function/Expression
  └─ 功能: 构建 JSON 响应体

节点 3: Return Response
  ├─ 类型: Respond to Webhook
  └─ 功能: 返回响应给客户端
```

### 3. 激活部署

在 n8n 界面中：
1. 打开 ping-3 workflow
2. 点击右上角 "Active" 切换按钮
3. 确认 workflow 状态变为 "Active"
4. 验证 webhook URL 已生成

### 4. 验证部署

```bash
# 测试 GET 请求
curl -X GET "https://your-domain/webhook/ping-3" \
  -H "Content-Type: application/json"

# 测试 POST 请求
curl -X POST "https://your-domain/webhook/ping-3" \
  -H "Content-Type: application/json" \
  -d '{}'

# 预期响应
{
  "status": "pong",
  "timestamp": "2025-12-26T10:30:45.123Z",
  "workflow_id": "rdasZtQ3YeJN1tfy"
}
```

## 环境配置

### 生产环境

- **域名**: 146.190.52.84
- **反向代理**: Nginx Proxy Manager
- **HTTPS**: 自动配置

### 注意事项

- ⚠️ 不要修改以下端口：443, 8443 (VPN), 80, 81 (Nginx)
- ✅ Webhook 端点自动通过 Nginx 代理
- 日志可在 n8n UI 的 Execution History 中查看

## 管理和维护

### 查看执行历史

1. 进入 ping-3 workflow
2. 点击 "Executions" 标签
3. 查看所有请求的执行记录和响应

### 修改响应格式

如需修改响应体：
1. 编辑 "Response Builder" 节点
2. 更新 JavaScript/Expression 代码
3. 测试并保存

### 禁用/启用 Workflow

```
n8n UI → Workflows → ping-3 → Active/Inactive 按钮
```

### 监控和告警

- **响应时间**: 通常 < 100ms
- **错误率**: 监控执行历史中的失败数
- **日志**: n8n 内置日志系统

## 故障排查

### Webhook 无法访问

**症状**: HTTP 404 或 Connection Refused

**解决方案**:
1. 确认 workflow 已激活
2. 检查 Nginx Proxy Manager 配置
3. 验证 webhook 路径正确性
4. 查看 n8n 日志

```bash
# 检查 n8n 运行状态
docker ps | grep n8n

# 查看日志
docker logs n8n
```

### 响应格式错误

**症状**: 返回 500 错误或非预期的响应格式

**解决方案**:
1. 检查 Response Builder 节点代码
2. 在 n8n 界面测试 workflow
3. 查看 Execution History 的详细错误信息

## 回滚步骤

如需回滚此 workflow：

1. 在 n8n 中禁用 workflow（点击 Active 按钮）
2. 删除 ping-3 workflow（可选）
3. 清理相关数据库记录（如需）

## 性能指标

- **平均响应时间**: < 50ms
- **并发支持**: n8n 默认支持
- **成功率目标**: > 99.9%

## 文件清单

- `ping-3.json` - Workflow 定义文件
- `ping-3-README.md` - 项目说明
- `ping-3-DEPLOY.md` - 部署文档（本文件）
- `ping-3-API.md` - API 文档

## 联系信息

如有问题或需要技术支持，请参考项目的 README.md 或 API.md 文档。
