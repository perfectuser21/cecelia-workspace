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

# P0: 清理 TASK_ID 中的特殊字符（使用白名单：字母、数字、连字符、下划线）
ORIGINAL_TASK_ID="$TASK_ID"
TASK_ID=$(echo "$TASK_ID" | tr -cd 'a-zA-Z0-9_-')
if [[ -z "$TASK_ID" ]]; then
  log_error "TASK_ID 无效（原始值: '$ORIGINAL_TASK_ID'，清理后为空）"
  exit 1
fi

# 限制 TASK_ID 长度（最大 64 字符）
# P2: 截断时添加哈希后缀确保唯一性
MAX_TASK_ID_LENGTH=64
if [[ ${#TASK_ID} -gt $MAX_TASK_ID_LENGTH ]]; then
  # 计算原始 TASK_ID 的短哈希（8 字符）
  HASH_SUFFIX=$(echo -n "$TASK_ID" | md5sum | cut -c1-8)
  # 截断长度 = 最大长度 - 1(连字符) - 8(哈希)
  TRUNCATE_LENGTH=$((MAX_TASK_ID_LENGTH - 9))
  log_warn "TASK_ID 过长 (${#TASK_ID} 字符)，截断为 ${TRUNCATE_LENGTH}+hash 字符"
  TASK_ID="${TASK_ID:0:$TRUNCATE_LENGTH}-${HASH_SUFFIX}"
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

# P1: 在 create_run_dir 前设置临时 LOG_FILE（用于早期日志记录）
LOG_FILE="${LOGS_DIR:-/home/xx/data/logs}/prepare-$RUN_ID.log"

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

# P1: 检查磁盘空间（至少需要 500MB）
if ! check_disk_space "${RUNS_DIR:-/home/xx/data/runs}" 500; then
  log_error "磁盘空间不足，无法创建运行目录"
  exit 1
fi

WORK_DIR=$(create_run_dir "$RUN_ID")
if [[ -z "$WORK_DIR" || ! -d "$WORK_DIR" ]]; then
  log_error "创建运行目录失败: RUN_ID=$RUN_ID"
  exit 1
fi
# 更新 LOG_FILE 到运行目录
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
    if ! jq -n '{error: "git_not_clean", message: "Git 状态不干净"}' > "$WORK_DIR/error.json"; then
      log_warn "无法写入 error.json"
    fi

    exit 1
  fi

  # P0: 检查 Git submodule 状态
  cd "$PROJECT_DIR" || exit 1
  if git submodule status 2>/dev/null | grep -qE '^[-+]'; then
    log_error "Git submodule 状态异常，请先同步 submodule"
    log_error "提示: 使用 'git submodule update --init --recursive' 同步"

    if ! jq -n '{error: "submodule_not_clean", message: "Git submodule 状态异常"}' > "$WORK_DIR/error.json"; then
      log_warn "无法写入 error.json"
    fi

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

  # P1: 在 TEST_MODE 下也验证 mock JSON 有效性
  if ! echo "$TASK_INFO" | jq empty 2>/dev/null; then
    log_error "[TEST_MODE] Mock JSON 生成失败"
    if ! jq -n '{error: "mock_json_invalid", message: "Mock JSON 生成失败"}' > "$WORK_DIR/error.json"; then
      log_warn "无法写入 error.json"
    fi
    exit 1
  fi
else
  TASK_INFO=$(fetch_notion_task "$TASK_ID")

  # 检查是否获取失败、为空、为 null 或为空对象 {}
  if [[ -z "$TASK_INFO" || "$TASK_INFO" == "null" || "$TASK_INFO" == "{}" ]]; then
    log_error "无法获取 Notion 任务: $TASK_ID (结果: '$TASK_INFO')"

    if ! jq -n '{error: "notion_fetch_failed", message: "无法获取 Notion 任务"}' > "$WORK_DIR/error.json"; then
      log_warn "无法写入 error.json"
    fi

    exit 1
  fi

  # P1: 验证 JSON 格式有效性
  if ! echo "$TASK_INFO" | jq empty 2>/dev/null; then
    log_error "Notion 任务返回无效 JSON: $TASK_ID"
    log_error "返回内容: ${TASK_INFO:0:200}..."

    if ! jq -n '{error: "invalid_json", message: "Notion 任务返回无效 JSON"}' > "$WORK_DIR/error.json"; then
      log_warn "无法写入 error.json"
    fi

    exit 1
  fi
fi

# 保存任务详情
if ! echo "$TASK_INFO" > "$WORK_DIR/task_info.json"; then
  log_error "无法写入 task_info.json"
  exit 1
fi
log_info "任务详情已保存: $WORK_DIR/task_info.json"

# 提取任务名称
TASK_NAME=$(echo "$TASK_INFO" | jq -r '.task_name')
if [[ -z "$TASK_NAME" || "$TASK_NAME" == "null" ]]; then
  log_error "任务名称为空或无效: '$TASK_NAME'"
  # P1: 保存错误信息到 error.json
  if ! jq -n --arg task_name "$TASK_NAME" '{error: "task_name_invalid", message: "任务名称为空或无效", task_name: $task_name}' > "$WORK_DIR/error.json"; then
    log_warn "无法写入 error.json"
  fi
  exit 1
fi
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

# P0: 检查 save_env 返回值
if ! save_env "$WORK_DIR"; then
  log_error "保存环境变量失败"
  if ! jq -n '{error: "save_env_failed", message: "保存环境变量失败"}' > "$WORK_DIR/error.json"; then
    log_warn "无法写入 error.json"
  fi
  exit 1
fi

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
jq -n \
  --arg run_id "$RUN_ID" \
  --arg task_id "$TASK_ID" \
  --arg task_name "$TASK_NAME" \
  --arg coding_type "$CODING_TYPE" \
  --arg branch_name "$BRANCH_NAME" \
  --arg work_dir "$WORK_DIR" \
  --arg task_info_path "$WORK_DIR/task_info.json" \
  '{
    success: true,
    run_id: $run_id,
    task_id: $task_id,
    task_name: $task_name,
    coding_type: $coding_type,
    branch_name: $branch_name,
    work_dir: $work_dir,
    task_info_path: $task_info_path
  }'
