# VPS Health Check Monitor - 部署指南

## 部署概览

| 项目 | 值 |
|------|-----|
| Workflow ID | peDp8QA5AZPPL43l |
| 创建时间 | 2025-12-26 |
| 状态 | ✅ 已部署 |
| 节点数 | 5 |

## 部署步骤

### 1. 前置准备

#### 1.1 SSH 凭证配置
确保 n8n 中已配置 SSH 连接凭证：

```
主机：146.190.52.84
认证方式：密钥或密码
超时时间：30秒
```

**验证连接：**
```bash
ssh -i <key> <user>@146.190.52.84 "echo 'SSH连接正常'"
```

#### 1.2 飞书 Webhook 配置

1. 登录飞书开放平台
2. 创建机器人并获取 Webhook URL
3. 在 n8n 中配置 Feishu 凭证：
   - 选择 Webhook 方式
   - 粘贴 Webhook URL
   - 保存凭证

**测试 Webhook：**
```bash
curl -X POST https://open.feishu.cn/open-apis/bot/v2/hook/xxxx \
  -H "Content-Type: application/json" \
  -d '{"msg_type":"text","content":{"text":"测试消息"}}'
```

### 2. Workflow 配置

#### 2.1 导入 Workflow

1. 在 n8n 控制台打开 Workflows
2. 点击 "Import from file"
3. 选择 `VPS_Health_Check_Monitor.json`
4. 点击 Import

或使用 API：
```bash
curl -X POST http://n8n-instance:5678/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d @VPS_Health_Check_Monitor.json
```

#### 2.2 节点配置详解

##### 节点 1: Schedule Trigger
- **触发规则**：Cron 表达式 `0 * * * *`
- **含义**：每小时的整点时刻触发
- **时区**：UTC（需按实际时区调整）

**调整触发时间示例：**
- 每 30 分钟：`*/30 * * * *`
- 每天凌晨 2 点：`0 2 * * *`
- 每周一上午 9 点：`0 9 * * 1`

##### 节点 2: SSH 执行磁盘检查
- **命令**：`df -h`
- **预期输出**：磁盘使用情况表格
- **凭证**：选择已配置的 SSH 凭证

**备选命令：**
```bash
# 仅显示主要分区
df -h | grep -E '(/$|/home|/var)'

# JSON 格式输出
df -h --output=source,target,size,used,avail,pcent
```

##### 节点 3: Code - 解析磁盘数据
处理逻辑：
1. 解析 SSH 输出
2. 提取分区信息（名称、总容量、已用、可用、使用率）
3. 识别使用率超过 80% 的分区

**输出数据结构：**
```json
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
```

##### 节点 4: IF 条件判断
- **条件**：任意分区使用率 ≥ 80%
- **真分支**：执行告警（Feishu）
- **假分支**：流程结束

##### 节点 5: Feishu 告警
消息类型：富文本（Rich Text）

**告警消息格式：**
```
⚠️ VPS 磁盘空间告警

主机：146.190.52.84
分区：/dev/sda1 (/)
总容量：50GB
已用：40GB
可用：10GB
使用率：80%

请及时清理或扩容！
```

#### 2.3 Error Trigger 配置
- **触发条件**：任何节点执行失败
- **处理方式**：发送飞书通知，包含错误信息

**错误告警格式：**
```
❌ VPS 监控异常

错误类型：SSH 连接失败
时间：2025-12-26 10:00:00 UTC
详情：连接超时

请检查：
- SSH 凭证是否有效
- VPS 是否在线
- 网络连接是否正常
```

### 3. 激活与测试

#### 3.1 激活 Workflow
1. 打开 Workflow 编辑页面
2. 点击右上角的 "Active" 开关
3. 确认启用

#### 3.2 手动测试
1. 点击 "Execute Workflow" 手动执行
2. 查看执行日志
3. 验证每个节点的输出

**预期结果：**
- SSH 节点：返回磁盘使用情况
- Code 节点：解析成结构化数据
- IF 节点：判断是否需要告警
- 若使用率 > 80%：Feishu 收到告警消息

#### 3.3 通知验证
- 检查飞书频道是否收到测试告警
- 验证告警信息内容完整准确

### 4. 监控与维护

#### 4.1 告警阈值调整
若需修改 80% 的告警阈值：

1. 编辑 Code 节点
2. 修改检查条件：`percent >= 新阈值`
3. 保存并重新激活

#### 4.2 日志检查
```bash
# 在 n8n 中查看执行历史
- 导航到 Workflow 详情页
- 查看 "Executions" 标签
- 分析失败的执行
```

#### 4.3 性能优化
- **增加检查频率**：修改 Cron 表达式
- **减少告警频率**：添加去重逻辑，避免重复告警
- **扩展监控项**：添加内存、CPU、服务状态检查

### 5. 故障排查

| 问题 | 原因 | 解决方案 |
|------|------|--------|
| SSH 连接失败 | 凭证错误或 VPS 离线 | 验证凭证，检查 VPS 网络 |
| Feishu 未收到消息 | Webhook URL 无效 | 重新配置 Feishu Webhook |
| Cron 不触发 | 时区设置错误 | 检查 n8n 系统时区配置 |
| 消息格式错误 | Code 节点解析异常 | 查看日志，调整解析逻辑 |

## 备份与恢复

### 备份 Workflow
```bash
# 导出当前 Workflow
curl http://n8n-instance:5678/api/v1/workflows/peDp8QA5AZPPL43l \
  > VPS_Health_Check_Monitor_backup.json
```

### 恢复 Workflow
```bash
# 导入备份
curl -X POST http://n8n-instance:5678/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d @VPS_Health_Check_Monitor_backup.json
```

## 扩展建议

1. **多主机监控**：添加循环节点，监控多个 VPS
2. **历史统计**：集成数据库存储历史数据
3. **告警升级**：根据使用率级别发送不同等级告警
4. **自动清理**：超过阈值时自动触发清理脚本
5. **Slack/钉钉集成**：支持多个通知渠道

## 联系与支持

- n8n 文档：https://docs.n8n.io
- 飞书 API：https://open.feishu.cn/document
- 故障排查：查看 n8n 日志目录 `/logs`
