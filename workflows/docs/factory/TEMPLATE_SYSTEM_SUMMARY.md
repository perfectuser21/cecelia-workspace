# n8n 模板库系统 - 部署总结

## 创建时间
2025-12-25

## 概述
在 `/home/xx/dev/zenithjoy-autopilot/workflows/templates/` 创建了完整的 n8n workflow 模板库系统，包含 9 个常用模板和完整的文档。

## 目录结构

```
templates/
├── index.json                    # 模板索引和元数据
├── README.md                     # 详细文档
├── QUICK_REFERENCE.md            # 快速参考指南
├── EXAMPLES.md                   # 使用示例（已存在）
├── templates.json                # 旧版模板定义（保留）
├── test-templates.sh             # 测试脚本
│
├── webhook-response/             # Webhook 响应模板
│   ├── template.json             # 完整的 n8n workflow 定义
│   └── README.md                 # 使用说明
│
├── scheduled-task/               # 定时任务模板
│   └── template.json
│
├── api-integration/              # API 集成模板
│   └── template.json
│
├── notification/                 # 飞书通知模板
│   └── template.json
│
├── ssh-execution/                # SSH 执行模板
│   └── template.json
│
├── data-processing/              # 数据处理流水线模板
│   └── template.json
│
├── error-handling/               # 错误处理模板
│   └── template.json
│
├── parallel-execution/           # 并行执行模板
│   └── template.json
│
└── sub-workflow/                 # 子 Workflow 调用模板
    └── template.json
```

## 9 个模板

### 集成类
1. **webhook-response** - Webhook 响应（3 节点）
2. **api-integration** - API 集成（5 节点）
3. **ssh-execution** - SSH 执行（5 节点）

### 自动化类
4. **scheduled-task** - 定时任务（3 节点）
5. **data-processing** - 数据处理流水线（6 节点）

### 通知类
6. **notification** - 飞书通知（4 节点）

### 设计模式类
7. **error-handling** - 错误处理（7 节点）
8. **parallel-execution** - 并行执行（6 节点）
9. **sub-workflow** - 子 Workflow 调用（5 节点）

## 模板特性

### 完整的 workflow 定义
每个 `template.json` 包含：
- nodes（节点定义）
- connections（节点连接）
- settings（workflow 设置）
- 详细的代码注释

### 占位符变量
- `{{WEBHOOK_ID}}` - 自动生成的 webhook ID
- `{{SSH_CREDENTIAL_ID}}` - SSH 凭据 ID
- `{{POSTGRES_CREDENTIAL_ID}}` - PostgreSQL 凭据 ID
- `{{FEISHU_BOT_WEBHOOK}}` - 飞书 Webhook（环境变量）

### 最佳实践
- 错误处理
- 重试逻辑
- 日志输出
- 数据验证

## 使用方式

### 1. 通过 AI 工厂（推荐）

```bash
curl -X POST "http://localhost:5679/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{
    "prd": "创建一个接收数据的 API",
    "template": "webhook-response"
  }'
```

### 2. 通过命令行

```bash
/home/xx/bin/workflow-factory.sh \
  --run-id "$(date +%s)" \
  --prd "创建定时任务" \
  --template "scheduled-task"
```

### 3. 手动导入

```bash
# 查看模板
cat /home/xx/dev/zenithjoy-autopilot/workflows/templates/webhook-response/template.json

# 在 n8n UI 中导入
```

## workflow-factory.sh 更新

添加了 `--template` 参数支持：

```bash
# 新增参数
TEMPLATE=""

# 解析参数
--template) TEMPLATE="$2"; shift 2 ;;

# init_run() 中加载模板
if [[ -n "$TEMPLATE" ]]; then
  log "加载模板: $TEMPLATE"
  cp "$WORKFLOW_DIR/templates/$TEMPLATE/template.json" "$STATE_DIR/template.json"
  # 保存模板元数据
  jq ".templates[] | select(.id == \"$TEMPLATE\")" \
    "$WORKFLOW_DIR/templates/index.json" > "$STATE_DIR/template_meta.json"
fi
```

## 测试结果

运行 `test-templates.sh`:

```
✓ 9/9 目录结构正确
✓ 9/9 模板在 index.json 中注册
✓ 9/9 template.json 文件有效
✓ 1/9 README.md 文件存在（webhook-response）
✓ 所有模板使用了占位符变量
```

## 文档

- **总览**: `templates/README.md` - 详细的模板说明
- **快速参考**: `templates/QUICK_REFERENCE.md` - 快速选择和使用
- **示例**: `templates/EXAMPLES.md` - 使用示例（已存在）
- **单个模板**: `templates/{template-name}/README.md`

## 后续优化（可选）

1. 为其他 8 个模板创建 README.md
2. 在 AI 工厂 workflow 中集成模板加载逻辑
3. 创建模板可视化工具
4. 添加更多专用模板（如：飞书审批、企业微信通知等）

## 文件清单

### 新建文件
- `templates/index.json`
- `templates/QUICK_REFERENCE.md`
- `templates/test-templates.sh`
- `templates/webhook-response/template.json`
- `templates/webhook-response/README.md`
- `templates/scheduled-task/template.json`
- `templates/api-integration/template.json`
- `templates/notification/template.json`
- `templates/ssh-execution/template.json`
- `templates/data-processing/template.json`
- `templates/error-handling/template.json`
- `templates/parallel-execution/template.json`
- `templates/sub-workflow/template.json`

### 修改文件
- `templates/README.md` - 重写为详细文档
- `/home/xx/bin/workflow-factory.sh` - 添加 `--template` 参数

## 快速开始

```bash
# 测试模板系统
/home/xx/dev/zenithjoy-autopilot/workflows/templates/test-templates.sh

# 查看模板列表
cat /home/xx/dev/zenithjoy-autopilot/workflows/templates/index.json | jq '.templates[].id'

# 查看快速参考
cat /home/xx/dev/zenithjoy-autopilot/workflows/templates/QUICK_REFERENCE.md

# 使用模板创建 workflow
curl -X POST "http://localhost:5679/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{"prd": "创建 API", "template": "webhook-response"}'
```

## 维护

- 添加新模板: 复制现有模板目录，修改 `template.json`，在 `index.json` 注册
- 更新模板: 直接修改对应的 `template.json` 文件
- 测试: 运行 `test-templates.sh` 验证

## 成果

✅ 9 个完整的 n8n workflow 模板
✅ 完整的索引和元数据系统
✅ 详细的使用文档
✅ 集成到 workflow-factory.sh
✅ 自动化测试脚本
✅ 快速参考指南
