# 模板库快速参考

## 快速选择

```bash
# 我要创建什么？                     使用什么模板？
# ----------------------------------------
API 端点                          → webhook-response
调用外部 API                       → api-integration
定时任务                          → scheduled-task
远程执行脚本                       → ssh-execution
数据同步/ETL                      → data-processing
发送通知                          → notification
需要容错/重试                      → error-handling
批量处理/并行                      → parallel-execution
模块化/复用                        → sub-workflow
```

## 使用示例

### 1. 通过 AI 工厂（推荐）

```bash
# 创建 API 端点
curl -X POST "https://zenithjoy21xx.app.n8n.cloud/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{
    "prd": "创建一个接收用户注册数据的 API",
    "template": "webhook-response"
  }'

# 创建定时任务
curl -X POST "https://zenithjoy21xx.app.n8n.cloud/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{
    "prd": "每天凌晨 2 点备份数据库",
    "template": "scheduled-task"
  }'

# 创建数据同步任务
curl -X POST "https://zenithjoy21xx.app.n8n.cloud/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{
    "prd": "每 6 小时同步外部 API 数据到 PostgreSQL",
    "template": "data-processing"
  }'
```

### 2. 通过命令行

```bash
# 使用模板创建
/home/xx/bin/workflow-factory.sh \
  --run-id "$(date +%s)" \
  --prd "创建定时健康检查" \
  --template "scheduled-task"

# 不使用模板（AI 自动设计）
/home/xx/bin/workflow-factory.sh \
  --run-id "$(date +%s)" \
  --prd "创建自定义流程"
```

### 3. 手动导入

```bash
# 1. 查看模板
cat /home/xx/dev/zenithjoy-autopilot/workflows/templates/webhook-response/template.json

# 2. 复制内容到剪贴板

# 3. 在 n8n UI 中:
#    - 点击 "Add workflow"
#    - 点击右上角三个点
#    - 选择 "Import from JSON"
#    - 粘贴并保存
```

## 模板对比

| 模板 | 复杂度 | 节点数 | 适合场景 | 关键特性 |
|------|--------|--------|----------|----------|
| webhook-response | ⭐ | 3 | API 端点 | 简单、快速 |
| api-integration | ⭐⭐ | 4 | API 调用 | 错误处理 |
| scheduled-task | ⭐⭐ | 3 | 定时任务 | Cron 支持 |
| ssh-execution | ⭐⭐⭐ | 5 | 远程执行 | SSH 凭据 |
| data-processing | ⭐⭐⭐ | 6 | 数据同步 | ETL 流水线 |
| notification | ⭐ | 4 | 通知推送 | 飞书卡片 |
| error-handling | ⭐⭐ | 7 | 容错流程 | 重试+告警 |
| parallel-execution | ⭐⭐⭐ | 6 | 批量处理 | 并行优化 |
| sub-workflow | ⭐⭐ | 5 | 模块化 | 流程编排 |

## 模板变量

所有模板都支持以下占位符：

```bash
{{WEBHOOK_ID}}             # 自动生成的 webhook ID
{{SSH_CREDENTIAL_ID}}      # SSH 凭据: vvJsQOZ95sqzemla
{{POSTGRES_CREDENTIAL_ID}} # PostgreSQL 凭据 ID
{{FEISHU_BOT_WEBHOOK}}     # 飞书 Webhook（环境变量）
```

## 常见问题

### Q: 可以组合多个模板吗？
A: 可以。在 PRD 中描述需求，AI 工厂会自动组合多个模板的设计模式。

### Q: 模板会自动激活吗？
A: 不会。模板默认 `active: false`，需要手动激活或在 PRD 中说明"激活 workflow"。

### Q: 如何自定义模板？
A:
1. 复制现有模板目录
2. 修改 `template.json`
3. 更新 `README.md`
4. 在 `index.json` 中注册

### Q: 模板支持什么触发器？
A:
- webhook-response: Webhook
- scheduled-task: Schedule Trigger
- data-processing: Schedule Trigger
- 其他: 都支持 Webhook 触发

### Q: 模板包含错误处理吗？
A:
- error-handling 模板有完整的错误处理
- api-integration、ssh-execution 有基础错误处理
- 其他模板需要根据需求添加

## 模板目录结构

```
templates/
├── index.json                    # 模板索引
├── README.md                     # 详细文档
├── QUICK_REFERENCE.md            # 本文件
│
├── webhook-response/             # Webhook 响应
│   ├── template.json             # workflow 定义
│   └── README.md                 # 使用说明
│
├── scheduled-task/               # 定时任务
│   ├── template.json
│   └── README.md
│
└── ...                           # 其他模板
```

## 下一步

- 查看详细文档: `/home/xx/dev/zenithjoy-autopilot/workflows/templates/README.md`
- 查看示例: `/home/xx/dev/zenithjoy-autopilot/workflows/templates/EXAMPLES.md`
- 查看具体模板: `/home/xx/dev/zenithjoy-autopilot/workflows/templates/{template-name}/README.md`
