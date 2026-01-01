# Workflow Factory - 回滚功能快速参考

## 一键回滚

```bash
# 回滚到指定版本
curl -X POST "http://localhost:5679/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{"rollback_run_id": "YOUR_RUN_ID"}'
```

## 查看可用版本

```bash
# SSH 到服务器
ssh xx@146.190.52.84

# 查看最近 10 个成功版本
ls -lt /home/xx/data/runs/*/final/manifest.json | head -10

# 查看某个版本包含的 workflows
cat /home/xx/data/runs/20251224030000-abc123/final/manifest.json | jq -r '.workflows[].name'

# 查看版本执行时间和状态
cat /home/xx/data/runs/20251224030000-abc123/state.json | jq '{status, started_at, completed_at}'
```

## Webhook 参数对比

| 参数 | 用途 | 示例 |
|------|------|------|
| `prd` | 创建/修改 workflow | `"添加重试逻辑"` |
| `target_workflow` | 指定要修改的 workflow | `"wqeeHpnTcJolnse4"` |
| `resume_run_id` | 从断点续跑 | `"20251224030000-abc123"` |
| `rollback_run_id` | 回滚到历史版本 | `"20251224030000-abc123"` |

## 返回值

### 成功
```json
{
  "status": "success",
  "message": "成功回滚到版本 20251224030000-abc123",
  "rollback_from": "20251224030000-abc123",
  "workflows_count": 3,
  "manifest": {...}
}
```

### 失败
```json
{
  "status": "error",
  "message": "目标版本不存在或没有final产出"
}
```

## 常见场景

### 场景 1: 修改出错，需要回滚

```bash
# 1. 查看最近的成功版本
ssh xx@146.190.52.84 "ls -lt /home/xx/data/runs/*/final/manifest.json | head -3"

# 2. 选择一个版本（假设是倒数第二个）
RUN_ID="20251224020000-xyz789"

# 3. 执行回滚
curl -X POST "http://localhost:5679/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d "{\"rollback_run_id\": \"$RUN_ID\"}"
```

### 场景 2: 对比版本差异

```bash
# 查看两个版本的差异
ssh xx@146.190.52.84 << 'EOF'
diff <(cat /home/xx/data/runs/20251224020000-xyz789/final/manifest.json | jq -S .) \
     <(cat /home/xx/data/runs/20251224030000-abc123/final/manifest.json | jq -S .)
EOF
```

### 场景 3: 回滚后重新修改

```bash
# 1. 先回滚
curl -X POST "http://localhost:5679/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{"rollback_run_id": "20251224020000-xyz789"}'

# 2. 然后重新提交修改（会创建新的 run_id）
curl -X POST "http://localhost:5679/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{
    "prd": "修复之前的问题，添加正确的重试逻辑",
    "target_workflow": "wqeeHpnTcJolnse4"
  }'
```

## 故障排查

### 问题: "目标版本不存在或没有final产出"

**可能原因**:
1. `run_id` 拼写错误
2. 该版本执行失败，没有生成 `final/` 目录
3. `final/` 目录被手动删除

**解决方法**:
```bash
# 检查该 run 是否存在
ssh xx@146.190.52.84 "ls -la /home/xx/data/runs/YOUR_RUN_ID"

# 检查是否有 final 目录
ssh xx@146.190.52.84 "ls -la /home/xx/data/runs/YOUR_RUN_ID/final"

# 查看执行状态
ssh xx@146.190.52.84 "cat /home/xx/data/runs/YOUR_RUN_ID/state.json"
```

### 问题: 回滚成功但 workflow 没有变化

**可能原因**:
1. n8n Cloud API 认证失败
2. workflow ID 不存在

**解决方法**:
```bash
# 检查 API Key 是否有效
ssh xx@146.190.52.84 "source /home/xx/dev/zenithjoy-autopilot/workflows/.secrets && \
  curl -H \"X-N8N-API-KEY: \$N8N_REST_API_KEY\" \
  http://localhost:5679/api/v1/workflows | jq '.data | length'"

# 检查具体 workflow
ssh xx@146.190.52.84 "source /home/xx/dev/zenithjoy-autopilot/workflows/.secrets && \
  curl -H \"X-N8N-API-KEY: \$N8N_REST_API_KEY\" \
  http://localhost:5679/api/v1/workflows/WORKFLOW_ID | jq '.name'"
```

## 注意事项

1. 回滚是**不可逆操作**，执行前请确认
2. 回滚会**覆盖当前版本**，如需保留请先备份
3. 建议在**非高峰时段**执行回滚
4. 回滚后需要**重新激活** workflow（如果之前是激活状态）

## 备份当前版本

在回滚前手动备份：

```bash
ssh xx@146.190.52.84 << 'EOF'
BACKUP_DIR="/home/xx/data/manual-backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR

source /home/xx/dev/zenithjoy-autopilot/workflows/.secrets

# 导出所有 workflows
curl -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
  http://localhost:5679/api/v1/workflows \
  > $BACKUP_DIR/all-workflows.json

echo "备份已保存到: $BACKUP_DIR"
EOF
```

## 工作流程图

```
用户请求回滚
    ↓
接收PRD webhook (带 rollback_run_id)
    ↓
初始化Run (设置 is_rollback=true)
    ↓
IF - 是否回滚? (检查 is_rollback)
    ↓ [True]
SSH - 执行回滚
    ├─ 检查 final/ 目录是否存在
    ├─ 读取 manifest.json
    ├─ 遍历所有 workflow JSON
    └─ 使用 PUT API 覆盖每个 workflow
    ↓
Code - 回滚结果 (解析输出)
    ↓
返回结果给用户
```

## 相关文件

- 详细文档: `/home/xx/dev/zenithjoy-autopilot/workflows/ROLLBACK_FEATURE.md`
- Workflow JSON: `/home/xx/dev/zenithjoy-autopilot/workflows/workflow-factory-final.json`
- 状态目录: `/home/xx/data/runs/{run_id}/`
- API Keys: `/home/xx/dev/zenithjoy-autopilot/workflows/.secrets`
