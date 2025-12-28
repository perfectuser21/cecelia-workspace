#!/bin/bash
#
# 准备阶段脚本
# 负责：检查 Git、创建分支、读取 Notion 任务（锁由 main.sh 管理）
#
# 用法: prepare.sh <task_id> <coding_type> [run_id]
#
# 参数:
#   task_id     - Notion 任务 ID
#   coding_type - n8n / backend / frontend
#   run_id      - 运行 ID（可选，不传则自动生成）
#
# 输出:
#   - 环境变量文件: /data/runs/{run_id}/env.sh
#   - 任务详情: /data/runs/{run_id}/task_info.json
#   - 返回值: 0=成功, 非0=失败
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 加载工具函数
source "$SCRIPT_DIR/utils.sh"

# ============================================================
# 参数解析
# ============================================================
TASK_ID="${1:-}"
CODING_TYPE="${2:-}"
RUN_ID="${3:-}"

# 清理 TASK_ID 中的特殊字符（只保留字母数字和连字符）
ORIGINAL_TASK_ID="$TASK_ID"
TASK_ID=$(echo "$TASK_ID" | tr -cd '[:alnum:]-')
if [[ -z "$TASK_ID" ]]; then
  log_error "TASK_ID 无效（原始值: '$ORIGINAL_TASK_ID'，清理后为空）"
  exit 1
fi

if [[ -z "$CODING_TYPE" ]]; then
  log_error "用法: prepare.sh <task_id> <coding_type> [run_id]"
  exit 1
fi

# 验证 coding_type
case "$CODING_TYPE" in
  n8n|backend|frontend)
    ;;
  *)
    log_error "无效的 coding_type: $CODING_TYPE (应为: n8n/backend/frontend)"
    exit 1
    ;;
esac

# 生成 run_id（如果未提供）
if [[ -z "$RUN_ID" ]]; then
  RUN_ID=$(generate_run_id)
fi

log_info "=========================================="
log_info "准备阶段开始"
log_info "Task ID: $TASK_ID"
log_info "Coding Type: $CODING_TYPE"
log_info "Run ID: $RUN_ID"
log_info "=========================================="

# ============================================================
# 步骤 1: 创建运行目录
# ============================================================
# 注意：锁由 main.sh 统一管理，prepare.sh 不再处理锁
log_info "[1/4] 创建运行目录..."

WORK_DIR=$(create_run_dir "$RUN_ID")
LOG_FILE="$WORK_DIR/logs/prepare.log"

log_info "运行目录: $WORK_DIR"

# ============================================================
# 步骤 2: 检查 Git 状态
# ============================================================
log_info "[2/4] 检查 Git 状态..."

if [[ "${TEST_MODE:-}" == "1" ]]; then
  log_info "[TEST_MODE] 跳过 Git 状态检查"
else
  if ! check_git_clean; then
    log_error "Git 状态不干净，请先清理未提交的更改"
    log_error "提示: 使用 'git status' 查看详情，'git stash' 暂存更改"

    # 记录失败原因
    echo '{"error": "git_not_clean", "message": "Git 状态不干净"}' > "$WORK_DIR/error.json"

    # 发送通知
    send_feishu_notification "AI 工厂准备失败\nTask: $TASK_ID\nRun: $RUN_ID\n原因: Git 状态不干净，需要人工清理"

    exit 1
  fi
fi

# ============================================================
# 步骤 3: 创建 feature 分支
# ============================================================
log_info "[3/4] 创建 feature 分支..."

if [[ "${TEST_MODE:-}" == "1" ]]; then
  log_info "[TEST_MODE] 跳过分支创建，使用当前分支"
  BRANCH_NAME=$(git branch --show-current 2>/dev/null || echo "test-branch")
else
  BRANCH_NAME=$(create_feature_branch "$TASK_ID")
fi
log_info "工作分支: $BRANCH_NAME"

# ============================================================
# 步骤 4: 读取 Notion 任务
# ============================================================
log_info "[4/4] 读取 Notion 任务..."

if [[ "${TEST_MODE:-}" == "1" ]]; then
  log_info "[TEST_MODE] 使用 mock 任务信息"
  TASK_INFO=$(jq -n \
    --arg task_id "$TASK_ID" \
    --arg task_name "Mock Task - $TASK_ID" \
    --arg content "这是一个测试任务，用于验证 AI 工厂执行流程。" \
    --arg coding_type "$CODING_TYPE" \
    '{
      task_id: $task_id,
      task_name: $task_name,
      content: $content,
      coding_type: $coding_type
    }')
else
  TASK_INFO=$(fetch_notion_task "$TASK_ID")

  if [[ -z "$TASK_INFO" || "$TASK_INFO" == "null" ]]; then
    log_error "无法获取 Notion 任务: $TASK_ID"

    echo '{"error": "notion_fetch_failed", "message": "无法获取 Notion 任务"}' > "$WORK_DIR/error.json"

    exit 1
  fi
fi

# 保存任务详情
echo "$TASK_INFO" > "$WORK_DIR/task_info.json"
log_info "任务详情已保存: $WORK_DIR/task_info.json"

# 提取任务名称
TASK_NAME=$(echo "$TASK_INFO" | jq -r '.task_name')
log_info "任务名称: $TASK_NAME"

# ============================================================
# 保存环境变量
# ============================================================
export RUN_ID
export TASK_ID
export TASK_NAME
export CODING_TYPE
export BRANCH_NAME
export WORK_DIR
export LOG_FILE

save_env "$WORK_DIR"

# ============================================================
# 更新 Notion 状态
# ============================================================
if [[ "${TEST_MODE:-}" == "1" ]]; then
  log_info "[TEST_MODE] 跳过 Notion 状态更新"
else
  log_info "更新 Notion 状态: In Progress"
  update_notion_status "$TASK_ID" "In Progress" || log_warn "更新状态失败，继续执行"
fi

# ============================================================
# 输出结果
# ============================================================
log_info "=========================================="
log_info "准备阶段完成"
log_info "=========================================="

# 输出 JSON 结果（供调用方解析）
cat << EOF
{
  "success": true,
  "run_id": "$RUN_ID",
  "task_id": "$TASK_ID",
  "task_name": "$TASK_NAME",
  "coding_type": "$CODING_TYPE",
  "branch_name": "$BRANCH_NAME",
  "work_dir": "$WORK_DIR",
  "task_info_path": "$WORK_DIR/task_info.json"
}
EOF
