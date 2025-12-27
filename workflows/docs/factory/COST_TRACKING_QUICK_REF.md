# 成本追踪快速参考

## 功能概述

workflow-factory.sh 现在自动追踪每次 Claude 调用的成本，包括：
- 每次调用的 token 使用量
- 每个模型的调用次数（opus/sonnet/haiku）
- 总成本估算（美元）

## 定价

| 模型 | 价格 |
|------|------|
| Opus | $75/百万 tokens |
| Sonnet | $15/百万 tokens |
| Haiku | $1/百万 tokens |

## 数据位置

### 单次运行数据
```
/home/xx/data/runs/{RUN_ID}/
├── costs.log              # CSV: model,input_tokens,output_tokens,cost
├── model_calls.log        # 每行一个模型名
└── reports/summary.json   # 包含 cost 字段
```

### 全局历史
```
/home/xx/dev/n8n-workflows/cost_history.json
```

## 常用命令

### 查看最近一次运行成本
```bash
LATEST_RUN=$(ls -1t /home/xx/data/runs/ | head -1)
cat /home/xx/data/runs/$LATEST_RUN/reports/summary.json | jq '.cost'
```

### 查看成本明细
```bash
cat /home/xx/data/runs/$LATEST_RUN/costs.log
```

### 查看历史总成本
```bash
cat /home/xx/dev/n8n-workflows/cost_history.json | \
  jq '.runs | map(.cost.estimated_cost_usd) | add'
```

### 最贵的10次运行
```bash
cat /home/xx/dev/n8n-workflows/cost_history.json | \
  jq '.runs | sort_by(.cost.estimated_cost_usd) | reverse | .[:10] | .[] | {run_id, cost: .cost.estimated_cost_usd}'
```

### 按模型统计
```bash
cat /home/xx/dev/n8n-workflows/cost_history.json | \
  jq '.runs | map(.cost) | {
    opus: map(.opus_calls) | add,
    sonnet: map(.sonnet_calls) | add,
    haiku: map(.haiku_calls) | add,
    total_cost: map(.estimated_cost_usd) | add
  }'
```

## summary.json 示例

```json
{
  "run_id": "run_20251225_123456",
  "decision": "PASS",
  "cost": {
    "opus_calls": 0,
    "sonnet_calls": 5,
    "haiku_calls": 3,
    "estimated_cost_usd": 0.078
  }
}
```

## 成本历史示例

```json
{
  "created_at": "2025-12-25T00:00:00Z",
  "updated_at": "2025-12-25T10:30:00Z",
  "runs": [
    {
      "run_id": "run_123",
      "date": "2025-12-25T10:30:00Z",
      "prd": "创建webhook workflow",
      "decision": "PASS",
      "cost": {
        "opus_calls": 0,
        "sonnet_calls": 5,
        "haiku_calls": 2,
        "estimated_cost_usd": 0.077
      }
    }
  ]
}
```

## 实现细节

### 追踪点

| 阶段 | 模型 | 函数 |
|------|------|------|
| PRD分解 | sonnet | decompose_prd() |
| 任务执行 | 动态 | execute_tasks() |
| 质量检查 | haiku | run_qc_checks() |
| 文档生成 | haiku | generate_docs() |

### Token 提取

```bash
# Claude CLI 输出格式
Input tokens: 1234
Output tokens: 567

# 提取方法
input_tokens=$(echo "$output" | grep -oP 'Input tokens:\s*\K\d+' | tail -1)
output_tokens=$(echo "$output" | grep -oP 'Output tokens:\s*\K\d+' | tail -1)
```

### 成本计算

```bash
cost = (input_tokens + output_tokens) * price / 1000000
```

## 故障排查

### 问题: 成本为 0
**原因**: Token 提取失败（CLI 输出格式变化）  
**检查**: 查看 `$STATE_DIR/claude_*_output.txt` 文件

### 问题: cost_history.json 格式错误
**解决**: save_cost_history() 会自动重建文件

### 问题: 并发写入冲突
**概率**: 极低（jq 操作非常快）  
**缓解**: 使用临时文件 + mv 原子操作

## 维护

1. **定期清理旧 runs**: 保留最近30天
2. **备份 cost_history.json**: 每周备份
3. **分析成本趋势**: 优化模型选择

---

最后更新: 2025-12-25
