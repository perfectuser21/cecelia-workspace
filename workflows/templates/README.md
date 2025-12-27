# n8n Workflow 模板库

## 概述
本目录包含常用的 n8n workflow 模板，用于快速创建标准化的工作流。每个模板包含完整的 workflow 定义和使用说明。

## 模板文件结构

```
templates/
├── index.json              # 模板索引和元数据
├── README.md               # 本文件
├── webhook-response/       # Webhook 响应模板
│   ├── template.json
│   └── README.md
├── scheduled-task/         # 定时任务模板
│   ├── template.json
│   └── README.md
└── ...                     # 其他模板
```

## 可用模板

### 集成类

#### 1. webhook-response
**描述**: 接收 webhook 并返回响应的标准流程
**节点**: Webhook → Code → Respond to Webhook
**复杂度**: ⭐ (简单)
**适用场景**:
- API 端点
- 外部系统回调
- 数据接收

#### 2. api-integration
**描述**: 调用外部 API 并处理响应
**节点**: Trigger → HTTP Request → Code → Error Handler
**复杂度**: ⭐⭐ (中等)
**适用场景**:
- 数据同步
- 第三方服务集成
- API 调用

#### 3. ssh-execution
**描述**: 通过 SSH 在远程服务器执行命令
**节点**: Trigger → SSH → Code → Error Handler
**复杂度**: ⭐⭐⭐ (复杂)
**适用场景**:
- 远程脚本执行
- 服务器管理
- 部署自动化

---

### 自动化类

#### 4. scheduled-task
**描述**: 按计划执行的任务（支持 Cron 表达式）
**节点**: Schedule Trigger → Code → HTTP Request
**复杂度**: ⭐⭐ (中等)
**适用场景**:
- 定时备份
- 定时检查
- 日常维护

#### 5. data-processing
**描述**: 获取数据、转换、存储的完整流程
**节点**: Trigger → HTTP Request → Code → Postgres → Error Handler
**复杂度**: ⭐⭐⭐ (复杂)
**适用场景**:
- 数据同步
- ETL 流程
- 数据清洗

---

### 通知类

#### 6. notification
**描述**: 发送飞书/钉钉/Slack 通知
**节点**: Trigger → Code → HTTP Request (飞书)
**复杂度**: ⭐ (简单)
**适用场景**:
- 告警通知
- 状态推送
- 审批提醒

---

### 设计模式类

#### 7. error-handling
**描述**: 带重试和错误通知的健壮流程
**节点**: Trigger → Try → Catch → Code → Notification
**复杂度**: ⭐⭐ (中等)
**适用场景**:
- 需要容错的流程
- 关键业务流程
- 外部依赖调用

#### 8. parallel-execution
**描述**: 使用 SplitInBatches 并行处理多个任务
**节点**: Trigger → SplitInBatches → Code → Merge
**复杂度**: ⭐⭐⭐ (复杂)
**适用场景**:
- 批量处理
- 并发任务
- 性能优化

#### 9. sub-workflow
**描述**: 调用其他 workflow 实现模块化
**节点**: Trigger → Execute Workflow → Code
**复杂度**: ⭐⭐ (中等)
**适用场景**:
- 流程编排
- 模块化设计
- 复用逻辑

---

## 使用方式

### 1. 通过 AI 工厂使用（推荐）

```bash
# 基于模板创建 workflow
curl -X POST "https://zenithjoy21xx.app.n8n.cloud/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{
    "prd": "创建一个接收数据的 API",
    "template": "webhook-response"
  }'
```

AI 工厂会：
1. 加载指定模板的节点结构
2. 根据 PRD 调整节点参数
3. 创建并激活 workflow
4. 返回 workflow ID 和 webhook URL

### 2. 通过命令行使用

```bash
# 使用模板创建 workflow
/home/xx/bin/workflow-factory.sh \
  --run-id "$(date +%s)" \
  --prd "创建一个定时任务" \
  --template "scheduled-task"
```

### 3. 手动使用

```bash
# 查看所有模板
cat /home/xx/dev/zenithjoy-autopilot/workflows/templates/index.json

# 查看特定模板
cat /home/xx/dev/zenithjoy-autopilot/workflows/templates/webhook-response/template.json

# 在 n8n 中导入
# 1. 复制 template.json 内容
# 2. 在 n8n UI 中选择 "Import from JSON"
# 3. 粘贴并调整参数
```

## 模板变量

模板中使用以下占位符，在创建 workflow 时会自动替换：

- `{{WEBHOOK_ID}}` - 自动生成的 webhook ID
- `{{SSH_CREDENTIAL_ID}}` - SSH 凭据 ID (vvJsQOZ95sqzemla)
- `{{POSTGRES_CREDENTIAL_ID}}` - PostgreSQL 凭据 ID
- `{{FEISHU_BOT_WEBHOOK}}` - 飞书 Webhook URL (环境变量)

## 添加新模板

### 步骤

1. 创建模板目录
```bash
mkdir -p /home/xx/dev/zenithjoy-autopilot/workflows/templates/your-template-name
```

2. 创建 `template.json`（完整的 n8n workflow 定义）

3. 创建 `README.md`（使用说明和示例）

4. 在 `index.json` 中注册模板
```json
{
  "id": "your-template-name",
  "name": "模板名称",
  "description": "模板描述",
  "tags": ["tag1", "tag2"],
  "category": "integration|automation|notification|data|pattern",
  "nodes": ["节点1", "节点2"],
  "complexity": 1-3,
  "use_cases": ["用例1", "用例2"]
}
```

### 模板规范

- 使用清晰的节点命名（中文）
- 添加详细的代码注释
- 提供默认的错误处理
- 包含 console.log 日志输出
- 使用占位符代替硬编码的 ID
- 设置 `active: false`（由用户或 AI 工厂激活）

## 快速参考

### 按场景选择模板

| 需求 | 推荐模板 |
|------|----------|
| 创建 API 端点 | webhook-response |
| 调用外部 API | api-integration |
| 定时执行任务 | scheduled-task |
| 远程执行脚本 | ssh-execution |
| 数据同步 | data-processing |
| 发送通知 | notification |
| 需要容错 | error-handling |
| 批量处理 | parallel-execution |
| 模块化设计 | sub-workflow |

### 按复杂度选择模板

- **⭐ 简单**: webhook-response, notification
- **⭐⭐ 中等**: scheduled-task, api-integration, error-handling, sub-workflow
- **⭐⭐⭐ 复杂**: ssh-execution, data-processing, parallel-execution

## 维护日志

- 2025-12-25: 重构模板库，添加完整的 workflow 定义（9个模板）
- 2025-12-24: 创建初始模板库（5个基础模板）
