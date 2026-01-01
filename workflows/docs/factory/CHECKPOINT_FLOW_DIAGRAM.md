# 断点续跑流程图

## 完整流程对比

### 正常启动 (is_resume = false)

```
┌──────────────────┐
│   接收PRD        │
│   (Webhook)      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   初始化Run      │  生成新的 run_id
│                  │  is_resume = false
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ IF - 是否续跑?   │
│                  │
└────┬──────┬──────┘
     │      │
  FALSE     TRUE (跳过)
     │
     ▼
┌──────────────────┐
│ SSH 初始化       │  创建状态目录
│ 状态目录         │  state.json, waves.json
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ SSH Claude A     │  PRD 分解为任务
│ 分解PRD          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Code - 拓扑排序  │  任务依赖排序
│                  │  生成 waves
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ SSH 保存 Waves   │  保存 waves.json
│                  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ SplitInBatches   │
│ 任务分批         │ ◄──────┐
└────────┬─────────┘        │
         │                  │
         ▼                  │
┌──────────────────┐        │
│ SSH Claude B     │        │
│ 执行任务         │ ───────┘ (循环)
│ + 保存任务状态   │
└────────┬─────────┘
         │
         ▼
    (继续质检...)
```

### 断点续跑 (is_resume = true)

```
┌──────────────────┐
│   接收PRD        │
│   (Webhook)      │  含 resume_run_id
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   初始化Run      │  使用 resume_run_id
│                  │  is_resume = true
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ IF - 是否续跑?   │
│                  │
└────┬──────┬──────┘
     │      │
  FALSE   TRUE
  (跳过)   │
           ▼
      ┌──────────────────┐
      │ SSH - 加载       │  读取 state.json
      │ 断点状态         │  找出 pending 任务
      └────────┬─────────┘
               │
               ▼
      ┌──────────────────┐
      │ Code - 解析      │  解析断点数据
      │ 断点状态         │  生成待执行任务列表
      └────────┬─────────┘
               │
               ▼
      ┌──────────────────┐
      │ SplitInBatches   │
      │ 任务分批         │ ◄──────┐
      └────────┬─────────┘        │
               │                  │
               ▼                  │
      ┌──────────────────┐        │
      │ SSH Claude B     │        │
      │ 执行任务         │ ───────┘ (循环)
      │ (只执行pending)  │
      └────────┬─────────┘
               │
               ▼
          (继续质检...)
```

## 状态文件交互

```
执行过程中状态文件的变化:

初始化阶段:
  /home/xx/data/runs/{run_id}/
    ├── state.json          ← 初始化状态
    ├── prd.md              ← 保存 PRD
    └── tasks/              ← 任务目录

分解PRD后:
  /home/xx/data/runs/{run_id}/
    ├── state.json          ← 更新状态
    └── waves.json          ← 保存 wave 信息 (NEW)

执行任务中:
  /home/xx/data/runs/{run_id}/
    ├── state.json          ← 更新 current_wave
    └── tasks/
        ├── task_1.json     ← {"status": "completed", "wave": 0}
        ├── task_2.json     ← {"status": "executing", "wave": 1}
        └── task_3.json     ← {"status": "pending", "wave": 2}

断点续跑时:
  1. 读取 state.json → last_completed_wave
  2. 读取 waves.json → wave 结构
  3. 扫描 tasks/*.json → 找出 pending/failed 任务
  4. 只执行未完成的任务
```

## 节点位置布局

```
高度 120:  [SSH - 加载断点状态] → [Code - 解析断点状态]
              (720, 120)              (900, 120)
                    ↓
                    └─────────────────────────────┐
                                                  ↓
高度 200:  [IF - 是否续跑]              [SplitInBatches]
              (560, 200)                   (1080, 300)
                 ↓  ↓
              TRUE FALSE
                    ↓
高度 300:  [初始化Run] → [SSH初始化] → [Claude A] → [拓扑排序] → [保存Waves]
            (400,300)    (560,300)    (720,300)   (900,300)    (1020,300)
                                                                      ↓
                                                                      └→ [SplitInBatches]
```

## 关键代码片段

### 1. 初始化Run - 检测续跑

```javascript
const resumeRunId = inputData.resume_run_id || inputData.body?.resume_run_id || null;
const runId = resumeRunId || (/* 生成新ID */);

return [{
  json: {
    run_id: runId,
    is_resume: resumeRunId ? true : false,
    resume_run_id: resumeRunId
  }
}];
```

### 2. 加载断点状态 - SSH 脚本

```bash
# 读取状态
state=$(cat $STATE_FILE)
last_wave=$(echo "$state" | jq -r '.last_completed_wave // -1')

# 找出 pending 任务
pending_tasks=$(find {{ $json.state_dir }}/tasks -name '*.json' -exec sh -c '
  status=$(jq -r ".status" "$1")
  if [ "$status" = "pending" ] || [ "$status" = "executing" ] || [ "$status" = "failed" ]; then
    cat "$1"
  fi
' _ {} \; | jq -s '.')
```

### 3. 执行任务 - 更新 wave 进度

```bash
# 更新 wave 信息
jq '.current_wave = {{ $json.waveIndex }} | .total_waves = {{ $json.totalWaves }}' \
   {{ $json.state_dir }}/state.json > {{ $json.state_dir }}/state.json.tmp

# 标记任务完成
echo '{"task_id": "{{ $json.id }}", "status": "completed", "wave": {{ $json.waveIndex }}}' \
   > {{ $json.state_dir }}/tasks/{{ $json.id }}.json
```

## 使用示例

### 场景 1: 正常流程 → 中断 → 续跑

```bash
# Step 1: 正常启动
$ curl -X POST "http://localhost:5679/webhook/workflow-factory" \
    -d '{"prd": "创建包含 10 个任务的复杂 workflow"}'

Response:
{
  "run_id": "20251224143000-x9k2p1",
  "status": "executing",
  ...
}

# Step 2: 执行到一半失败 (假设 task_5 失败)
# state.json 状态:
{
  "current_wave": 2,
  "last_completed_wave": 1,
  "status": "failed"
}

# tasks/ 状态:
task_1.json: {"status": "completed", "wave": 0}
task_2.json: {"status": "completed", "wave": 0}
task_3.json: {"status": "completed", "wave": 1}
task_4.json: {"status": "completed", "wave": 1}
task_5.json: {"status": "failed", "wave": 2}
task_6.json: {"status": "pending", "wave": 2}
...

# Step 3: 修复问题后续跑
$ curl -X POST "http://localhost:5679/webhook/workflow-factory" \
    -d '{"resume_run_id": "20251224143000-x9k2p1"}'

# 系统只会执行:
# - task_5 (failed → 重试)
# - task_6 (pending → 首次执行)
# - task_7 到 task_10 (pending → 首次执行)
```

### 场景 2: 查看任务状态

```bash
# 查看整体状态
$ ssh xx@146.190.52.84 'cat /home/xx/data/runs/20251224143000-x9k2p1/state.json'

# 查看某个任务状态
$ ssh xx@146.190.52.84 'cat /home/xx/data/runs/20251224143000-x9k2p1/tasks/task_5.json'

# 查看 wave 信息
$ ssh xx@146.190.52.84 'cat /home/xx/data/runs/20251224143000-x9k2p1/waves.json'
```

## 优势

1. **容错性**: 网络中断、服务重启后可继续执行
2. **节省时间**: 不需要从头开始，跳过已完成任务
3. **灵活性**: 可以手动修复某个任务后续跑
4. **可追溯**: 完整的状态文件记录执行历史
5. **幂等性**: 重复续跑不会重复执行已完成任务

## 注意事项

1. **状态目录必须完整**: 删除 state.json 或 tasks/ 会导致续跑失败
2. **run_id 必须存在**: 无效的 resume_run_id 会返回错误
3. **任务状态一致性**: 手动修改任务状态时要保证正确性
4. **并发问题**: 不要同时对同一个 run_id 进行续跑
