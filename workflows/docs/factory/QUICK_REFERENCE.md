# 断点续跑快速参考

## 一句话说明
允许失败或中断的 workflow 从上次停止的位置继续执行，而不是从头开始。

## 快速使用

### 正常启动
```bash
curl -X POST "https://zenithjoy21xx.app.n8n.cloud/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{"prd": "你的需求描述"}'
```

### 断点续跑
```bash
curl -X POST "https://zenithjoy21xx.app.n8n.cloud/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{"resume_run_id": "失败的run_id"}'
```

## 新增的 4 个节点

| 节点名 | ID | 作用 |
|--------|-----|------|
| IF - 是否续跑 | `if-is-resume` | 检查是否续跑 |
| SSH - 加载断点状态 | `ssh-load-checkpoint` | 读取 state.json |
| Code - 解析断点状态 | `code-parse-checkpoint` | 解析待执行任务 |
| SSH 保存 Waves | `ssh-save-waves` | 保存波次信息 |

## 修改的 3 个节点

| 节点名 | 修改内容 |
|--------|----------|
| 初始化Run | 支持 `resume_run_id` 参数 |
| Code - 拓扑排序 | 生成并传递 wave 数据 |
| SSH Claude B - 执行任务 | 追踪 wave 进度和任务状态 |

## 核心文件

| 文件 | 内容 |
|------|------|
| `state.json` | 整体状态 (current_wave, last_completed_wave) |
| `waves.json` | 波次信息 (新增) |
| `tasks/{task_id}.json` | 任务状态 (completed/pending/failed) |

## 常见问题

**Q: 如何查看某个 run 的状态?**
```bash
ssh xx@146.190.52.84 'cat /home/xx/data/runs/{run_id}/state.json'
```

**Q: 如何手动标记任务为 pending?**
```bash
ssh xx@146.190.52.84 'echo "{\"task_id\": \"task_3\", \"status\": \"pending\"}" > /home/xx/data/runs/{run_id}/tasks/task_3.json'
```

**Q: 如何查看所有未完成的任务?**
```bash
ssh xx@146.190.52.84 'find /home/xx/data/runs/{run_id}/tasks -name "*.json" -exec sh -c "jq -r \"select(.status != \\\"completed\\\") | .task_id\" \"\$1\"" _ {} \;'
```

## 文档索引

- **详细使用说明**: [CHECKPOINT_RESUME_USAGE.md](./CHECKPOINT_RESUME_USAGE.md)
- **流程图**: [CHECKPOINT_FLOW_DIAGRAM.md](./CHECKPOINT_FLOW_DIAGRAM.md)
- **完成总结**: [CHECKPOINT_SUMMARY.md](./CHECKPOINT_SUMMARY.md)
- **快速参考**: 本文档

## 示例场景

```bash
# 1. 正常启动
curl ... -d '{"prd": "创建复杂 workflow"}'
# 返回: run_id = "20251224143000-x9k2p1"
# 执行到一半失败...

# 2. 查看状态
ssh xx@146.190.52.84 'cat /home/xx/data/runs/20251224143000-x9k2p1/state.json'
# {"current_wave": 2, "last_completed_wave": 1, ...}

# 3. 续跑
curl ... -d '{"resume_run_id": "20251224143000-x9k2p1"}'
# 只执行未完成的任务
```
