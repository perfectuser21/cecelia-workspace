#!/bin/bash
#
# AI Factory v3.0 - 主入口
#
# 用法: main.sh <task_id> [options]
#
# 这是 n8n 和外部系统调用的入口点。
# 它封装了 executor.sh，提供简化的接口和更好的日志输出。
#
# 输出:
#   - 执行过程中输出日志到 stderr
#   - 最后输出 JSON 结果到 stdout
#

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"
source "$SCRIPT_DIR/utils.sh"

# ============================================================
# 参数解析
# ============================================================
TASK_ID=""
MODEL="${AI_FACTORY_MODEL:-opus}"
BUDGET="${AI_FACTORY_BUDGET:-100}"
MAX_ITERATIONS="${AI_FACTORY_MAX_ITERATIONS:-30}"
MODE="simple"  # simple 或 ralph
DRY_RUN=false

print_usage() {
  cat << EOF
AI Factory v3.0 - 自动化任务执行系统

用法: main.sh <task_id> [options]

参数:
  task_id              Notion 任务 ID (32 位 hex)

选项:
  -m, --model MODEL    模型选择 (opus/sonnet, 默认: opus)
  -b, --budget USD     最大预算 (默认: 100)
  -i, --max-iter N     最大迭代次数 (默认: 30)
  --ralph              使用 Ralph loop 模式
  --simple             使用简单模式 (默认)
  --dry-run            只准备不执行
  -h, --help           显示帮助

示例:
  main.sh abc123def456...
  main.sh abc123 --model opus --budget 50
  main.sh abc123 --ralph --max-iter 20

环境变量:
  AI_FACTORY_MODEL           默认模型
  AI_FACTORY_BUDGET          默认预算
  AI_FACTORY_MAX_ITERATIONS  默认最大迭代次数
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--model)
      MODEL="$2"
      shift 2
      ;;
    -b|--budget)
      BUDGET="$2"
      shift 2
      ;;
    -i|--max-iter|--max-iterations)
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    --ralph)
      MODE="ralph"
      shift
      ;;
    --simple)
      MODE="simple"
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    -*)
      echo "错误: 未知选项: $1" >&2
      print_usage >&2
      exit 1
      ;;
    *)
      if [[ -z "$TASK_ID" ]]; then
        TASK_ID="$1"
      fi
      shift
      ;;
  esac
done

# ============================================================
# 参数验证
# ============================================================

if [[ -z "$TASK_ID" ]]; then
  echo "错误: 缺少 task_id 参数" >&2
  print_usage >&2
  exit 1
fi

# 验证 task_id 格式（32 位 hex）
if [[ ! "$TASK_ID" =~ ^[a-f0-9]{32}$ ]]; then
  echo "错误: task_id 格式无效，应为 32 位十六进制字符串" >&2
  exit 1
fi

# 验证 model
if [[ ! "$MODEL" =~ ^(opus|sonnet)$ ]]; then
  echo "错误: model 必须是 opus 或 sonnet" >&2
  exit 1
fi

# ============================================================
# 执行
# ============================================================

LOG_FILE="${LOGS_DIR}/v3-${TASK_ID}.log"
mkdir -p "$LOGS_DIR"

# 开始日志
{
  log_info "=========================================="
  log_info "AI Factory v3.0 - 开始执行"
  log_info "=========================================="
  log_info "Task ID: $TASK_ID"
  log_info "Model: $MODEL"
  log_info "Budget: $BUDGET USD"
  log_info "Mode: $([ "$MODE" == "ralph" ] && echo "Ralph Loop" || echo "Simple")"
  log_info "Dry Run: $DRY_RUN"
  log_info "=========================================="
} | tee -a "$LOG_FILE" >&2

# 构建 executor.sh 参数
EXECUTOR_ARGS=(
  "$TASK_ID"
  "--model" "$MODEL"
  "--budget" "$BUDGET"
  "--max-iter" "$MAX_ITERATIONS"
)

if [[ "$MODE" == "ralph" ]]; then
  EXECUTOR_ARGS+=("--ralph")
else
  EXECUTOR_ARGS+=("--simple")
fi

if [[ "$DRY_RUN" == "true" ]]; then
  EXECUTOR_ARGS+=("--dry-run")
fi

# 执行
EXECUTOR_SCRIPT="$SCRIPT_DIR/executor.sh"

if [[ ! -x "$EXECUTOR_SCRIPT" ]]; then
  log_error "executor.sh 不存在或不可执行: $EXECUTOR_SCRIPT" | tee -a "$LOG_FILE" >&2
  exit 1
fi

# 执行并捕获输出
RESULT=$("$EXECUTOR_SCRIPT" "${EXECUTOR_ARGS[@]}" 2>&1 | tee -a "$LOG_FILE")
EXIT_CODE=$?

# 提取最终的 JSON 结果（从最后开始找 { 开头的 JSON）
JSON_RESULT=$(echo "$RESULT" | sed -n '/^{$/,/^}$/p' | tail -1)

if [[ -z "$JSON_RESULT" ]]; then
  # 如果没有找到 JSON，尝试提取 JSON 块
  JSON_RESULT=$(echo "$RESULT" | grep -A 50 '^{' | head -20)
fi

# 输出最终结果到 stdout
if [[ -n "$JSON_RESULT" ]]; then
  echo "$JSON_RESULT"
else
  # 构造一个失败结果
  cat << EOF
{
  "task_id": "$TASK_ID",
  "execution_result": "error",
  "final_status": "AI Failed",
  "error": "Failed to parse execution result",
  "exit_code": $EXIT_CODE,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
fi

exit $EXIT_CODE
