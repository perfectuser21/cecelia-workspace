#!/bin/bash
#
# Backend 执行器（极简版）
# 只负责：读取 Prompt → 调用 Claude → 保存输出
#
# 用法: execute.sh <run_id> <task_info_path>
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED_DIR="/home/xx/bin/ai-factory-v2"

# 加载工具函数
source "$SHARED_DIR/utils.sh"

# ============================================================
# 参数解析
# ============================================================
RUN_ID="${1:-}"
TASK_INFO_PATH="${2:-}"

if [[ -z "$RUN_ID" || -z "$TASK_INFO_PATH" ]]; then
  log_error "用法: execute.sh <run_id> <task_info_path>"
  exit 1
fi

WORK_DIR="/home/xx/data/runs/$RUN_ID"
LOG_FILE="$WORK_DIR/logs/execute.log"

# 加载环境变量
if [[ -f "$WORK_DIR/env.sh" ]]; then
  source "$WORK_DIR/env.sh" 2>/dev/null || true
fi

log_info "=========================================="
log_info "执行阶段开始 (Backend)"
log_info "Run ID: $RUN_ID"
log_info "=========================================="

# ============================================================
# 检查是否跳过执行（稳定性验证用）
# ============================================================
if [[ -f "$WORK_DIR/result.json" ]]; then
  EXISTING_SUCCESS=$(jq -r '.success' "$WORK_DIR/result.json" 2>/dev/null || echo "false")
  if [[ "$EXISTING_SUCCESS" == "true" ]]; then
    log_info "已有成功结果，跳过执行"
    cat "$WORK_DIR/result.json"
    exit 0
  fi
fi

# ============================================================
# 读取 Prompt
# ============================================================
if [[ ! -f "$WORK_DIR/prompt.txt" ]]; then
  log_error "Prompt 文件不存在: $WORK_DIR/prompt.txt"
  echo '{"success": false, "error": "prompt_not_found"}' > "$WORK_DIR/result.json"
  exit 1
fi

PROMPT=$(cat "$WORK_DIR/prompt.txt")
log_info "Prompt 已加载 ($(wc -c < "$WORK_DIR/prompt.txt") 字节)"

# ============================================================
# 确定项目目录
# ============================================================
PROJECT_PATH="${PROJECT_DIR:-/home/xx/dev/zenithjoy-autopilot}"

# 从 task_info 读取项目路径（如果有）
if [[ -f "$TASK_INFO_PATH" ]]; then
  CUSTOM_PATH=$(jq -r '.project_path // empty' "$TASK_INFO_PATH" 2>/dev/null)
  [[ -n "$CUSTOM_PATH" && "$CUSTOM_PATH" != "null" ]] && PROJECT_PATH="$CUSTOM_PATH"
fi

if [[ ! -d "$PROJECT_PATH" ]]; then
  log_error "项目目录不存在: $PROJECT_PATH"
  echo '{"success": false, "error": "project_not_found"}' > "$WORK_DIR/result.json"
  exit 1
fi

log_info "项目目录: $PROJECT_PATH"

# ============================================================
# 调用 Claude
# ============================================================
log_info "调用 Claude Code..."

cd "$PROJECT_PATH" || exit 1

# 10 分钟超时，超时后 10 秒强制 SIGKILL
if [[ "${TEST_MODE:-}" == "1" ]]; then
  log_info "[TEST_MODE] 模拟 Claude 执行"
  echo "Mock Claude output for testing" > "$WORK_DIR/claude_output.txt"
  CLAUDE_EXIT=0
else
  timeout -k 10 600 claude -p "$PROMPT" > "$WORK_DIR/claude_output.txt" 2>&1
  CLAUDE_EXIT=$?
fi

# ============================================================
# 处理结果
# ============================================================
if [[ $CLAUDE_EXIT -eq 124 || $CLAUDE_EXIT -eq 137 ]]; then
  log_error "Claude 执行超时 (exit: $CLAUDE_EXIT)"
  echo '{"success": false, "error": "timeout"}' > "$WORK_DIR/result.json"
  exit 1
elif [[ $CLAUDE_EXIT -ne 0 ]]; then
  log_error "Claude 执行失败 (exit: $CLAUDE_EXIT)"
  echo '{"success": false, "error": "claude_failed", "exit_code": '$CLAUDE_EXIT'}' > "$WORK_DIR/result.json"
  exit 1
fi

# 检查是否有文件变更
cd "$PROJECT_PATH" || exit 1
FILES_CHANGED=$(git diff --name-only HEAD 2>/dev/null | wc -l || echo 0)

log_info "执行完成，变更 $FILES_CHANGED 个文件"

# 保存成功结果
jq -n \
  --argjson success true \
  --argjson files_changed "$FILES_CHANGED" \
  --arg project "$PROJECT_PATH" \
  '{
    success: $success,
    files_changed: $files_changed,
    project: $project,
    artifacts: [{type: "code", files_changed: $files_changed}]
  }' > "$WORK_DIR/result.json"

log_info "=========================================="
log_info "执行阶段完成"
log_info "=========================================="

cat "$WORK_DIR/result.json"
