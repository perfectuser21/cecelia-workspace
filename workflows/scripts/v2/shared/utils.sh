#!/bin/bash
#
# 共享工具函数
# 包含：日志、锁机制、通知、Notion API、截图工具等
#

# ============================================================
# 配置
# ============================================================

# P2 修复: 使用环境变量替代硬编码路径
DATA_DIR="${DATA_DIR:-/home/xx/data}"
RUNS_DIR="${RUNS_DIR:-$DATA_DIR/runs}"
LOGS_DIR="${LOGS_DIR:-$DATA_DIR/logs}"

PROJECT_DIR="${PROJECT_DIR:-/home/xx/dev/zenithjoy-autopilot}"
WORKFLOWS_DIR="${WORKFLOWS_DIR:-$PROJECT_DIR/workflows}"

# P1 修复: 锁文件移到 $DATA_DIR/.locks/ 目录，验证目录权限
LOCKS_DIR="$DATA_DIR/.locks"

# 初始化锁目录（仅当前用户可访问）
_init_locks_dir() {
  if [[ ! -d "$LOCKS_DIR" ]]; then
    mkdir -p "$LOCKS_DIR" 2>/dev/null || {
      log_error "无法创建锁目录: $LOCKS_DIR"
      return 1
    }
    chmod 700 "$LOCKS_DIR"
  fi
  # 验证目录权限（必须是 700 或 750）
  local perms
  perms=$(stat -c %a "$LOCKS_DIR" 2>/dev/null || stat -f %Lp "$LOCKS_DIR" 2>/dev/null)
  if [[ "$perms" != "700" && "$perms" != "750" ]]; then
    log_warn "锁目录权限不安全 ($perms)，正在修复为 700"
    chmod 700 "$LOCKS_DIR" || {
      log_error "无法修复锁目录权限"
      return 1
    }
  fi
  return 0
}

# 调用初始化（静默失败，让后续锁操作报错）
_init_locks_dir 2>/dev/null || true

LOCK_FILE="$LOCKS_DIR/workflow-factory.lock"
LOCK_TIMEOUT=600  # P1 修复: 10 分钟死锁阈值（原 30 分钟太长）
LOCK_RETRY_INTERVAL=60  # 重试间隔 60 秒
LOCK_MAX_RETRIES=3  # 最大重试次数

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

  # 如果设置了日志文件，也写入文件（P0: 安全权限 + 并发保护）
  if [[ -n "$LOG_FILE" ]]; then
    local log_dir
    log_dir="$(dirname "$LOG_FILE")"
    if [[ ! -d "$log_dir" ]]; then
      mkdir -p "$log_dir" 2>/dev/null && chmod 700 "$log_dir"
    fi
    # P0 修复: 使用 flock 防止并发写入竞态
    (
      flock -w 5 200 2>/dev/null || true
      echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
      # 确保日志文件权限安全（仅当前用户可读写）
      chmod 600 "$LOG_FILE" 2>/dev/null || true
    ) 200>"${LOG_FILE}.lock"
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
# P1 修复: 使用 mkdir 原子操作替代文件创建，避免 TOCTOU 竞态
acquire_lock() {
  local retries=0
  local lock_dir="${LOCK_FILE}.d"

  while [[ $retries -lt $LOCK_MAX_RETRIES ]]; do
    # 检查死锁
    if is_lock_stale; then
      log_warn "发现过期锁，强制清理"
      rm -rf "$lock_dir" "$LOCK_FILE" 2>/dev/null
    fi

    # P1 修复: 使用 mkdir 原子操作获取锁（mkdir 是原子的）
    if mkdir "$lock_dir" 2>/dev/null; then
      # mkdir 成功，写入锁信息
      echo "PID: $$
TASK_ID: ${TASK_ID:-unknown}
STARTED_AT: $(date -Iseconds)" > "$LOCK_FILE"
      chmod 600 "$LOCK_FILE" 2>/dev/null

      # P1 修复: 验证写入的 PID 是否正确（防止写入竞态）
      local written_pid
      written_pid=$(grep -oP 'PID: \K\d+' "$LOCK_FILE" 2>/dev/null)
      if [[ "$written_pid" != "$$" ]]; then
        log_warn "锁 PID 验证失败 (expected: $$, got: $written_pid)"
        rm -rf "$lock_dir" 2>/dev/null
        retries=$((retries + 1))
        sleep 1
        continue
      fi

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
# P1 修复: 同时清理锁目录
release_lock() {
  local lock_dir="${LOCK_FILE}.d"
  if [[ -f "$LOCK_FILE" ]]; then
    local holder_pid=$(grep -oP 'PID: \K\d+' "$LOCK_FILE" 2>/dev/null)
    # 只有锁持有者才能释放
    if [[ "$holder_pid" == "$$" ]]; then
      rm -f "$LOCK_FILE"
      rm -rf "$lock_dir" 2>/dev/null
      log_info "释放锁成功 (PID: $$)"
    else
      log_debug "锁不属于当前进程 (holder: $holder_pid, current: $$)，不释放"
    fi
  fi
}

# ============================================================
# 目录管理
# ============================================================

# P2: 检查磁盘空间
# 参数: $1=路径, $2=最小空间(MB，默认100)
# 返回: 0=足够, 1=不足
check_disk_space() {
  local path="$1"
  local min_mb="${2:-100}"
  local available

  available=$(df -m "$path" 2>/dev/null | awk 'NR==2 {print $4}')
  if [[ -z "$available" ]]; then
    log_warn "无法获取 $path 的磁盘空间信息"
    return 0  # 无法获取时不阻塞
  fi

  if [[ "$available" -lt "$min_mb" ]]; then
    log_error "磁盘空间不足: ${available}MB < ${min_mb}MB (路径: $path)"
    return 1
  fi

  log_debug "磁盘空间充足: ${available}MB (路径: $path)"
  return 0
}

# 创建运行目录（使用 flock 保护，防止竞态条件）
# 参数: $1=run_id
# 返回: 运行目录路径（失败时返回空字符串并返回非零状态）
create_run_dir() {
  local run_id="$1"
  local run_dir="$RUNS_DIR/$run_id"
  local lock_file="$LOCKS_DIR/run_dir_create.lock"

  # 确保锁目录存在
  mkdir -p "$LOCKS_DIR" 2>/dev/null || true

  # 使用 flock 进行原子化目录创建（P0: 防止竞态条件）
  (
    flock -w 10 200 || {
      log_error "获取目录创建锁超时"
      return 1
    }

    # P2 修复: 添加返回值检查和权限验证
    if ! mkdir -p "$run_dir/logs" 2>/dev/null; then
      log_error "无法创建目录: $run_dir/logs"
      return 1
    fi

    if ! mkdir -p "$run_dir/screenshots" 2>/dev/null; then
      log_error "无法创建目录: $run_dir/screenshots"
      return 1
    fi

    # 验证目录可写
    if [[ ! -w "$run_dir" ]]; then
      log_error "目录不可写: $run_dir"
      return 1
    fi

    # 设置安全权限（仅当前用户可访问）
    chmod 700 "$run_dir" 2>/dev/null || {
      log_warn "无法设置目录权限: $run_dir"
    }

  ) 200>"$lock_file"

  # 检查子 shell 的退出状态
  local exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    return $exit_code
  fi

  echo "$run_dir"
}

# 生成运行 ID
# 格式: YYYYMMDD-HHMMSS-RANDOM
generate_run_id() {
  local timestamp=$(date '+%Y%m%d-%H%M%S')
  local random=$(head -c 500 /dev/urandom | tr -dc 'a-z0-9' | head -c 6)
  echo "${timestamp}-${random}"
}

# ============================================================
# Notion API
# ============================================================

# 加载 secrets
# P0 修复: 权限不安全时 return 1 而非仅警告
load_secrets() {
  local secrets_file="$WORKFLOWS_DIR/.secrets"
  if [[ -f "$secrets_file" ]]; then
    # P0 修复: 检查文件权限，拒绝过于宽松的权限
    local perms
    perms=$(stat -c %a "$secrets_file" 2>/dev/null || stat -f %Lp "$secrets_file" 2>/dev/null)
    if [[ "$perms" != "600" && "$perms" != "400" ]]; then
      log_error "Secrets 文件权限不安全 ($perms)，必须设置为 600 或 400"
      log_error "请运行: chmod 600 $secrets_file"
      return 1
    fi
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

  # P0 修复: 安全创建临时文件，检查返回值并设置权限
  local curl_err_file
  curl_err_file=$(mktemp -t notion-curl-err.XXXXXX 2>/dev/null)
  if [[ -z "$curl_err_file" || ! -f "$curl_err_file" ]]; then
    log_error "无法创建临时文件用于 curl 错误诊断"
    return 1
  fi
  chmod 600 "$curl_err_file" 2>/dev/null || {
    rm -f "$curl_err_file"
    log_error "无法设置临时文件权限"
    return 1
  }
  trap "rm -f '$curl_err_file'" RETURN

  # P1 修复: 获取页面属性（带重试，不重试 401/403 认证错误）
  local response=""
  local retries=0
  local max_retries=2
  local http_code=""
  while [[ $retries -lt $max_retries ]]; do
    # P1 修复: 使用 -w 获取 HTTP 状态码，用于判断是否应该重试
    local curl_output
    curl_output=$(curl -s --connect-timeout 10 --max-time 30 -w "\n%{http_code}" \
      "https://api.notion.com/v1/pages/$task_id" \
      -H "Authorization: Bearer $NOTION_API_KEY" \
      -H "Notion-Version: 2022-06-28" \
      -H "Content-Type: application/json" 2>"$curl_err_file")
    http_code=$(echo "$curl_output" | tail -1)
    response=$(echo "$curl_output" | sed '$d')

    # 成功
    if [[ "$http_code" == "200" ]]; then
      break
    fi

    # P1 修复: 401/403 认证错误不重试
    if [[ "$http_code" == "401" || "$http_code" == "403" ]]; then
      log_error "Notion API 认证失败 (HTTP $http_code)，不重试"
      return 1
    fi

    retries=$((retries + 1))
    if [[ $retries -lt $max_retries ]]; then
      local curl_err
      curl_err=$(cat "$curl_err_file" 2>/dev/null | head -c 200)
      log_warn "获取 Notion 页面失败 (HTTP $http_code)，重试 $retries/$max_retries... (错误: ${curl_err:-unknown})"
      sleep 2
    fi
  done

  if [[ -z "$response" ]]; then
    local curl_err
    curl_err=$(cat "$curl_err_file" 2>/dev/null | head -c 500)
    log_error "无法获取 Notion 任务: $task_id (错误: ${curl_err:-unknown})"
    return 1
  fi

  # P1 修复: 获取页面内容（blocks，带重试，不重试 401/403）
  local blocks=""
  retries=0
  while [[ $retries -lt $max_retries ]]; do
    local blocks_output
    blocks_output=$(curl -s --connect-timeout 10 --max-time 30 -w "\n%{http_code}" \
      "https://api.notion.com/v1/blocks/$task_id/children" \
      -H "Authorization: Bearer $NOTION_API_KEY" \
      -H "Notion-Version: 2022-06-28" 2>"$curl_err_file")
    http_code=$(echo "$blocks_output" | tail -1)
    blocks=$(echo "$blocks_output" | sed '$d')

    # 成功
    if [[ "$http_code" == "200" ]]; then
      break
    fi

    # P1 修复: 401/403 认证错误不重试
    if [[ "$http_code" == "401" || "$http_code" == "403" ]]; then
      log_error "Notion API blocks 认证失败 (HTTP $http_code)，不重试"
      return 1
    fi

    retries=$((retries + 1))
    if [[ $retries -lt $max_retries ]]; then
      local curl_err
      curl_err=$(cat "$curl_err_file" 2>/dev/null | head -c 200)
      log_warn "获取 Notion blocks 失败 (HTTP $http_code)，重试 $retries/$max_retries... (错误: ${curl_err:-unknown})"
      sleep 2
    fi
  done

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
    ' 2>/dev/null)
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

  local retries=0
  local max_retries=2
  local success=false

  local json_payload
  json_payload=$(jq -n --arg status "$status" '{properties: {Status: {status: {name: $status}}}}')

  while [[ $retries -lt $max_retries ]]; do
    if curl -sf --connect-timeout 10 --max-time 30 -X PATCH "https://api.notion.com/v1/pages/$task_id" \
      -H "Authorization: Bearer $NOTION_API_KEY" \
      -H "Notion-Version: 2022-06-28" \
      -H "Content-Type: application/json" \
      -d "$json_payload" > /dev/null 2>&1; then
      success=true
      break
    fi
    retries=$((retries + 1))
    [[ $retries -lt $max_retries ]] && { log_warn "更新 Notion 状态失败，重试 $retries/$max_retries..."; sleep 2; }
  done

  if [[ "$success" == "true" ]]; then
    log_info "更新 Notion 状态: $status"
    return 0
  else
    log_error "更新 Notion 状态失败 (已重试 $max_retries 次)"
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

  if curl -sf --connect-timeout 10 --max-time 30 -X POST "$FEISHU_BOT_WEBHOOK" \
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

  if curl -sf --connect-timeout 10 --max-time 30 -X POST "$FEISHU_BOT_WEBHOOK" \
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

  # 限制 env.sh 文件权限（可能包含敏感信息）
  chmod 600 "$env_file"

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
# P1 修复: 添加完整错误处理
create_feature_branch() {
  local task_id="$1"
  local branch_name="feature/$task_id"

  # P1 修复: 验证参数
  if [[ -z "$task_id" ]]; then
    log_error "task_id 不能为空"
    return 1
  fi

  # P1 修复: 验证 PROJECT_DIR 存在且是 git 仓库
  if [[ ! -d "$PROJECT_DIR/.git" ]]; then
    log_error "PROJECT_DIR 不是有效的 Git 仓库: $PROJECT_DIR"
    return 1
  fi

  cd "$PROJECT_DIR" || {
    log_error "无法进入项目目录: $PROJECT_DIR"
    return 1
  }

  # P1 修复: 切换到基础分支并拉取最新（支持 develop/main/master），添加错误处理
  log_info "切换到基础分支..."
  local checkout_success=false
  if git checkout develop >/dev/null 2>&1; then
    checkout_success=true
  elif git checkout main >/dev/null 2>&1; then
    checkout_success=true
  elif git checkout master >/dev/null 2>&1; then
    checkout_success=true
  fi

  if [[ "$checkout_success" != "true" ]]; then
    log_error "无法切换到基础分支 (develop/main/master)"
    return 1
  fi

  # 记录当前基础分支
  local base_branch
  base_branch=$(git branch --show-current)
  if [[ -z "$base_branch" ]]; then
    log_error "无法获取当前分支名称"
    return 1
  fi

  # P1 修复: 拉取最新代码，失败时警告但不中断
  if ! git pull origin "$base_branch" >/dev/null 2>&1; then
    log_warn "无法从 origin/$base_branch 拉取最新代码，继续使用本地版本"
  fi

  # 检查分支是否已存在
  if git show-ref --verify --quiet "refs/heads/$branch_name"; then
    log_info "分支已存在，切换并更新: $branch_name"
    if ! git checkout "$branch_name" >/dev/null 2>&1; then
      log_error "无法切换到分支: $branch_name"
      return 1
    fi
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
    if ! git checkout -b "$branch_name" >/dev/null 2>&1; then
      log_error "无法创建分支: $branch_name"
      return 1
    fi
  fi

  # P1 修复: 验证当前分支是否正确
  local current_branch
  current_branch=$(git branch --show-current)
  if [[ "$current_branch" != "$branch_name" ]]; then
    log_error "分支切换验证失败: 期望 $branch_name，实际 $current_branch"
    return 1
  fi

  echo "$branch_name"
}

# ============================================================
# 导出函数（供其他脚本使用）
# ============================================================
# 注意: cleanup_on_exit 和 setup_cleanup_trap 已移至 main.sh
# main.sh 中有完整的进程管理和清理逻辑，避免重复定义
export -f _log log_info log_warn log_error log_debug
export -f is_lock_stale acquire_lock release_lock
export -f check_disk_space create_run_dir generate_run_id
export -f load_secrets fetch_notion_task update_notion_status
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
