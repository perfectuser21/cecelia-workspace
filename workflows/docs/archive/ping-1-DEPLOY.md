# ping-1 Webhook 部署指南

本文档详细说明如何部署和激活 ping-1 webhook 工作流。

## 执行计划概览

| 项目 | 值 |
|------|-----|
| 计划 ID | concurrent-1 |
| PRD | 创建 ping-1 webhook |
| 目标工作流 | ping-1 |
| 总任务数 | 1 |
| 创建日期 | 2025-12-26 |

## 执行结果

✅ **部署成功**

| 指标 | 值 |
|------|-----|
| 任务 ID | task_1 |
| 状态 | success |
| Workflow ID | xc3nT8Jtjp9ncpMj |
| 创建方法 | template |
| 节点数 | 3 |

## 任务详情

### Task: 创建 ping-1 webhook workflow

**任务 ID**: task_1
**复杂度**: 低 (1/5)
**预期时间**: 5 分钟
**实际状态**: ✅ 完成

#### 任务描述

在 n8n 中创建一个简单的 webhook workflow，命名为 ping-1。配置 webhook 触发器，返回基本的 pong 响应。

#### 实现内容

✅ 创建 Webhook 触发节点（GET/POST 方法）
✅ 创建 Respond to Webhook 节点返回成功响应
✅ 配置节点连接和响应体

#### 输出文件

- `ping-1.json` - 工作流定义文件

## 部署步骤

### 第 1 步：验证 n8n 实例

```bash
# 检查 n8n 服务状态
curl -s http://localhost:5678/api/v1/health | jq .

# 预期输出：
# {
#   "database": {
#     "connected": true
#   }
# }
```

### 第 2 步：导入工作流

**方式 1: 通过 n8n UI**

1. 打开 n8n: http://localhost:5678
2. 点击 "+" 按钮创建新工作流
3. 选择 "Open" > "Import from File"
4. 选择 `ping-1.json` 文件
5. 点击 "Import" 按钮

**方式 2: 通过 API**

```bash
curl -X POST http://localhost:5678/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d @ping-1.json
```

### 第 3 步：配置 Webhook

工作流已包含 webhook 配置，但需要验证：

1. 打开工作流编辑器
2. 选择 "Webhook Trigger" 节点
3. 验证配置：
   - **方法**: GET, POST
   - **路径**: `/webhook/ping-1`
   - **认证**: 无（可选）
4. 点击 "Copy Webhook URL" 按钮获取公网 URL

### 第 4 步：激活工作流

1. 点击右上角 "Activate" 按钮
2. 确认工作流状态变为 **Active**
3. Webhook 现在可以接收请求

### 第 5 步：配置 Nginx Proxy Manager

确保 Nginx Proxy Manager 已正确配置 webhook 路由：

1. 登录 Nginx Proxy Manager (http://localhost:81)
2. 添加代理主机配置：
   - **Domain Names**: 146.190.52.84
   - **Scheme**: http
   - **Forward Hostname/IP**: localhost
   - **Forward Port**: 5678
   - **SSL Certificate**: 选择有效证书

3. 添加位置规则（可选）：
   - **Location**: `/webhook/ping-1`
   - **Forward to**: `http://localhost:5678`

## 测试部署

### 本地测试

```bash
# 测试本地 webhook（工作流活跃时）
curl -v -X POST http://localhost:5678/webhook/ping-1 \
  -H "Content-Type: application/json" \
  -d '{"message": "hello"}'

# 预期响应：
# HTTP/1.1 200 OK
# {
#   "status": "pong",
#   "timestamp": "2025-12-26T...",
#   "success": true
# }
```

### 公网测试

```bash
# 通过公网域名测试
curl -v -X POST https://146.190.52.84/webhook/ping-1 \
  -H "Content-Type: application/json" \
  -d '{"message": "hello"}'

# 预期响应：HTTP 200
```

### 验证执行日志

1. 打开工作流
2. 点击 "Executions" 标签
3. 查看最新的执行记录
4. 验证每个节点都正确执行

## 故障排查

### 问题 1: Webhook 返回 404

**原因**: 工作流未激活或路径不正确

**解决方案**:
```bash
# 检查工作流是否激活
curl -s http://localhost:5678/api/v1/workflows | jq '.data[] | select(.name=="ping-1")'

# 确认 active 字段为 true
```

### 问题 2: HTTPS 连接失败

**原因**: SSL 证书未配置或过期

**解决方案**:
1. 检查 Nginx Proxy Manager 证书状态
2. 查看证书过期日期
3. 必要时更新证书

```bash
# 测试 SSL 连接
openssl s_client -connect 146.190.52.84:443 -servername 146.190.52.84
```

### 问题 3: 跨域请求被拒

**原因**: CORS 未正确配置

**解决方案**:
1. 检查 n8n 配置文件
2. 启用 CORS 或配置允许的域名
3. 重启 n8n 服务

### 问题 4: 性能缓慢

**原因**: 网络延迟或 n8n 负载高

**解决方案**:
1. 检查网络连接
2. 监控 n8n 内存和 CPU 使用率
3. 查看执行历史，确认没有卡住的任务
4. 检查 Claude Monitor 状态

## 监控和维护

### 日常监控

```bash
# 检查 n8n 健康状态
curl -s http://localhost:5678/api/v1/health

# 查看工作流执行统计
curl -s http://localhost:5678/api/v1/workflows/xc3nT8Jtjp9ncpMj/executions
```

### 日志文件

n8n 日志位置（取决于部署方式）:
- Docker: `docker logs n8n`
- 本地: `~/.n8n/logs/`

### 警报设置

配置 n8n 警报（可选）:
1. 打开工作流
2. 点击工作流设置
3. 配置错误发生时的通知（邮件、Webhook 等）

## 版本管理

### 备份工作流

```bash
# 导出工作流
curl -s http://localhost:5678/api/v1/workflows/xc3nT8Jtjp9ncpMj \
  > ping-1-backup-$(date +%Y%m%d).json
```

### 更新工作流

如果需要修改工作流:
1. 在编辑器中进行更改
2. 保存工作流
3. 重新激活（如已禁用）

## 回滚计划

如果部署出现问题：

1. **停止工作流**: 点击 "Deactivate" 按钮
2. **恢复备份**: 删除现有工作流，导入备份版本
3. **清除数据**: 删除相关的执行记录（可选）

```bash
# 删除工作流（谨慎操作）
curl -X DELETE http://localhost:5678/api/v1/workflows/xc3nT8Jtjp9ncpMj
```

## 安全考虑

### Webhook 认证

可选配置 webhook 认证：

1. 编辑 Webhook 节点
2. 启用 "Authentication"
3. 选择认证类型（API Key、OAuth 等）
4. 配置凭据

### 速率限制

考虑配置速率限制防止滥用：

1. 在 Nginx Proxy Manager 中配置
2. 或在 n8n 工作流中添加限流逻辑

## 部署清单

- [ ] n8n 服务运行中
- [ ] Nginx Proxy Manager 已启动
- [ ] 工作流已导入
- [ ] Webhook 已配置
- [ ] 工作流已激活
- [ ] 本地测试通过
- [ ] 公网测试通过
- [ ] 日志监控就位
- [ ] 备份已创建
- [ ] 文档已更新

## 下一步

1. **监控运行**: 持续检查工作流执行日志
2. **性能优化**: 如有需要，优化节点配置
3. **扩展功能**: 添加更多节点实现复杂逻辑
4. **集成其他系统**: 连接到其他应用或服务

## 支持和联系

- **n8n 文档**: https://docs.n8n.io/
- **服务器**: 146.190.52.84
- **监控**: Claude Monitor (http://localhost:3456)
- **问题报告**: 检查执行日志中的错误信息

## 附录

### 完整的 Webhook URL

```
https://146.190.52.84/webhook/ping-1
```

### n8n API 文档

```
http://localhost:5678/api/docs
```

### 工作流 ID 参考

| 字段 | 值 |
|------|-----|
| Workflow ID | xc3nT8Jtjp9ncpMj |
| Workflow Name | ping-1 |
| Node Count | 3 |
| Creation Date | 2025-12-26 |
