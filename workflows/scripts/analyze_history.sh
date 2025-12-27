#!/bin/bash
# 分析所有历史运行数据

RUNS_DIR="/home/xx/data/runs"
OUTPUT_FILE="/home/xx/data/runs/analysis.json"

total_runs=0
total_success=0
total_tasks=0
total_duration=0
model_opus=0
model_sonnet=0
model_haiku=0

for run_dir in $RUNS_DIR/*/; do
  if [ -f "$run_dir/reports/summary.json" ]; then
    total_runs=$((total_runs + 1))

    summary=$(cat "$run_dir/reports/summary.json")

    # 统计成功率
    decision=$(echo "$summary" | jq -r '.quality.decision // "UNKNOWN"')
    if [ "$decision" = "PASS" ]; then
      total_success=$((total_success + 1))
    fi

    # 统计任务数
    tasks=$(echo "$summary" | jq -r '.execution.total_tasks // 0')
    total_tasks=$((total_tasks + tasks))

    # 统计时长
    duration=$(echo "$summary" | jq -r '.timeline.duration_minutes // 0')
    total_duration=$(echo "$total_duration + $duration" | bc)
  fi
done

# 计算平均值
if [ $total_runs -gt 0 ]; then
  avg_duration=$(echo "scale=2; $total_duration / $total_runs" | bc)
  success_rate=$(echo "scale=2; $total_success * 100 / $total_runs" | bc)
  avg_tasks=$(echo "scale=2; $total_tasks / $total_runs" | bc)
else
  avg_duration=0
  success_rate=0
  avg_tasks=0
fi

echo '{
  "analyzed_at": "'$(date -Iseconds)'",
  "total_runs": '$total_runs',
  "total_success": '$total_success',
  "success_rate": "'$success_rate'%",
  "total_tasks": '$total_tasks',
  "avg_tasks_per_run": '$avg_tasks',
  "total_duration_minutes": '$total_duration',
  "avg_duration_minutes": '$avg_duration'
}' | jq . > "$OUTPUT_FILE"

cat "$OUTPUT_FILE"
