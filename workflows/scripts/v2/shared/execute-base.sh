#!/bin/bash
#
# 执行器公共基础脚本
# 提供所有执行器共用的：参数解析、环境加载、工具函数、结果处理
#
# 用法: 在各执行器中 source 此文件，然后实现特定逻辑
#
# 示例:
#   source "$SHARED_DIR/execute-base.sh"
#   execute_task  # 实现自己的执行逻辑
#   save_result   # 保存结果
#

# ============================================================
# 基础设置
# ============================================================

set -e
set -o pipefail

# v1.1: 固定位置的脚本目录
FIXED_DIR="/home/xx/bin/ai-factory-v2"
SHARED_DIR="$FIXED_DIR"  # 兼容旧代码引用
WORKFLOWS_DIR="/home/xx/dev/zenithjoy-autopilot/workflows"
PROJECT_DIR="/home/xx/dev/zenithjoy-autopilot"

# 加载工具函数
source "$FIXED_DIR/utils.sh"
source "$FIXED_DIR/screenshot-utils.sh"

# 加载 secrets
load_secrets

# ============================================================
# 工具函数
# ============================================================

# HTML 转义：防止 XSS 和 HTML 注入
# 处理: & < > " ' \ 换行符
html_escape() {
  local input="$1"
  # 使用 printf + sed 处理特殊字符
  # 1. 先转义 & 符号（必须第一个处理，否则后续转义产生的 & 会被再次转义）
  # 2. 转义反斜杠
  # 3. 转义其他 HTML 特殊字符
  # 4. 转义换行符为 <br>
  printf '%s' "$input" | sed \
    -e 's/&/\&amp;/g' \
    -e 's/\\/\&#92;/g' \
    -e 's/</\&lt;/g' \
    -e 's/>/\&gt;/g' \
    -e 's/"/\&quot;/g' \
    -e "s/'/\&#39;/g" \
    -e ':a;N;$!ba;s/\n/<br>/g'
}

# 检查磁盘空间（至少需要指定 MB）
check_disk_space() {
  local path="$1"
  local min_mb="${2:-100}"
  local available
  available=$(df -m "$path" 2>/dev/null | awk 'NR==2 {print $4}')
  if [[ -n "$available" && "$available" -lt "$min_mb" ]]; then
    log_error "磁盘空间不足: ${available}MB < ${min_mb}MB"
    return 1
  fi
  return 0
}

# 安全读取 JSON 字段
# 验证 field 格式防止 jq 注入
json_get() {
  local file="$1"
  local field="$2"
  local default="${3:-}"
  local value

  # 检查文件是否存在
  if [[ ! -f "$file" ]]; then
    log_error "json_get: 文件不存在: $file"
    echo "$default"
    return 1
  fi

  # 验证 field 格式：只允许以 . 开头的安全 jq 表达式
  # 允许的格式: .key, .key.subkey, .key[0], .key[0].subkey, .key[0][1].subkey
  # 禁止: 函数调用、管道、分号、括号表达式等
  if [[ ! "$field" =~ ^(\.[a-zA-Z_][a-zA-Z0-9_]*(\[[0-9]+\])*)+$ ]]; then
    log_error "json_get: 非法的字段表达式: $field"
    echo "$default"
    return 1
  fi

  value=$(jq -r "$field // empty" "$file" 2>/dev/null)
  echo "${value:-$default}"
}

# ============================================================
# 参数解析
# ============================================================

parse_execute_args() {
  RUN_ID="${1:-}"
  TASK_INFO_PATH="${2:-}"

  if [[ -z "$RUN_ID" || -z "$TASK_INFO_PATH" ]]; then
    log_error "用法: execute.sh <run_id> <task_info_path>"
    # WORK_DIR 尚未定义，跳过 error.json
    exit 1
  fi

  # 验证 RUN_ID 不包含路径遍历字符
  # 只允许：字母、数字、下划线、连字符
  if [[ "$RUN_ID" =~ \.\./ ]] || [[ "$RUN_ID" =~ / ]] || [[ ! "$RUN_ID" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    log_error "非法的 RUN_ID (包含路径遍历字符或非法字符): $RUN_ID"
    # WORK_DIR 尚未定义（因为 RUN_ID 非法），跳过 error.json
    exit 1
  fi

  WORK_DIR="/home/xx/data/runs/$RUN_ID"
  LOG_FILE="$WORK_DIR/logs/execute.log"

  # 读取任务信息
  if [[ ! -f "$TASK_INFO_PATH" ]]; then
    log_error "任务信息文件不存在: $TASK_INFO_PATH"
    # 此时 WORK_DIR 已定义，保存 error.json
    if [[ -n "${WORK_DIR:-}" ]] && [[ -d "$WORK_DIR" ]]; then
      printf '{"success":false,"error":"task_info_not_found","message":"任务信息文件不存在: %s"}' "$TASK_INFO_PATH" > "$WORK_DIR/error.json"
    fi
    exit 1
  fi

  # P0: 验证 task_info.json 是有效的 JSON 格式
  if ! jq empty "$TASK_INFO_PATH" 2>/dev/null; then
    log_error "task_info.json 格式无效，不是有效的 JSON"
    log_error "文件路径: $TASK_INFO_PATH"
    # 记录文件内容前 200 字符用于调试
    local file_preview
    file_preview=$(head -c 200 "$TASK_INFO_PATH" 2>/dev/null || echo "[无法读取文件]")
    log_error "文件内容预览: $file_preview"

    # 保存错误信息
    if [[ -d "$WORK_DIR" ]]; then
      jq -n --arg path "$TASK_INFO_PATH" --arg preview "$file_preview" \
        '{error: "invalid_task_info_json", message: "task_info.json 格式无效", path: $path, preview: $preview}' \
        > "$WORK_DIR/error.json" 2>/dev/null || true
    fi
    exit 1
  fi

  TASK_ID=$(json_get "$TASK_INFO_PATH" '.task_id')
  TASK_NAME=$(json_get "$TASK_INFO_PATH" '.task_name')
  TASK_CONTENT=$(json_get "$TASK_INFO_PATH" '.content')
  CODING_TYPE=$(json_get "$TASK_INFO_PATH" '.coding_type' 'unknown')

  # P0: 验证必要字段不为空
  if [[ -z "$TASK_ID" || "$TASK_ID" == "null" ]]; then
    log_error "task_info.json 缺少必要字段: task_id"
    if [[ -d "$WORK_DIR" ]]; then
      jq -n '{error: "missing_task_id", message: "task_info.json 缺少 task_id 字段"}' \
        > "$WORK_DIR/error.json" 2>/dev/null || true
    fi
    exit 1
  fi

  if [[ -z "$TASK_NAME" || "$TASK_NAME" == "null" ]]; then
    log_error "task_info.json 缺少必要字段: task_name"
    if [[ -d "$WORK_DIR" ]]; then
      jq -n '{error: "missing_task_name", message: "task_info.json 缺少 task_name 字段"}' \
        > "$WORK_DIR/error.json" 2>/dev/null || true
    fi
    exit 1
  fi

  # 导出给子脚本使用
  export RUN_ID TASK_INFO_PATH WORK_DIR LOG_FILE
  export TASK_ID TASK_NAME TASK_CONTENT CODING_TYPE
  export SHARED_DIR V2_DIR SCRIPTS_DIR WORKFLOWS_DIR PROJECT_DIR
}

# ============================================================
# 稳定性验证跳过检查
# ============================================================

# 检查是否应该跳过执行（已有成功结果）
# 返回: 0=应该跳过, 1=需要执行
check_skip_execution() {
  local artifact_type="${1:-}"  # 可选：期望的产出类型

  if [[ ! -f "$WORK_DIR/result.json" ]]; then
    return 1  # 没有结果文件，需要执行
  fi

  local existing_success
  existing_success=$(json_get "$WORK_DIR/result.json" '.success')

  if [[ "$existing_success" != "true" ]]; then
    return 1  # 之前执行失败，需要重新执行
  fi

  # 检查产出是否存在
  local existing_id
  existing_id=$(json_get "$WORK_DIR/result.json" '.artifacts[0].id')

  if [[ -z "$existing_id" ]]; then
    return 1  # 没有产出 ID，需要执行
  fi

  log_info "已存在成功的执行结果 (ID: $existing_id)，跳过重复执行"
  log_info "这是稳定性验证，只需重新验证质检"

  # 设置全局变量供后续使用
  SKIP_EXECUTION=true
  EXISTING_ARTIFACT_ID="$existing_id"
  EXISTING_ARTIFACT_NAME=$(json_get "$WORK_DIR/result.json" '.artifacts[0].name')
  EXISTING_ARTIFACT_TYPE=$(json_get "$WORK_DIR/result.json" '.artifacts[0].type')

  return 0  # 应该跳过
}

# 输出跳过执行的结果
output_skip_result() {
  jq -n \
    --argjson success true \
    --arg id "$EXISTING_ARTIFACT_ID" \
    --arg name "$EXISTING_ARTIFACT_NAME" \
    --arg type "$EXISTING_ARTIFACT_TYPE" \
    --argjson skipped true \
    --arg reason "stability_verification" \
    '{
      success: $success,
      artifact_id: $id,
      artifact_name: $name,
      artifact_type: $type,
      skipped: $skipped,
      reason: $reason
    }'
}

# ============================================================
# Claude 调用
# ============================================================

# 调用 Claude 执行任务
# 参数: $1=prompt, $2=timeout_seconds (默认 600)
# 返回: Claude 输出存储在 CLAUDE_OUTPUT 变量
# 安全性: 使用临时文件传递 prompt，防止命令注入
call_claude() {
  local prompt="$1"
  local timeout_sec="${2:-600}"
  local prompt_file=""

  CLAUDE_EXIT=0
  CLAUDE_OUTPUT=""

  if [[ "${TEST_MODE:-}" == "1" ]]; then
    local test_timeout="${TEST_TIMEOUT:-300}"
    if [[ "$test_timeout" -lt 5 ]]; then
      log_warn "[TEST_MODE] 模拟 Claude 超时 (TEST_TIMEOUT=$test_timeout < 5)"
      CLAUDE_OUTPUT='{"success": false, "error": "timeout", "message": "模拟 Claude 调用超时"}'
      CLAUDE_EXIT=124
      return 124
    fi

    log_info "[TEST_MODE] 模拟 Claude 调用"
    CLAUDE_OUTPUT='{"success": true, "message": "mock response"}'
    return 0
  fi

  log_info "调用 Claude (timeout: ${timeout_sec}s)..."

  # 使用 WORK_DIR 存储临时文件，防止 TMPDIR 被注入
  # WORK_DIR 由 parse_execute_args 设置，是可信的安全路径
  prompt_file=$(mktemp "$WORK_DIR/claude_prompt.XXXXXX") || {
    log_error "无法创建临时文件"
    return 1
  }

  # 确保临时文件在函数退出时清理
  trap 'rm -f "$prompt_file" 2>/dev/null' RETURN

  # 写入 prompt 到临时文件
  printf '%s' "$prompt" > "$prompt_file"

  # 使用 cat 从文件读取 prompt，避免命令行参数注入
  CLAUDE_OUTPUT=$(cd /home/xx/data/factory-workspace && \
    timeout --foreground -k 10 "$timeout_sec" \
    bash -c 'claude -p "$(cat "$1")" --add-dir "$2" --model "sonnet" 2>&1' \
    _ "$prompt_file" "$WORKFLOWS_DIR") || CLAUDE_EXIT=$?

  if [[ $CLAUDE_EXIT -ne 0 ]]; then
    log_error "Claude 调用失败 (exit: $CLAUDE_EXIT)"
    # 清理敏感信息后保存错误日志
    # 移除可能的 API 密钥、token、密码、凭据等敏感信息
    local sanitized_output
    sanitized_output=$(printf '%s' "$CLAUDE_OUTPUT" | sed \
      -e 's/\(api[_-]*key["\x27]*[[:space:]]*[:=][[:space:]]*\)["\x27]*[a-zA-Z0-9_-]\{20,\}["\x27]*/\1[REDACTED]/gi' \
      -e 's/\(token["\x27]*[[:space:]]*[:=][[:space:]]*\)["\x27]*[a-zA-Z0-9_-]\{20,\}["\x27]*/\1[REDACTED]/gi' \
      -e 's/\(password["\x27]*[[:space:]]*[:=][[:space:]]*\)["\x27]*[^"\x27[:space:]]\{1,\}["\x27]*/\1[REDACTED]/gi' \
      -e 's/\(secret["\x27]*[[:space:]]*[:=][[:space:]]*\)["\x27]*[a-zA-Z0-9_-]\{20,\}["\x27]*/\1[REDACTED]/gi' \
      -e 's/Bearer [a-zA-Z0-9._-]\{20,\}/Bearer [REDACTED]/gi' \
      -e 's/\(AWS_ACCESS_KEY_ID["\x27]*[[:space:]]*[:=][[:space:]]*\)["\x27]*[A-Z0-9]\{16,\}["\x27]*/\1[REDACTED]/gi' \
      -e 's/\(AWS_SECRET_ACCESS_KEY["\x27]*[[:space:]]*[:=][[:space:]]*\)["\x27]*[a-zA-Z0-9/+=]\{20,\}["\x27]*/\1[REDACTED]/gi' \
      -e 's/\(GITHUB_TOKEN["\x27]*[[:space:]]*[:=][[:space:]]*\)["\x27]*[a-zA-Z0-9_-]\{20,\}["\x27]*/\1[REDACTED]/gi' \
      -e 's/\(OPENAI_API_KEY["\x27]*[[:space:]]*[:=][[:space:]]*\)["\x27]*sk-[a-zA-Z0-9]\{20,\}["\x27]*/\1[REDACTED]/gi' \
      -e 's/\(ANTHROPIC_API_KEY["\x27]*[[:space:]]*[:=][[:space:]]*\)["\x27]*sk-ant-[a-zA-Z0-9-]\{20,\}["\x27]*/\1[REDACTED]/gi' \
      -e 's/\(PRIVATE_KEY["\x27]*[[:space:]]*[:=][[:space:]]*\)["\x27]*[^"\x27]\{20,\}["\x27]*/\1[REDACTED]/gi' \
      -e 's/\(credential[s]*["\x27]*[[:space:]]*[:=][[:space:]]*\)["\x27]*[a-zA-Z0-9_-]\{20,\}["\x27]*/\1[REDACTED]/gi')
    printf '%s\n' "$sanitized_output" > "$WORK_DIR/claude_error_debug.txt"
    # 设置文件权限为仅所有者可读写
    chmod 600 "$WORK_DIR/claude_error_debug.txt"
    return 1
  fi

  # 检测 Claude 拒绝执行的模式
  local refusal_detected=false
  local refusal_patterns=(
    "I cannot"
    "I'm unable to"
    "I won't be able to"
    "I can't help"
    "I'm not able to"
    "无法完成"
    "不能执行"
  )

  for pattern in "${refusal_patterns[@]}"; do
    if echo "$CLAUDE_OUTPUT" | grep -qi "$pattern"; then
      refusal_detected=true
      log_warn "检测到 Claude 可能拒绝执行: 匹配模式 '$pattern'"
      break
    fi
  done

  if [[ "$refusal_detected" == "true" ]]; then
    log_error "Claude 拒绝执行任务"
    # 保存拒绝输出用于调试
    printf '%s\n' "$CLAUDE_OUTPUT" > "$WORK_DIR/claude_refusal_debug.txt"
    chmod 600 "$WORK_DIR/claude_refusal_debug.txt"
    CLAUDE_REFUSAL=true
    export CLAUDE_REFUSAL
    return 1
  fi

  log_info "Claude 调用成功"
  return 0
}

# 从 Claude 输出中提取 JSON
# 更健壮的 JSON 提取逻辑：
# 1. 先尝试直接解析整个输出
# 2. 尝试提取 markdown 代码块中的 JSON
# 3. 尝试使用正则提取最外层的 JSON 对象/数组
# 4. 最后尝试 jq -s 'last'（可能不是期望的对象）
# 5. 检测输出截断情况
extract_json_from_claude() {
  local output="$1"
  local extracted=""

  # 先尝试直接解析（Claude 有时只返回纯 JSON）
  if echo "$output" | jq empty 2>/dev/null; then
    echo "$output"
    return 0
  fi

  # 尝试提取 markdown ```json 代码块中的内容
  local json_block
  json_block=$(echo "$output" | sed -n '/```json/,/```/{/```json/d;/```/d;p}')
  if [[ -n "$json_block" ]] && echo "$json_block" | jq empty 2>/dev/null; then
    echo "$json_block"
    return 0
  fi

  # 尝试使用 grep 提取以 { 开头到最后一个 } 的内容（最外层对象）
  local json_obj
  json_obj=$(echo "$output" | grep -ozP '\{[\s\S]*\}' | tr '\0' '\n' | tail -1)
  if [[ -n "$json_obj" ]] && echo "$json_obj" | jq empty 2>/dev/null; then
    echo "$json_obj"
    return 0
  fi

  # 尝试提取 JSON 数组
  local json_arr
  json_arr=$(echo "$output" | grep -ozP '\[[\s\S]*\]' | tr '\0' '\n' | tail -1)
  if [[ -n "$json_arr" ]] && echo "$json_arr" | jq empty 2>/dev/null; then
    echo "$json_arr"
    return 0
  fi

  # 最后尝试移除 markdown 代码块后使用 jq -s 'last'
  local cleaned
  cleaned=$(echo "$output" | sed 's/```json//g; s/```//g')
  extracted=$(echo "$cleaned" | jq -s 'if length > 0 then last else empty end' 2>/dev/null) || true

  if [[ -n "$extracted" ]] && [[ "$extracted" != "null" ]] && echo "$extracted" | jq empty 2>/dev/null; then
    echo "$extracted"
    return 0
  fi

  # 检测输出截断：检查 JSON 是否有未匹配的括号
  local open_braces close_braces open_brackets close_brackets
  open_braces=$(echo "$output" | tr -cd '{' | wc -c)
  close_braces=$(echo "$output" | tr -cd '}' | wc -c)
  open_brackets=$(echo "$output" | tr -cd '[' | wc -c)
  close_brackets=$(echo "$output" | tr -cd ']' | wc -c)

  # 检查是否以 { 或 [ 开始但没有匹配的结束符
  local trimmed_output
  trimmed_output=$(echo "$output" | sed 's/^[[:space:]]*//' | head -c 1)

  if [[ "$trimmed_output" == "{" && "$open_braces" -gt "$close_braces" ]]; then
    log_error "检测到 Claude 输出可能被截断: JSON 对象未闭合 (开括号: $open_braces, 闭括号: $close_braces)"
    CLAUDE_TRUNCATED=true
    export CLAUDE_TRUNCATED
    return 1
  fi

  if [[ "$trimmed_output" == "[" && "$open_brackets" -gt "$close_brackets" ]]; then
    log_error "检测到 Claude 输出可能被截断: JSON 数组未闭合 (开括号: $open_brackets, 闭括号: $close_brackets)"
    CLAUDE_TRUNCATED=true
    export CLAUDE_TRUNCATED
    return 1
  fi

  # 检查 markdown 代码块中是否有未闭合的 JSON
  if echo "$output" | grep -q '```json'; then
    local json_in_block
    json_in_block=$(echo "$output" | sed -n '/```json/,/```/p')
    local block_open_braces block_close_braces
    block_open_braces=$(echo "$json_in_block" | tr -cd '{' | wc -c)
    block_close_braces=$(echo "$json_in_block" | tr -cd '}' | wc -c)

    if [[ "$block_open_braces" -gt "$block_close_braces" ]]; then
      log_error "检测到 Claude 输出可能被截断: 代码块中 JSON 未闭合"
      CLAUDE_TRUNCATED=true
      export CLAUDE_TRUNCATED
      return 1
    fi
  fi

  log_error "无法从 Claude 输出中提取有效 JSON"
  return 1
}

# ============================================================
# 结果保存
# ============================================================

# 保存执行结果到 result.json
# 参数: 通过环境变量传入
#   RESULT_SUCCESS (true/false)
#   RESULT_ARTIFACTS (JSON 数组字符串)
#   RESULT_EXTRA (可选，额外字段 JSON 对象)
# 安全性:
#   - 验证 RESULT_SUCCESS 是合法布尔值
#   - 使用临时文件 + 原子 mv 写入
save_result() {
  local success="${RESULT_SUCCESS:-true}"
  local artifacts="${RESULT_ARTIFACTS:-"[]"}"
  local extra="${RESULT_EXTRA:-"{}"}"

  # 验证 success 是合法的布尔值
  if [[ "$success" != "true" && "$success" != "false" ]]; then
    log_error "RESULT_SUCCESS 必须是 'true' 或 'false'，当前值: $success"
    return 1
  fi

  # 验证 extra 是有效的 JSON 对象
  if ! echo "$extra" | jq -e 'type == "object"' >/dev/null 2>&1; then
    log_error "RESULT_EXTRA 必须是有效的 JSON 对象，当前值: $extra"
    return 1
  fi

  # 验证 artifacts 是有效的 JSON 数组
  if ! echo "$artifacts" | jq -e 'type == "array"' >/dev/null 2>&1; then
    log_error "RESULT_ARTIFACTS 必须是有效的 JSON 数组，当前值: $artifacts"
    return 1
  fi

  local result_json
  result_json=$(jq -n \
    --argjson success "$success" \
    --argjson artifacts "$artifacts" \
    --argjson extra "$extra" \
    --arg created_at "$(date -Iseconds)" \
    '$extra + {
      success: $success,
      artifacts: $artifacts,
      created_at: $created_at
    }')

  # 使用临时文件 + 原子 mv 写入，防止写入中断导致文件损坏
  local temp_file
  temp_file=$(mktemp "$WORK_DIR/result.json.XXXXXX") || {
    log_error "无法创建临时文件"
    return 1
  }

  if ! printf '%s\n' "$result_json" > "$temp_file"; then
    log_error "无法写入临时文件"
    rm -f "$temp_file"
    return 1
  fi

  if ! mv "$temp_file" "$WORK_DIR/result.json"; then
    log_error "无法原子移动到 result.json"
    rm -f "$temp_file"
    return 1
  fi

  # 设置文件权限为仅所有者可读写
  chmod 600 "$WORK_DIR/result.json"

  log_info "结果已保存: $WORK_DIR/result.json"
  return 0
}

# ============================================================
# 截图报告生成
# ============================================================

# 生成通用执行结果 HTML 报告
# 参数:
#   $1=title - 报告标题（会自动转义）
#   $2=status_icon - 状态图标（会自动转义）
#   $3=main_content_html - 主体内容 HTML
#      注意: 此参数应该是已经过 html_escape 处理的安全 HTML 内容
#      调用者负责确保此内容安全，函数会原样插入
generate_result_report_html() {
  local title="$1"
  local status_icon="$2"
  local main_content="$3"

  # 转义 title 和 status_icon 防止 XSS
  local safe_title safe_status_icon
  safe_title=$(html_escape "$title")
  safe_status_icon=$(html_escape "$status_icon")

  local safe_run_id safe_task_id
  safe_run_id=$(html_escape "$RUN_ID")
  safe_task_id=$(html_escape "$TASK_ID")

  cat <<EOF
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Noto Sans CJK SC', 'WenQuanYi Zen Hei', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 40px;
      color: white;
    }
    .container { max-width: 800px; margin: 0 auto; }
    h1 {
      font-size: 36px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .subtitle {
      font-size: 18px;
      opacity: 0.8;
      margin-bottom: 30px;
    }
    .card {
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
    }
    .card-title {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.7;
      margin-bottom: 8px;
    }
    .card-value {
      font-size: 24px;
      font-weight: bold;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .info-label { opacity: 0.7; }
    .info-value { font-weight: 500; }
    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 14px;
      opacity: 0.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${safe_status_icon} ${safe_title}</h1>
    <div class="subtitle">AI 工厂 v2 执行报告</div>

    ${main_content}

    <div class="card">
      <div class="info-row">
        <span class="info-label">Run ID</span>
        <span class="info-value">${safe_run_id}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Task ID</span>
        <span class="info-value">${safe_task_id}</span>
      </div>
      <div class="info-row">
        <span class="info-label">执行时间</span>
        <span class="info-value">$(date '+%Y-%m-%d %H:%M:%S')</span>
      </div>
    </div>

    <div class="footer">
      Generated by AI Factory v2 | $(date '+%Y-%m-%d %H:%M:%S')
    </div>
  </div>
</body>
</html>
EOF
}

# ============================================================
# 日志输出
# ============================================================

# 打印执行阶段开始日志
log_execute_start() {
  local executor_type="$1"
  log_info "=========================================="
  log_info "$executor_type 执行阶段开始"
  log_info "Run ID: $RUN_ID"
  log_info "Task: $TASK_NAME"
  log_info "=========================================="
}

# 打印执行阶段结束日志
log_execute_end() {
  local executor_type="$1"
  log_info "=========================================="
  log_info "$executor_type 执行阶段完成"
  log_info "=========================================="
}

# ============================================================
# 导出函数
# ============================================================
export -f html_escape check_disk_space json_get
export -f parse_execute_args
export -f check_skip_execution output_skip_result
export -f call_claude extract_json_from_claude
export -f save_result generate_result_report_html
export -f log_execute_start log_execute_end
