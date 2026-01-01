# 定时清理任务 - 部署指南

## 部署状态

✅ **Workflow 已成功创建**

| 项目 | 值 |
|------|-----|
| Workflow ID | `GVzOCR4c1MRpcZkO` |
| 部署方法 | Template-based |
| 节点总数 | 5 个 |
| 创建时间 | 2025-12-26 |

## 部署步骤

### 1. 验证 Workflow 状态

#### 1.1 登录 n8n Cloud
```
访问: http://localhost:5679
账户: 使用已配置的 n8n 账户登录
```

#### 1.2 查找 Workflow
```
导航: Workflows → Scheduled Cleanup
ID: GVzOCR4c1MRpcZkO
```

#### 1.3 检查节点配置

打开 Workflow，验证以下 5 个节点已正确创建：

| 节点序号 | 节点名称 | 节点类型 | 预期配置 |
|---------|---------|---------|---------|
| 1 | Schedule Trigger | Schedule | Cron: `0 3 * * *` |
| 2 | Execute Command | Execute Command | Command: `find /tmp -type f -mtime +7 -delete` |
| 3 | Feishu Notification | HTTP Request | Method: POST, URL: Feishu Webhook |
| 4 | Result Formatter | Code/Format | 格式化清理结果 |
| 5 | Error Handler | Error Handler | 处理执行异常 |

### 2. 配置飞书 Webhook

#### 2.1 获取 Webhook URL

1. 打开飞书应用
2. 找到目标工作群 (例如: "运维通知")
3. 群设置 → 群机器人 → 添加机器人
4. 选择 "自定义机器人"
5. 复制 Webhook URL

#### 2.2 在 Workflow 中配置

1. 打开 Workflow: `GVzOCR4c1MRpcZkO`
2. 编辑节点 "Feishu Notification"
3. 粘贴 Webhook URL 到 "URL" 字段
4. 保存配置

**示例 Webhook URL**:
```
https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxxxxxxxxx
```

### 3. 配置执行环境

#### 3.1 VPS SSH 连接

确保 n8n 能访问 VPS 执行清理命令：

```bash
# 验证 SSH 连接
ssh xx@146.190.52.84

# 验证 /tmp 目录权限
ls -ld /tmp

# 测试清理命令(不删除，仅预览)
find /tmp -type f -mtime +7
```

#### 3.2 验证文件权限

```bash
# 确保 n8n 进程用户可读写 /tmp
stat /tmp | grep "Access:"

# 如需调整权限
chmod 1777 /tmp
```

### 4. 测试部署

#### 4.1 手动执行 Workflow

1. 打开 Workflow: `GVzOCR4c1MRpcZkO`
2. 点击 **"Execute Workflow"** 或 **"Test"** 按钮
3. 观察执行过程

#### 4.2 验证执行结果

检查以下内容：

- ✅ Schedule Trigger: 触发成功
- ✅ Execute Command: 命令执行成功，显示清理结果
- ✅ Feishu Notification: 飞书收到通知消息
- ✅ Error Handler: 如无错误，节点跳过

#### 4.3 飞书消息验证

飞书群应收到格式如下的消息：

```
📋 定时清理任务 - 执行报告

⏰ 执行时间: 2025-12-26 03:00:00
📁 清理目录: /tmp
⏳ 文件年龄: 7+ 天
✂️  删除文件: 42 个
📊 释放空间: 2.3 GB
✅ 执行状态: 成功

更新时间: 2025-12-26 03:05:23
```

### 5. 启用定时执行

#### 5.1 激活 Workflow

1. 打开 Workflow: `GVzOCR4c1MRpcZkO`
2. 点击右上角 **"Active"** 开关
3. 状态变为 🟢 **Active**

#### 5.2 验证激活状态

```
Dashboard → Workflows
搜索: Scheduled Cleanup
状态: Active (绿色)
触发时间: 每天 03:00
```

### 6. 监控和维护

#### 6.1 查看执行历史

```
Workflow 详情页 → Executions
显示最近执行记录
按时间排序
```

#### 6.2 检查执行日志

| 执行状态 | 说明 | 处理方式 |
|---------|------|---------|
| ✅ Success | 执行成功 | 无需操作 |
| ⚠️ Warning | 部分成功 | 检查飞书通知 |
| ❌ Error | 执行失败 | 查看错误日志 |

#### 6.3 飞书通知订阅

1. 打开飞书群
2. 找到定时清理机器人消息
3. 设置通知提醒 → 关键词提醒 "清理任务"

## 配置说明

### Schedule 配置

**Cron 表达式**: `0 3 * * *`

| 字段 | 值 | 说明 |
|------|-----|------|
| 分钟 | 0 | 第 0 分 |
| 小时 | 3 | 凌晨 3 点 |
| 日期 | * | 每天 |
| 月份 | * | 每个月 |
| 星期 | * | 每周 |

**时区**: 默认使用 n8n 服务器时区 (UTC)

如需调整时间：
- 修改小时值，例如: `0 10 * * *` → 10:00 执行
- 修改分钟值，例如: `30 3 * * *` → 3:30 执行

### 清理命令配置

**命令**: `find /tmp -type f -mtime +7 -delete`

参数说明：
- `/tmp`: 清理目录路径
- `-type f`: 仅清理文件 (不清理目录)
- `-mtime +7`: 修改时间超过 7 天
- `-delete`: 删除找到的文件

**安全提示**:
- `-mtime +7` 表示"超过 7 天"，即 8 天及以上
- `-type f` 防止误删目录
- 测试时可去掉 `-delete` 来预览

### 飞书 Webhook 消息体

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
      }
    },
    "elements": [
      {
        "tag": "div",
        "text": {
          "content": "**执行时间**: 2025-12-26 03:00:00\n**清理目录**: /tmp\n**文件年龄**: 7+ 天\n**删除文件**: 42 个\n**释放空间**: 2.3 GB\n**执行状态**: ✅ 成功",
          "tag": "lark_md"
        }
      }
    ]
  }
}
```

## 故障排查

### 问题: Workflow 不执行

**症状**: Schedule Trigger 不触发

**检查清单**:
1. ✅ Workflow 状态: Active
2. ✅ Schedule 配置: Cron 表达式正确
3. ✅ n8n 服务: 正常运行
4. ✅ 时区设置: 确认正确

**解决**:
```bash
# 重启 n8n
docker restart n8n

# 查看日志
docker logs n8n | tail -100

# 手动触发测试
curl -X POST http://localhost:5679/webhook/scheduled-cleanup
```

### 问题: 清理命令执行失败

**症状**: Execute Command 节点报错

**检查清单**:
1. ✅ SSH 连接: 能否连接到 VPS
2. ✅ 文件权限: `/tmp` 可读写
3. ✅ find 命令: 支持 `-mtime` 和 `-delete`

**解决**:
```bash
# 连接 VPS
ssh xx@146.190.52.84

# 测试 find 命令
find /tmp -type f -mtime +7

# 检查文件权限
ls -ld /tmp
stat /tmp

# 手动执行清理(测试)
find /tmp -type f -mtime +7 -print

# 确认后执行删除
find /tmp -type f -mtime +7 -delete
```

### 问题: 飞书未收到通知

**症状**: Feishu Notification 节点失败

**检查清单**:
1. ✅ Webhook URL: 正确且有效
2. ✅ 网络: n8n 能访问飞书 API
3. ✅ 权限: 机器人在群组中

**解决**:
```bash
# 测试 Webhook
curl -X POST \
  https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxx \
  -H "Content-Type: application/json" \
  -d '{"msg_type":"text","content":{"text":"测试消息"}}'

# 检查飞书群设置
1. 打开飞书群
2. 群设置 → 群机器人
3. 验证机器人状态
```

### 问题: 清理结果不符合预期

**症状**: 删除文件数异常

**检查清单**:
1. ✅ -mtime 参数: 理解"超过 7 天"的含义
2. ✅ -type f: 确认只清理文件
3. ✅ 文件访问权限: 某些文件可能无权删除

**解决**:
```bash
# 预览将删除的文件(不实际删除)
find /tmp -type f -mtime +7 -print

# 统计文件数
find /tmp -type f -mtime +7 | wc -l

# 统计占用空间
find /tmp -type f -mtime +7 -exec du -ch {} + | tail -1

# 查看权限限制
find /tmp -type f -mtime +7 ! -perm -200
```

## 日志和监控

### 日志位置

| 日志类型 | 位置 | 查看方式 |
|---------|------|---------|
| n8n 执行日志 | Dashboard → Executions | Web UI |
| VPS 系统日志 | `/var/log/syslog` | SSH 登录查看 |
| 飞书通知记录 | 飞书群聊天记录 | 飞书应用 |

### 监控指标

| 指标 | 目标值 | 告警条件 |
|------|--------|---------|
| 执行成功率 | > 95% | < 90% |
| 平均执行时间 | < 1 分钟 | > 5 分钟 |
| 通知送达率 | 100% | 缺少通知 |
| 清理空间 | > 100 MB/天 | 异常减少 |

### 定期检查

| 检查项 | 频率 | 方式 |
|--------|------|------|
| Workflow 状态 | 周一次 | 登录 n8n 查看 |
| 执行日志 | 日一次 | 查看最近执行 |
| 飞书消息 | 日一次 | 查看群消息 |
| /tmp 空间使用 | 周一次 | `df -h /tmp` |

## 升级和扩展

### 扩展场景 1: 清理其他目录

添加新的 Execute Command 节点：

```bash
find /var/log -type f -mtime +30 -delete
find /home/*/Downloads -type f -mtime +90 -delete
```

### 扩展场景 2: 清理特定文件类型

修改 find 命令：

```bash
# 仅清理 .log 文件
find /tmp -type f -name "*.log" -mtime +7 -delete

# 仅清理 .tmp 文件
find /tmp -type f -name "*.tmp" -mtime +7 -delete
```

### 扩展场景 3: 条件通知

在 Feishu Notification 前添加 IF 节点：

```
IF: 删除文件数 > 1000
  THEN: 发送重要通知 (红色标题)
  ELSE: 发送普通通知
```

### 扩展场景 4: 备份清理日志

添加节点将清理结果保存到文件：

```bash
echo "$(date): 删除 $COUNT 个文件，释放 $SIZE 空间" >> /var/log/cleanup.log
```

## 回滚和禁用

### 临时禁用

```
1. 打开 Workflow
2. 点击 Active 开关关闭 (变灰)
3. Workflow 暂停执行
4. 可随时重新激活
```

### 完全删除

```
1. 打开 Workflow: GVzOCR4c1MRpcZkO
2. 更多选项 → 删除 Workflow
3. 确认删除
```

### 恢复备份

如已保存模板：

```
1. 导入导出 → 导入 Workflow
2. 选择备份文件
3. 恢复到新 Workflow
```

---

**部署版本**: 1.0.0
**最后更新**: 2025-12-26
**技术支持**: Claude Code
