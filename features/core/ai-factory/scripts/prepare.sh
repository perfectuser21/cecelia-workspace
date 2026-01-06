#!/bin/bash
#
# AI Factory - 准备阶段脚本
#
# 用法: prepare.sh <task_id>
#
# 参数:
#   task_id     - Notion 任务 ID
#
# 输出: JSON
#   {
#     "task_id": "...",
#     "task_name": "...",
#     "worktree_path": "...",
#     "prompt_file": "...",
#     "branch_name": "..."
#   }
#

# 版本号常量
AI_FACTORY_VERSION="3.2.1"

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"
source "$SCRIPT_DIR/utils.sh"
source "$SCRIPT_DIR/worktree-manager.sh"

# ============================================================
# 参数解析
# ============================================================
TASK_ID="${1:-}"

if [[ -z "$TASK_ID" ]]; then
  echo "用法: prepare.sh <task_id>" >&2
  exit 1
fi

BRANCH_NAME="${GIT_BRANCH_PREFIX}/${TASK_ID}"

log_info "=========================================="
log_info "AI Factory v${AI_FACTORY_VERSION} - 准备阶段"
log_info "=========================================="
log_info "Task ID: $TASK_ID"
log_info "=========================================="

# ============================================================
# 步骤 1: 获取 Notion 任务
# ============================================================
log_info "[1/4] 获取 Notion 任务..."

TASK_INFO=$(fetch_notion_task "$TASK_ID")
if [[ -z "$TASK_INFO" ]]; then
  log_error "无法获取任务信息: $TASK_ID"
  exit 1
fi

TASK_NAME=$(echo "$TASK_INFO" | jq -r '.task_name // "Unknown"')
TASK_CONTENT=$(echo "$TASK_INFO" | jq -r '.content // ""')
TASK_STATUS=$(echo "$TASK_INFO" | jq -r '.status // "Unknown"')

log_info "任务名称: $TASK_NAME"
log_info "状态: $TASK_STATUS"

# ============================================================
# 步骤 2: 创建 Git Worktree
# ============================================================
log_info "[2/4] 创建 Git Worktree..."

# create_worktree 输出可能包含 git 信息，只取最后一行（路径）
# 使用更稳定的方法获取路径
WORKTREE_PATH=$(create_worktree "$TASK_ID" 2>/dev/null | tail -1)

if [[ -z "$WORKTREE_PATH" || ! -d "$WORKTREE_PATH" ]]; then
  log_error "创建 Worktree 失败"
  log_error "Worktree 路径: $WORKTREE_PATH"
  exit 1
fi

log_info "Worktree: $WORKTREE_PATH"

# ============================================================
# 步骤 3: 更新 Notion 状态
# ============================================================
log_info "[3/4] 更新 Notion 状态..."

update_notion_status "$TASK_ID" "In Progress" || log_warn "更新状态失败"

# ============================================================
# 步骤 4: 生成 Prompt 文件
# ============================================================
log_info "[4/4] 生成 Prompt 文件..."

PROMPT_DIR="${WORKTREE_PATH}/.claude"
mkdir -p "$PROMPT_DIR"

PROMPT_FILE="${PROMPT_DIR}/task-prompt.md"

# 写入 prompt 文件
cat > "$PROMPT_FILE" << EOF
## Task
$TASK_NAME

## Requirements
$TASK_CONTENT

## Completion
When done, output: <promise>TASK_COMPLETE</promise>

---
Task ID: $TASK_ID
Notion: https://notion.so/${TASK_ID//-/}
Generated: $(date '+%Y-%m-%d %H:%M:%S')
EOF

log_info "Prompt 文件: $PROMPT_FILE"

# ============================================================
# 输出结果
# ============================================================
log_info "=========================================="
log_info "准备阶段完成"
log_info "=========================================="

jq -n \
  --arg task_id "$TASK_ID" \
  --arg task_name "$TASK_NAME" \
  --arg worktree_path "$WORKTREE_PATH" \
  --arg prompt_file "$PROMPT_FILE" \
  --arg branch_name "$BRANCH_NAME" \
  '{
    task_id: $task_id,
    task_name: $task_name,
    worktree_path: $worktree_path,
    prompt_file: $prompt_file,
    branch_name: $branch_name
  }'
