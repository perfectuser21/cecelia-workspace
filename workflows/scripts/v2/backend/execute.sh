#!/bin/bash
#
# Backend 执行阶段脚本（空壳）
# 负责：分析需求、生成代码、写文件、运行测试
#
# 用法: execute.sh <run_id> <task_info_path>
#
# 参数:
#   run_id          - 运行 ID
#   task_info_path  - task_info.json 路径
#
# 输出:
#   - 结果文件: /data/runs/{run_id}/result.json
#   - 返回值: 0=成功, 非0=失败
#
# 状态: 待实现
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED_DIR="$(dirname "$SCRIPT_DIR")/shared"

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

# 读取任务信息
TASK_NAME=$(jq -r '.task_name' "$TASK_INFO_PATH" 2>/dev/null || echo "Unknown")
TASK_CONTENT=$(jq -r '.content' "$TASK_INFO_PATH" 2>/dev/null || echo "")

log_info "=========================================="
log_info "Backend 执行阶段（空壳）"
log_info "Run ID: $RUN_ID"
log_info "Task: $TASK_NAME"
log_info "=========================================="

# ============================================================
# 待实现的步骤
# ============================================================

log_warn "Backend 执行功能待实现"
log_info ""
log_info "计划实现的步骤:"
log_info "  1. 分析 API 需求"
log_info "  2. 确定文件结构 (api.ts, service.ts, db.ts)"
log_info "  3. 使用 Claude 生成代码"
log_info "  4. 写入文件"
log_info "  5. 运行 TypeScript 编译"
log_info "  6. 运行测试"
log_info ""
log_info "任务内容预览:"
log_info "$TASK_CONTENT"

# ============================================================
# 临时结果（标记为未实现）
# ============================================================

RESULT_JSON=$(jq -n \
  --arg success "false" \
  --arg error "not_implemented" \
  --arg message "Backend 执行功能待实现" \
  --arg created_at "$(date -Iseconds)" \
  '{
    success: false,
    error: $error,
    message: $message,
    artifacts: [],
    created_at: $created_at
  }')

echo "$RESULT_JSON" > "$WORK_DIR/result.json"

log_info "=========================================="
log_info "Backend 执行阶段结束（未实现）"
log_info "=========================================="

# 返回失败，触发人工处理
exit 1
