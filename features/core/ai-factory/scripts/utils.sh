#!/bin/bash
#
# AI Factory v3.0 - 共享工具函数
# 包含：日志、Notion API、飞书通知
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

# ============================================================
# 日志函数
# ============================================================

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

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

  echo -e "${color}[$timestamp] [$level]${NC} $message" >&2

  if [[ -n "$LOG_FILE" ]]; then
    local log_dir
    log_dir="$(dirname "$LOG_FILE")"
    [[ ! -d "$log_dir" ]] && mkdir -p "$log_dir" 2>/dev/null
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
  fi
}

log_info() { _log "INFO" "$1"; }
log_warn() { _log "WARN" "$1"; }
log_error() { _log "ERROR" "$1"; }
log_debug() { [[ "${DEBUG:-false}" == "true" ]] && _log "DEBUG" "$1"; }

# ============================================================
# Secrets 加载
# ============================================================

load_secrets() {
  local secrets_file="$WORKFLOWS_DIR/.secrets"
  if [[ -f "$secrets_file" ]]; then
    local perms
    perms=$(stat -c %a "$secrets_file" 2>/dev/null || stat -f %Lp "$secrets_file" 2>/dev/null)
    if [[ "$perms" != "600" && "$perms" != "400" ]]; then
      log_error "Secrets 文件权限不安全 ($perms)，必须设置为 600 或 400"
      return 1
    fi
    source "$secrets_file"
  else
    log_warn "Secrets 文件不存在: $secrets_file"
    return 1
  fi
}

# ============================================================
# Notion API
# ============================================================

# 获取 Notion 任务详情
# 参数: $1=task_id (Notion page ID)
# 返回: JSON 字符串
fetch_notion_task() {
  local task_id="$1"

  if [[ "${TEST_MODE:-}" == "1" ]]; then
    log_info "[TEST_MODE] 使用 mock Notion 数据"
    jq -n \
      --arg task_id "$task_id" \
      --arg fetched_at "$(date -Iseconds)" \
      '{
        task_id: $task_id,
        task_name: "测试任务",
        coding_type: "n8n",
        status: "Next Action",
        content: "测试内容",
        fetched_at: $fetched_at
      }'
    return 0
  fi

  load_secrets || return 1

  if [[ -z "$NOTION_API_KEY" ]]; then
    log_error "NOTION_API_KEY 未设置"
    return 1
  fi

  local response
  response=$(curl -sf --connect-timeout 10 --max-time "$API_TIMEOUT" \
    "https://api.notion.com/v1/pages/$task_id" \
    -H "Authorization: Bearer $NOTION_API_KEY" \
    -H "Notion-Version: 2022-06-28" \
    -H "Content-Type: application/json" 2>/dev/null)

  if [[ -z "$response" ]]; then
    log_error "无法获取 Notion 任务: $task_id"
    return 1
  fi

  local blocks
  blocks=$(curl -sf --connect-timeout 10 --max-time "$API_TIMEOUT" \
    "https://api.notion.com/v1/blocks/$task_id/children" \
    -H "Authorization: Bearer $NOTION_API_KEY" \
    -H "Notion-Version: 2022-06-28" 2>/dev/null)

  local content=""
  if [[ -n "$blocks" ]]; then
    content=$(echo "$blocks" | jq -r '
      def get_text(arr): (arr // []) | map(.plain_text // "") | join("");
      .results[]
      | select(.type == "paragraph" or .type == "heading_1" or .type == "heading_2" or .type == "heading_3" or .type == "bulleted_list_item" or .type == "numbered_list_item")
      | if .type == "heading_1" then "# " + get_text(.heading_1.rich_text)
        elif .type == "heading_2" then "## " + get_text(.heading_2.rich_text)
        elif .type == "bulleted_list_item" then "- " + get_text(.bulleted_list_item.rich_text)
        elif .type == "numbered_list_item" then "1. " + get_text(.numbered_list_item.rich_text)
        elif .type == "heading_3" then "### " + get_text(.heading_3.rich_text)
        else get_text(.paragraph.rich_text)
        end
    ' 2>/dev/null)
  fi

  local task_name=$(echo "$response" | jq -r '.properties.Name.title | map(.plain_text // "") | join("") // "Unknown"')
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
update_notion_status() {
  local task_id="$1"
  local status="$2"

  if [[ "${TEST_MODE:-}" == "1" ]]; then
    log_info "[TEST_MODE] 模拟更新 Notion 状态: $status"
    return 0
  fi

  load_secrets || return 1

  if [[ -z "$NOTION_API_KEY" ]]; then
    log_error "NOTION_API_KEY 未设置"
    return 1
  fi

  local json_payload
  json_payload=$(jq -n --arg status "$status" '{properties: {Status: {status: {name: $status}}}}')

  if curl -sf --connect-timeout 10 --max-time "$API_TIMEOUT" -X PATCH \
    "https://api.notion.com/v1/pages/$task_id" \
    -H "Authorization: Bearer $NOTION_API_KEY" \
    -H "Notion-Version: 2022-06-28" \
    -H "Content-Type: application/json" \
    -d "$json_payload" > /dev/null 2>&1; then
    log_info "更新 Notion 状态: $status"
    return 0
  else
    log_error "更新 Notion 状态失败"
    return 1
  fi
}

# 追加内容到 Notion 页面
# 参数: $1=page_id, $2=content (文本内容)
append_to_notion_page() {
  local page_id="$1"
  local content="$2"

  if [[ "${TEST_MODE:-}" == "1" ]]; then
    log_info "[TEST_MODE] 模拟追加内容到 Notion: $page_id"
    return 0
  fi

  load_secrets || return 1

  if [[ -z "$NOTION_API_KEY" ]]; then
    log_error "NOTION_API_KEY 未设置"
    return 1
  fi

  # 截断超长内容
  local truncated="${content:0:1950}"

  local payload
  payload=$(jq -n --arg text "$truncated" '{
    children: [
      {
        object: "block",
        type: "divider",
        divider: {}
      },
      {
        object: "block",
        type: "code",
        code: {
          rich_text: [{type: "text", text: {content: $text}}],
          language: "markdown"
        }
      }
    ]
  }')

  if curl -sf --connect-timeout 10 --max-time "$API_TIMEOUT" -X PATCH \
    "https://api.notion.com/v1/blocks/$page_id/children" \
    -H "Authorization: Bearer $NOTION_API_KEY" \
    -H "Notion-Version: 2022-06-28" \
    -H "Content-Type: application/json" \
    -d "$payload" > /dev/null 2>&1; then
    log_info "内容已追加到 Notion 页面: $page_id"
    return 0
  else
    log_warn "追加内容到 Notion 失败"
    return 1
  fi
}

# ============================================================
# 飞书通知
# ============================================================

# 发送飞书卡片消息
# 参数: $1=标题, $2=状态(success/failed/warning), $3=内容, $4=url(可选)
send_feishu_card() {
  local title="$1"
  local status="$2"
  local content="$3"
  local url="${4:-}"

  if [[ "${TEST_MODE:-}" == "1" ]]; then
    log_info "[TEST_MODE] 模拟发送飞书卡片: $title ($status)"
    return 0
  fi

  load_secrets || return 1

  if [[ -z "$FEISHU_BOT_WEBHOOK" ]]; then
    log_warn "FEISHU_BOT_WEBHOOK 未设置，跳过通知"
    return 0
  fi

  local color="blue"
  local icon=""
  case "$status" in
    success) color="green"; icon="done" ;;
    failed) color="red"; icon="error" ;;
    warning) color="orange"; icon="warning" ;;
  esac

  # 构建元素
  local elements
  elements=$(jq -n --arg content "$content" '[{
    tag: "div",
    text: {tag: "lark_md", content: $content}
  }]')

  # 如果有 URL，添加按钮
  if [[ -n "$url" ]]; then
    elements=$(echo "$elements" | jq --arg url "$url" '. + [{
      tag: "action",
      actions: [{
        tag: "button",
        text: {tag: "plain_text", content: "查看任务"},
        type: "primary",
        url: $url
      }]
    }]')
  fi

  local json_payload
  json_payload=$(jq -n \
    --arg title "$title" \
    --arg color "$color" \
    --argjson elements "$elements" \
    '{
      msg_type: "interactive",
      card: {
        header: {
          title: {tag: "plain_text", content: $title},
          template: $color
        },
        elements: $elements
      }
    }')

  if curl -sf --connect-timeout 10 --max-time "$API_TIMEOUT" -X POST "$FEISHU_BOT_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "$json_payload" > /dev/null 2>&1; then
    log_info "飞书卡片已发送"
    return 0
  else
    log_warn "飞书卡片发送失败"
    return 1
  fi
}

# ============================================================
# 导出函数
# ============================================================
export -f _log log_info log_warn log_error log_debug
export -f load_secrets
export -f fetch_notion_task update_notion_status append_to_notion_page
export -f send_feishu_card
