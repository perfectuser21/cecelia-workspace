# 断点续跑功能使用说明

## 功能概述

为 `workflow-factory-final.json` 添加了断点续跑功能，允许在任务执行失败或中断后，从上次停止的位置继续执行。

## 新增节点

1. **IF - 是否续跑** (`if-is-resume`)
   - 位置: [560, 200]
   - 作用: 检查请求中是否包含 `resume_run_id` 参数

2. **SSH - 加载断点状态** (`ssh-load-checkpoint`)
   - 位置: [720, 120]
   - 作用: 从 `state.json` 加载上次执行状态，找出未完成的任务

3. **Code - 解析断点状态** (`code-parse-checkpoint`)
   - 位置: [900, 120]
   - 作用: 解析断点数据，生成待执行任务列表

4. **SSH 保存 Waves** (`ssh-save-waves`)
   - 位置: [1020, 300]
   - 作用: 保存任务波次信息到 `waves.json`

## 修改的节点

1. **初始化Run** (`code-init-run`)
   - 添加了 `resume_run_id` 参数支持
   - 新增字段: `is_resume`, `resume_run_id`

2. **Code - 拓扑排序** (`code-topological-sort`)
   - 添加了 wave 数据传递逻辑

3. **SSH Claude B - 执行任务** (`ssh-claude-execute`)
   - 添加了 wave 进度追踪
   - 保存任务完成状态到 `tasks/{task_id}.json`

## 流程图

### 正常启动流程
```
接收PRD
  ↓
初始化Run
  ↓
IF - 是否续跑 (FALSE)
  ↓
SSH 初始化状态目录
  ↓
SSH Claude A - 分解PRD
  ↓
Code - 拓扑排序
  ↓
SSH 保存 Waves
  ↓
SplitInBatches - 任务分批
  ↓
SSH Claude B - 执行任务
  ↓
...
```

### 断点续跑流程
```
接收PRD (含 resume_run_id)
  ↓
初始化Run (使用 resume_run_id)
  ↓
IF - 是否续跑 (TRUE)
  ↓
SSH - 加载断点状态
  ↓
Code - 解析断点状态
  ↓
SplitInBatches - 任务分批 (只执行未完成任务)
  ↓
SSH Claude B - 执行任务
  ↓
...
```

## 使用方法

### 1. 正常启动 (新 Run)

```bash
curl -X POST "http://localhost:5679/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{
    "prd": "创建一个每小时检查磁盘空间的 workflow",
    "project": "monitoring"
  }'
```

### 2. 断点续跑 (Resume)

```bash
# 使用之前失败的 run_id
curl -X POST "http://localhost:5679/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{
    "resume_run_id": "20251224103045-a3f8x9"
  }'
```

## 状态文件结构

### state.json
```json
{
  "status": "executing",
  "started_at": "2025-12-24T10:30:45Z",
  "current_wave": 1,
  "total_waves": 3,
  "last_completed_wave": 0,
  "rework_count": 0
}
```

### waves.json
```json
{
  "waves": [
    {
      "waveIndex": 0,
      "tasks": [
        {
          "id": "task_1",
          "name": "创建 Webhook 节点",
          "depends_on": []
        }
      ]
    },
    {
      "waveIndex": 1,
      "tasks": [
        {
          "id": "task_2",
          "name": "添加数据处理节点",
          "depends_on": ["task_1"]
        }
      ]
    }
  ],
  "totalWaves": 2,
  "tasksCount": 2
}
```

### tasks/{task_id}.json
```json
{
  "task_id": "task_1",
  "status": "completed",
  "wave": 0,
  "completed_at": "2025-12-24T10:31:20+00:00"
}
```

可能的状态值:
- `pending` - 待执行
- `executing` - 执行中
- `completed` - 已完成
- `failed` - 失败

## 断点续跑逻辑

1. 系统检查 `state.json` 中的 `last_completed_wave`
2. 扫描 `tasks/` 目录，找出所有状态为 `pending`, `executing`, `failed` 的任务
3. 只执行这些未完成的任务
4. 成功的任务跳过，失败的任务重新执行

## 注意事项

1. **状态目录必须存在**: 续跑时 `/home/xx/data/runs/{run_id}` 必须存在
2. **PRD 不需要重新提供**: 续跑时会使用之前保存的 `prd.md`
3. **返工计数保留**: 续跑会继承之前的 `rework_count`
4. **波次信息**: 系统会自动跟踪当前执行到第几波

## 典型使用场景

### 场景 1: 网络中断导致失败
```bash
# 第一次执行
curl ... -d '{"prd": "..."}'  # 返回 run_id: 20251224103045-a3f8x9
# 中途网络中断，部分任务失败

# 续跑
curl ... -d '{"resume_run_id": "20251224103045-a3f8x9"}'
```

### 场景 2: 某个任务需要人工修复
```bash
# 1. 第一次执行，task_3 失败
curl ... -d '{"prd": "..."}'  # run_id: 20251224103045-a3f8x9

# 2. 人工检查并修复 task_3 的问题
ssh xx@146.190.52.84
cat /home/xx/data/runs/20251224103045-a3f8x9/tasks/task_3.json
# 修改相关配置或手动完成 task_3

# 3. 标记 task_3 为 pending 或 failed，然后续跑
echo '{"task_id": "task_3", "status": "pending"}' > /home/xx/data/runs/20251224103045-a3f8x9/tasks/task_3.json

# 4. 续跑
curl ... -d '{"resume_run_id": "20251224103045-a3f8x9"}'
```

## 实现细节

### 加载断点状态的 Bash 脚本
```bash
STATE_FILE={{ $json.state_dir }}/state.json
WAVES_FILE={{ $json.state_dir }}/waves.json

# 读取状态
state=$(cat $STATE_FILE)
last_wave=$(echo "$state" | jq -r '.last_completed_wave // -1')
rework_count=$(echo "$state" | jq -r '.rework_count // 0')

# 找出 pending 任务
pending_tasks=$(find {{ $json.state_dir }}/tasks -name '*.json' -exec sh -c '
  status=$(jq -r ".status" "$1")
  if [ "$status" = "pending" ] || [ "$status" = "executing" ] || [ "$status" = "failed" ]; then
    cat "$1"
  fi
' _ {} \; | jq -s '.')
```

### 解析断点数据的 JavaScript
```javascript
const pendingTasks = checkpointData.pending_tasks || [];
const lastWave = checkpointData.last_completed_wave || -1;

// 转换为执行格式
const tasksToExecute = pendingTasks.map((task, index) => ({
  json: {
    id: task.task_id || `task_${index}`,
    name: task.name || task.task_name,
    ...initData,
    rework_count: reworkCount,
    is_checkpoint_resume: true,
    last_completed_wave: lastWave
  }
}));
```

## 测试建议

1. **正常流程测试**
   ```bash
   # 创建一个简单的 workflow
   curl -X POST ... -d '{"prd": "创建一个简单的 webhook workflow"}'
   ```

2. **续跑测试**
   ```bash
   # 手动中断某个 run
   # 然后使用 resume_run_id 续跑
   curl -X POST ... -d '{"resume_run_id": "..."}'
   ```

3. **边界条件测试**
   - 无效的 run_id
   - state.json 不存在
   - 所有任务已完成
   - waves.json 损坏

## 版本历史

- **v1.0** (2025-12-24)
  - 初始实现断点续跑功能
  - 支持 resume_run_id 参数
  - 自动追踪波次和任务状态
  - 保存 waves.json 和任务状态
