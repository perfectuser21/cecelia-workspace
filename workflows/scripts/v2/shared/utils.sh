#!/bin/bash
#
# 共享工具函数
# 包含：日志、锁机制、通知、Notion API、截图工具等
#

# ============================================================
# 配置
# ============================================================
LOCK_FILE="/tmp/workflow-factory.lock"
LOCK_TIMEOUT=1800  # 30 分钟死锁阈值
LOCK_RETRY_INTERVAL=60  # 重试间隔 60 秒
LOCK_MAX_RETRIES=3  # 最大重试次数

DATA_DIR="/home/xx/data"
RUNS_DIR="$DATA_DIR/runs"
LOGS_DIR="$DATA_DIR/logs"

PROJECT_DIR="/home/xx/dev/zenithjoy-autopilot"
WORKFLOWS_DIR="$PROJECT_DIR/workflows"

# ============================================================
# 日志函数
# ============================================================

# 日志级别颜色
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'  # No Color

# 日志输出函数
# 参数: $1=级别, $2=消息
_log() {
  local level="$1"
  local message="$2"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  local color=""

  case "$level" in
    INFO) color="$GREEN" ;;
    WARN) color="$YELLOW" ;;
    ERROR) color="$RED" ;;
    DEBUG) color="$BLUE" ;;
  esac

  # 输出到 stderr（可被重定向到日志文件）
  echo -e "${color}[$timestamp] [$level]${NC} $message" >&2

  # 如果设置了日志文件，也写入文件
  if [[ -n "$LOG_FILE" ]]; then
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
  fi
}

log_info() { _log "INFO" "$1"; }
log_warn() { _log "WARN" "$1"; }
log_error() { _log "ERROR" "$1"; }
log_debug() { [[ "${DEBUG:-false}" == "true" ]] && _log "DEBUG" "$1"; }

# ============================================================
# 锁机制
# ============================================================

# 检查锁是否过期（死锁检测）
is_lock_stale() {
  if [[ ! -f "$LOCK_FILE" ]]; then
    return 1  # 锁不存在
  fi

  local lock_time=$(stat -c %Y "$LOCK_FILE" 2>/dev/null || echo 0)
  local current_time=$(date +%s)
  local lock_age=$((current_time - lock_time))

  if [[ $lock_age -gt $LOCK_TIMEOUT ]]; then
    return 0  # 锁已过期
  fi

  # 检查持锁进程是否还存活
  local holder_pid=$(grep -oP 'PID: \K\d+' "$LOCK_FILE" 2>/dev/null)
  if [[ -n "$holder_pid" ]] && ! kill -0 "$holder_pid" 2>/dev/null; then
    return 0  # 持锁进程已死
  fi

  return 1  # 锁有效
}

# 获取锁
# 返回: 0=成功, 1=失败
acquire_lock() {
  local retries=0

  while [[ $retries -lt $LOCK_MAX_RETRIES ]]; do
    # 检查死锁
    if is_lock_stale; then
      log_warn "发现过期锁，强制清理"
      rm -f "$LOCK_FILE"
    fi

    # 尝试获取锁（原子操作）
    if (set -C; echo "PID: $$
TASK_ID: ${TASK_ID:-unknown}
STARTED_AT: $(date -Iseconds)" > "$LOCK_FILE") 2>/dev/null; then
      log_info "获取锁成功 (PID: $$)"
      return 0
    fi

    # 锁被占用
    local holder_pid=$(grep -oP 'PID: \K\d+' "$LOCK_FILE" 2>/dev/null)
    local holder_task=$(grep -oP 'TASK_ID: \K.*' "$LOCK_FILE" 2>/dev/null)
    log_warn "锁被占用 (PID: $holder_pid, Task: $holder_task)，等待 ${LOCK_RETRY_INTERVAL}s..."

    sleep $LOCK_RETRY_INTERVAL
    retries=$((retries + 1))
  done

  log_error "获取锁失败，超过最大重试次数 ($LOCK_MAX_RETRIES)"
  return 1
}

# 释放锁
# 只有锁持有者进程才能释放锁，防止子进程误释放
release_lock() {
  if [[ -f "$LOCK_FILE" ]]; then
    local holder_pid=$(grep -oP 'PID: \K\d+' "$LOCK_FILE" 2>/dev/null)
    # 只有锁持有者才能释放
    if [[ "$holder_pid" == "$$" ]]; then
      rm -f "$LOCK_FILE"
      log_info "释放锁成功 (PID: $$)"
    else
      log_debug "锁不属于当前进程 (holder: $holder_pid, current: $$)，不释放"
    fi
  fi
}

# ============================================================
# 目录管理
# ============================================================

# 创建运行目录
# 参数: $1=run_id
# 返回: 运行目录路径
create_run_dir() {
  local run_id="$1"
  local run_dir="$RUNS_DIR/$run_id"

  mkdir -p "$run_dir/logs"
  echo "$run_dir"
}

# 生成运行 ID
# 格式: YYYYMMDD-HHMMSS-RANDOM
generate_run_id() {
  local timestamp=$(date '+%Y%m%d-%H%M%S')
  local random=$(head -c 100 /dev/urandom | tr -dc 'a-z0-9' | head -c 6)
  echo "${timestamp}-${random}"
}

# ============================================================
# Notion API
# ============================================================

# 加载 secrets
load_secrets() {
  local secrets_file="$WORKFLOWS_DIR/.secrets"
  if [[ -f "$secrets_file" ]]; then
    source "$secrets_file"
  else
    log_warn "Secrets 文件不存在: $secrets_file"
  fi
}

# 获取 Notion 任务详情
# 参数: $1=task_id (Notion page ID)
# 返回: JSON 字符串
# 环境变量: TEST_MODE=1 时返回 mock 数据
fetch_notion_task() {
  local task_id="$1"

  # TEST_MODE: 返回 mock 数据用于测试
  if [[ "${TEST_MODE:-}" == "1" ]]; then
    log_info "[TEST_MODE] 使用 mock Notion 数据"
    jq -n \
      --arg task_id "$task_id" \
      --arg fetched_at "$(date -Iseconds)" \
      '{
        task_id: $task_id,
        task_name: "测试任务 - 创建监控告警 Workflow",
        coding_type: "n8n",
        status: "Next Action",
        content: "创建一个 n8n workflow，实现以下功能：\n\n1. 每小时检查 VPS 磁盘空间\n2. 超过 80% 时发送飞书告警\n3. 告警内容包含：当前使用率、剩余空间、建议清理的目录",
        fetched_at: $fetched_at
      }'
    return 0
  fi

  load_secrets

  if [[ -z "$NOTION_API_KEY" ]]; then
    log_error "NOTION_API_KEY 未设置"
    return 1
  fi

  # 获取页面属性
  local response
  response=$(curl -sf --max-time 30 "https://api.notion.com/v1/pages/$task_id" \
    -H "Authorization: Bearer $NOTION_API_KEY" \
    -H "Notion-Version: 2022-06-28" \
    -H "Content-Type: application/json" 2>/dev/null)

  if [[ -z "$response" ]]; then
    log_error "无法获取 Notion 任务: $task_id"
    return 1
  fi

  # 获取页面内容（blocks）
  local blocks
  blocks=$(curl -sf --max-time 30 "https://api.notion.com/v1/blocks/$task_id/children" \
    -H "Authorization: Bearer $NOTION_API_KEY" \
    -H "Notion-Version: 2022-06-28" 2>/dev/null)

  # 提取内容（简化处理，只取 paragraph 类型的文本）
  local content=""
  if [[ -n "$blocks" ]]; then
    content=$(echo "$blocks" | jq -r '
      .results[]
      | select(.type == "paragraph" or .type == "heading_1" or .type == "heading_2" or .type == "bulleted_list_item")
      | if .type == "heading_1" then "# " + (.heading_1.rich_text[0].plain_text // "")
        elif .type == "heading_2" then "## " + (.heading_2.rich_text[0].plain_text // "")
        elif .type == "bulleted_list_item" then "- " + (.bulleted_list_item.rich_text[0].plain_text // "")
        else .paragraph.rich_text[0].plain_text // ""
        end
    ' 2>/dev/null | tr '\n' '\n')
  fi

  # 构建 task_info JSON
  local task_name=$(echo "$response" | jq -r '.properties.Name.title[0].plain_text // "Unknown"')
  local coding_type=$(echo "$response" | jq -r '.properties["Coding Type"].select.name // "n8n"')
  local status=$(echo "$response" | jq -r '.properties.Status.status.name // "Unknown"')

  jq -n \
    --arg task_id "$task_id" \
    --arg task_name "$task_name" \
    --arg coding_type "$coding_type" \
    --arg status "$status" \
    --arg content "$content" \
    --arg fetched_at "$(date -Iseconds)" \
    '{
      task_id: $task_id,
      task_name: $task_name,
      coding_type: $coding_type,
      status: $status,
      content: $content,
      fetched_at: $fetched_at
    }'
}

# 更新 Notion 任务状态
# 参数: $1=task_id, $2=status
# 环境变量: TEST_MODE=1 时跳过实际更新
update_notion_status() {
  local task_id="$1"
  local status="$2"

  # TEST_MODE: 跳过实际更新
  if [[ "${TEST_MODE:-}" == "1" ]]; then
    log_info "[TEST_MODE] 模拟更新 Notion 状态: $status"
    return 0
  fi

  load_secrets

  if [[ -z "$NOTION_API_KEY" ]]; then
    log_error "NOTION_API_KEY 未设置"
    return 1
  fi

  curl -sf --max-time 30 -X PATCH "https://api.notion.com/v1/pages/$task_id" \
    -H "Authorization: Bearer $NOTION_API_KEY" \
    -H "Notion-Version: 2022-06-28" \
    -H "Content-Type: application/json" \
    -d "{
      \"properties\": {
        \"Status\": {
          \"status\": {
            \"name\": \"$status\"
          }
        }
      }
    }" > /dev/null 2>&1

  if [[ $? -eq 0 ]]; then
    log_info "更新 Notion 状态: $status"
    return 0
  else
    log_error "更新 Notion 状态失败"
    return 1
  fi
}

# ============================================================
# 飞书通知
# ============================================================

# 发送飞书消息
# 参数: $1=消息内容
send_feishu_notification() {
  local message="$1"
  load_secrets

  if [[ -z "$FEISHU_BOT_WEBHOOK" ]]; then
    log_warn "FEISHU_BOT_WEBHOOK 未设置，跳过通知"
    return 0
  fi

  local json_payload
  json_payload=$(jq -n --arg msg "$message" '{msg_type: "text", content: {text: $msg}}')

  if curl -sf --max-time 30 -X POST "$FEISHU_BOT_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "$json_payload" > /dev/null 2>&1; then
    log_info "飞书通知已发送"
    return 0
  else
    log_warn "飞书通知发送失败"
    return 1
  fi
}

# 发送飞书卡片消息
# 参数: $1=标题, $2=状态(success/failed/warning), $3=内容
# 环境变量: TEST_MODE=1 时跳过实际发送
send_feishu_card() {
  local title="$1"
  local status="$2"
  local content="$3"

  # TEST_MODE: 跳过实际发送
  if [[ "${TEST_MODE:-}" == "1" ]]; then
    log_info "[TEST_MODE] 模拟发送飞书卡片: $title ($status)"
    return 0
  fi

  load_secrets

  if [[ -z "$FEISHU_BOT_WEBHOOK" ]]; then
    log_warn "FEISHU_BOT_WEBHOOK 未设置，跳过通知"
    return 0
  fi

  local color="blue"
  local icon=""
  case "$status" in
    success) color="green"; icon="✅" ;;
    failed) color="red"; icon="❌" ;;
    warning) color="orange"; icon="⚠️" ;;
  esac

  local json_payload
  json_payload=$(jq -n \
    --arg title "$icon $title" \
    --arg color "$color" \
    --arg content "$content" \
    '{
      msg_type: "interactive",
      card: {
        header: {
          title: {tag: "plain_text", content: $title},
          template: $color
        },
        elements: [{
          tag: "div",
          text: {tag: "lark_md", content: $content}
        }]
      }
    }')

  curl -sf --max-time 30 -X POST "$FEISHU_BOT_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "$json_payload" > /dev/null 2>&1
}

# ============================================================
# 环境变量管理
# ============================================================

# 保存环境变量到文件
# 参数: $1=run_dir
save_env() {
  local run_dir="$1"
  local env_file="$run_dir/env.sh"

  cat > "$env_file" << EOF
export RUN_ID="$RUN_ID"
export TASK_ID="$TASK_ID"
export CODING_TYPE="$CODING_TYPE"
export WORK_DIR="$run_dir"
export PROJECT_DIR="$PROJECT_DIR"
export BRANCH_NAME="$BRANCH_NAME"
export LOG_FILE="$run_dir/logs/main.log"
EOF

  log_info "环境变量已保存到: $env_file"
}

# 加载环境变量
# 参数: $1=run_dir
load_env() {
  local run_dir="$1"
  local env_file="$run_dir/env.sh"

  if [[ -f "$env_file" ]]; then
    source "$env_file"
    log_info "环境变量已加载"
  else
    log_error "环境变量文件不存在: $env_file"
    return 1
  fi
}

# ============================================================
# Git 工具
# ============================================================

# 检查 Git 状态是否干净
check_git_clean() {
  cd "$PROJECT_DIR" || return 1

  local status=$(git status --porcelain)
  if [[ -n "$status" ]]; then
    log_error "Git 状态不干净："
    echo "$status" >&2
    return 1
  fi

  log_info "Git 状态干净"
  return 0
}

# 创建 feature 分支
# 参数: $1=task_id
create_feature_branch() {
  local task_id="$1"
  local branch_name="feature/$task_id"

  cd "$PROJECT_DIR" || return 1

  # 切换到基础分支并拉取最新（支持 develop/main/master）
  log_info "切换到基础分支..."
  git checkout develop >/dev/null 2>&1 || git checkout main >/dev/null 2>&1 || git checkout master >/dev/null 2>&1
  git pull origin "$(git branch --show-current)" >/dev/null 2>&1 || true

  # 记录当前基础分支
  local base_branch=$(git branch --show-current)

  # 检查分支是否已存在
  if git show-ref --verify --quiet "refs/heads/$branch_name"; then
    log_info "分支已存在，切换并更新: $branch_name"
    git checkout "$branch_name" >/dev/null 2>&1
    # 尝试 rebase 到最新基础分支（失败不影响继续）
    if [[ -n "$base_branch" ]]; then
      if git rebase "origin/$base_branch" >/dev/null 2>&1; then
        log_info "已 rebase 到 origin/$base_branch"
      else
        git rebase --abort >/dev/null 2>&1 || true
        log_warn "Rebase 失败，使用当前分支状态"
      fi
    fi
  else
    log_info "创建新分支: $branch_name"
    git checkout -b "$branch_name" >/dev/null 2>&1
  fi

  echo "$branch_name"
}

# ============================================================
# 导出函数（供其他脚本使用）
# ============================================================
# 注意: cleanup_on_exit 和 setup_cleanup_trap 已移至 main.sh
# main.sh 中有完整的进程管理和清理逻辑，避免重复定义
export -f log_info log_warn log_error log_debug
export -f acquire_lock release_lock
export -f create_run_dir generate_run_id
export -f fetch_notion_task update_notion_status
export -f send_feishu_notification send_feishu_card
export -f save_env load_env
export -f check_git_clean create_feature_branch

# ============================================================
# 加载截图工具
# ============================================================
UTILS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$UTILS_DIR/screenshot-utils.sh" ]]; then
  source "$UTILS_DIR/screenshot-utils.sh"
fi
