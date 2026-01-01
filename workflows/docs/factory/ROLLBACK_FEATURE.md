# Workflow Factory - 版本回滚功能

## 概述

为 AI工厂-Workflow生产线 添加了版本回滚功能，允许在修改出现问题时快速恢复到之前的成功版本。

## 新增节点

### 1. IF - 是否回滚 (if-is-rollback)
- **位置**: [560, 100]
- **功能**: 检查请求中是否包含 `rollback_run_id` 参数
- **逻辑**:
  - True → 进入回滚流程
  - False → 继续正常流程（续跑或新建）

### 2. SSH - 执行回滚 (ssh-execute-rollback)
- **位置**: [720, 40]
- **功能**: 执行实际的回滚操作
- **工作流程**:
  1. 检查目标版本是否存在 (`/home/xx/data/runs/{rollback_run_id}/final/`)
  2. 读取 `manifest.json` 获取 workflow 清单
  3. 遍历所有 workflow JSON 文件
  4. 使用 n8n REST API PUT 请求覆盖当前版本
  5. 返回回滚结果统计

### 3. Code - 回滚结果 (code-rollback-result)
- **位置**: [900, 40]
- **功能**: 解析 SSH 输出，格式化回滚结果
- **输出格式**:
  ```json
  {
    "status": "success",
    "message": "成功回滚到版本 {run_id}",
    "rollback_from": "{run_id}",
    "workflows_count": 3,
    "manifest": {...},
    "timestamp": "2025-12-24T05:30:00.000Z"
  }
  ```

## 修改节点

### 初始化Run (code-init-run)
添加了 `rollback_run_id` 参数支持：

```javascript
const rollbackRunId = inputData.rollback_run_id || inputData.body?.rollback_run_id || null;

return [{
  json: {
    // ... 其他字段
    is_rollback: rollbackRunId ? true : false,
    rollback_run_id: rollbackRunId
  }
}];
```

## 执行流程

```
接收PRD → 初始化Run → IF - 是否回滚
                         ├─[True]→ SSH - 执行回滚 → Code - 回滚结果 → 返回结果
                         └─[False]→ IF - 是否续跑 → ...
```

## 使用方式

### 回滚到历史版本

```bash
curl -X POST "http://localhost:5679/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{
    "rollback_run_id": "20251224030000-abc123"
  }'
```

### 查看可用版本

```bash
# 查看所有成功的 run
ls -lt /home/xx/data/runs/*/final/manifest.json

# 查看某个版本的详情
cat /home/xx/data/runs/20251224030000-abc123/final/manifest.json | jq
```

### 返回示例

**成功回滚**:
```json
{
  "status": "success",
  "message": "成功回滚到版本 20251224030000-abc123",
  "rollback_from": "20251224030000-abc123",
  "workflows_count": 3,
  "manifest": {
    "workflows": [
      {"id": "wqeeHpnTcJolnse4", "name": "夜间健康检查"},
      {"id": "70DVZ55roILCGAMM", "name": "夜间备份"},
      {"id": "wOg5NRZ2yx0D18nY", "name": "夜间清理"}
    ]
  },
  "timestamp": "2025-12-24T05:30:00.000Z"
}
```

**失败情况**:
```json
{
  "status": "error",
  "message": "目标版本不存在或没有final产出",
  "rollback_run_id": "20251224030000-abc123"
}
```

## 前提条件

1. 目标 `run_id` 必须有 `final/` 目录（即成功完成的执行）
2. `final/manifest.json` 必须存在
3. `.secrets` 文件包含有效的 `N8N_REST_API_KEY`
4. VPS 可访问 n8n Cloud API

## 注意事项

1. **回滚会直接覆盖当前的 workflow**，建议先备份或确认无误后操作
2. 回滚不会创建新的 run_id，只是恢复到历史状态
3. 回滚操作本身会被记录到 n8n 执行历史中
4. 如果回滚后仍需修改，可以正常调用工厂创建新版本
5. 回滚操作不会修改目标版本的 `final/` 目录，可以重复回滚到同一版本

## 技术细节

### SSH 脚本关键逻辑

```bash
# 检查目标版本
if [ ! -d "$STATE_DIR/final" ]; then
  echo '{"status": "error", "message": "目标版本不存在或没有final产出"}'
  exit 1
fi

# 读取 manifest
MANIFEST=$(cat "$STATE_DIR/final/manifest.json")

# 批量回滚
for workflow_file in $STATE_DIR/final/*.json; do
  if [ "$(basename $workflow_file)" != "manifest.json" ]; then
    workflow_id=$(basename $workflow_file .json)

    # PUT 请求覆盖 workflow
    curl -s -X PUT -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
      -H "Content-Type: application/json" \
      -d @"$workflow_file" \
      "http://localhost:5679/api/v1/workflows/$workflow_id"
  fi
done
```

### 节点位置设计

- 回滚节点位于 Y=40-100 区间（高于主流程）
- "IF - 是否续跑" 位于 Y=200（主流程）
- 确保视觉上清晰区分回滚流程和正常流程

## 未来增强

可能的改进方向：

1. **回滚前备份**: 在回滚前自动备份当前版本
2. **差异预览**: 显示目标版本与当前版本的差异
3. **部分回滚**: 支持只回滚特定的 workflow
4. **回滚历史**: 记录所有回滚操作的历史
5. **版本标签**: 为重要版本添加标签，方便快速回滚

## 测试建议

### 基础测试

```bash
# 1. 查看可用版本
ssh xx@146.190.52.84 "ls -lt /home/xx/data/runs/*/final/manifest.json | head -5"

# 2. 选择一个版本进行回滚测试
RUN_ID="20251224030000-abc123"

# 3. 执行回滚
curl -X POST "http://localhost:5679/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d "{\"rollback_run_id\": \"$RUN_ID\"}"

# 4. 验证 workflow 是否已恢复
# 登录 n8n Cloud 查看 workflow 内容
```

### 错误场景测试

```bash
# 测试不存在的 run_id
curl -X POST "http://localhost:5679/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{"rollback_run_id": "nonexistent-run-id"}'
# 预期: {"status": "error", "message": "目标版本不存在或没有final产出"}

# 测试没有 final 目录的 run_id
# (可以手动删除某个 run 的 final 目录进行测试)
```

## 统计信息

- **新增节点数**: 3
- **修改节点数**: 1
- **新增连接数**: 4
- **代码行数**: ~150 行 (Bash + JavaScript)
- **测试覆盖**: 待完成

## 更新日志

- **2025-12-24**: 初始版本，支持基本回滚功能
