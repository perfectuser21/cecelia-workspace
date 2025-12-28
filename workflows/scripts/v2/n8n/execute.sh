#!/bin/bash
#
# n8n 执行器
# 负责：模板匹配、生成 Workflow JSON、调用 n8n API 创建、激活
#
# 用法: execute.sh <run_id> <task_info_path>
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED_DIR="$(dirname "$SCRIPT_DIR")/shared"

# 加载公共基础
source "$SHARED_DIR/execute-base.sh"

# 解析参数
parse_execute_args "$@"

# 打印开始日志
log_execute_start "n8n"

# ============================================================
# 检查是否跳过执行（稳定性验证）
# ============================================================
if check_skip_execution "workflow"; then
  output_skip_result
  exit 0
fi

# ============================================================
# [1/5] 模板匹配
# ============================================================
log_info "[1/5] 模板匹配..."

# 模板匹配函数
match_template() {
  local task_name="$1"
  local task_desc="$2"
  local combined="${task_name} ${task_desc}"
  local combined_lower=$(echo "$combined" | tr '[:upper:]' '[:lower:]')

  # 高置信度关键词直接匹配
  if echo "$combined_lower" | grep -qiE "github.*star|star.*github"; then
    echo "github-api"
    return
  fi

  if echo "$combined_lower" | grep -qiE "vps.*健康|健康.*检查.*磁盘|磁盘.*空间.*告警"; then
    echo "vps-health-check"
    return
  fi

  if echo "$combined_lower" | grep -qiE "ssh|远程执行|服务器命令"; then
    echo "ssh-execution"
    return
  fi

  if echo "$combined_lower" | grep -qiE "每天|每小时|每分钟|定时|cron|schedule"; then
    echo "scheduled-task"
    return
  fi

  if echo "$combined_lower" | grep -qiE "通知|飞书|告警|alert|notification"; then
    echo "notification"
    return
  fi

  if echo "$combined_lower" | grep -qiE "webhook|ping|pong|api端点"; then
    echo "webhook-response"
    return
  fi

  if echo "$combined_lower" | grep -qiE "数据处理|etl|database|postgres"; then
    echo "data-processing"
    return
  fi

  # 无匹配
  echo ""
}

TEMPLATE_ID=$(match_template "$TASK_NAME" "$TASK_CONTENT")

if [[ -n "$TEMPLATE_ID" ]]; then
  log_info "匹配到模板: $TEMPLATE_ID"
else
  log_info "未匹配到模板，将使用 Claude 生成"
fi

# ============================================================
# [2/5] 生成 Workflow JSON
# ============================================================
log_info "[2/5] 生成 Workflow JSON..."

WORKFLOW_JSON=""

# 如果有模板，加载模板
if [[ -n "$TEMPLATE_ID" ]]; then
  TEMPLATE_FILE="$WORKFLOWS_DIR/templates/$TEMPLATE_ID/template.json"
  if [[ -f "$TEMPLATE_FILE" ]]; then
    log_info "加载模板: $TEMPLATE_FILE"
    WORKFLOW_JSON=$(cat "$TEMPLATE_FILE")

    # 根据任务内容修改模板
    WORKFLOW_JSON=$(echo "$WORKFLOW_JSON" | jq --arg name "$TASK_NAME" '.name = $name') || {
      log_error "jq 处理模板失败"
      WORKFLOW_JSON=""
    }
    if [[ -z "$WORKFLOW_JSON" ]]; then
      log_warn "模板处理后为空，将使用 Claude 生成"
    fi
  fi
fi

# 如果没有模板或模板加载失败，使用 Claude 生成
if [[ -z "$WORKFLOW_JSON" ]]; then
  if [[ "${TEST_MODE:-}" == "1" ]]; then
    log_info "[TEST_MODE] 使用 mock Workflow JSON"
    WORKFLOW_JSON=$(jq -n \
      --arg name "$TASK_NAME" \
      '{
        name: $name,
        nodes: [
          {
            id: "trigger-1",
            name: "定时触发器",
            type: "n8n-nodes-base.scheduleTrigger",
            typeVersion: 1,
            position: [250, 300],
            parameters: {
              rule: {
                interval: [{ field: "hours", hoursInterval: 1 }]
              }
            }
          },
          {
            id: "ssh-1",
            name: "检查磁盘空间",
            type: "n8n-nodes-base.ssh",
            typeVersion: 1,
            position: [450, 300],
            parameters: {
              command: "df -h /"
            }
          },
          {
            id: "http-1",
            name: "发送飞书告警",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4,
            position: [650, 300],
            parameters: {
              method: "POST",
              url: "={{ $env.FEISHU_BOT_WEBHOOK }}"
            }
          }
        ],
        connections: {
          "定时触发器": { main: [[{ node: "检查磁盘空间", type: "main", index: 0 }]] },
          "检查磁盘空间": { main: [[{ node: "发送飞书告警", type: "main", index: 0 }]] }
        },
        settings: { executionOrder: "v1" }
      }')
  else
    log_info "使用 Claude 生成 Workflow JSON..."

    PROMPT="根据以下任务描述，生成一个完整的 n8n workflow JSON 结构。

任务名: $TASK_NAME
任务描述:
$TASK_CONTENT

要求：
1. 直接输出有效的 JSON 对象
2. 包含必要的节点：触发器、处理节点、错误处理
3. 节点使用中文命名
4. 确保 connections 正确连接所有节点

输出格式示例：
{
  \"name\": \"任务名称\",
  \"nodes\": [...],
  \"connections\": {...},
  \"settings\": {\"executionOrder\": \"v1\"}
}"

    if ! call_claude "$PROMPT" 600; then
      exit 1
    fi

    WORKFLOW_JSON=$(extract_json_from_claude "$CLAUDE_OUTPUT") || {
      log_error "无法从 Claude 输出中提取有效 JSON"
      echo "$CLAUDE_OUTPUT" > "$WORK_DIR/claude_output_debug.txt"
      exit 1
    }

    log_info "Workflow JSON 生成成功"
  fi
fi

# 检查磁盘空间
check_disk_space "$WORK_DIR" 100 || exit 1

# 保存 Workflow JSON（使用临时文件 + mv 原子写入）
WORKFLOW_JSON_TMP="$WORK_DIR/workflow.json.tmp.$$"
if ! echo "$WORKFLOW_JSON" > "$WORKFLOW_JSON_TMP"; then
  log_error "无法写入临时文件 workflow.json.tmp"
  rm -f "$WORKFLOW_JSON_TMP"
  exit 1
fi
if ! mv "$WORKFLOW_JSON_TMP" "$WORK_DIR/workflow.json"; then
  log_error "无法移动临时文件到 workflow.json"
  rm -f "$WORKFLOW_JSON_TMP"
  exit 1
fi
log_info "Workflow JSON 已保存: $WORK_DIR/workflow.json"

# ============================================================
# [3/5] 调用 n8n API 创建 Workflow
# ============================================================
log_info "[3/5] 创建 Workflow..."

if [[ "${TEST_MODE:-}" == "1" ]]; then
  log_info "[TEST_MODE] 模拟 n8n API 创建"
  WORKFLOW_ID="test-workflow-$(date +%s)-$RANDOM"
  WORKFLOW_NAME=$(echo "$WORKFLOW_JSON" | jq -r '.name // empty')
  [[ -z "$WORKFLOW_NAME" ]] && WORKFLOW_NAME="$TASK_NAME"
  NODE_COUNT=$(echo "$WORKFLOW_JSON" | jq '.nodes | length // 0')
  [[ ! "$NODE_COUNT" =~ ^[0-9]+$ ]] && NODE_COUNT=0
  log_info "Workflow 创建成功: $WORKFLOW_NAME (ID: $WORKFLOW_ID, 节点数: $NODE_COUNT)"

  log_info "[4/5] 激活 Workflow..."
  log_info "[TEST_MODE] 模拟激活成功"
else
  if [[ -z "$N8N_REST_API_KEY" ]]; then
    log_error "N8N_REST_API_KEY 未设置"
    exit 1
  fi

  N8N_API_URL="${N8N_API_URL:-https://zenithjoy21xx.app.n8n.cloud/api/v1}"

  # 过滤 JSON，只保留 API 接受的字段
  FILTERED_JSON=$(echo "$WORKFLOW_JSON" | jq '{
    name: .name,
    nodes: .nodes,
    connections: .connections,
    settings: (.settings // {executionOrder: "v1"})
  }')

  # 验证过滤后的 JSON 有效性
  if ! echo "$FILTERED_JSON" | jq empty 2>/dev/null; then
    log_error "FILTERED_JSON 不是有效的 JSON"
    echo "$FILTERED_JSON" > "$WORK_DIR/filtered_json_error.txt"
    exit 1
  fi

  # 创建 Workflow（带重试）
  retries=0
  max_retries=2
  RESPONSE=""
  HTTP_CODE=""

  while [[ $retries -lt $max_retries ]]; do
    # 添加连接超时和最大时间限制，防止无限挂起
    RESPONSE=$(curl -sf -w "\n%{http_code}" \
      --connect-timeout 10 \
      --max-time 60 \
      -X POST "$N8N_API_URL/workflows" \
      -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
      -H "Content-Type: application/json" \
      -d "$FILTERED_JSON" 2>&1)

    # 更健壮地提取 HTTP_CODE，处理空行情况
    HTTP_CODE=$(echo "$RESPONSE" | grep -E '^[0-9]+$' | tail -n1)

    # 验证 HTTP_CODE 是否为有效数字
    if [[ ! "$HTTP_CODE" =~ ^[0-9]+$ ]]; then
      log_error "n8n API 请求失败，无法获取 HTTP 状态码"
      HTTP_CODE="0"
    fi

    if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]; then
      break
    fi

    retries=$((retries + 1))
    if [[ $retries -lt $max_retries ]]; then
      log_warn "n8n API 调用失败 (HTTP $HTTP_CODE)，重试 $retries/$max_retries"
      # 指数退避: 2^retries 秒 (2, 4, 8...)
      sleep $((2 ** retries))
    fi
  done

  RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')

  if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "201" ]]; then
    log_error "n8n API 创建失败 (HTTP $HTTP_CODE)，已重试 $max_retries 次"
    echo "$RESPONSE_BODY" > "$WORK_DIR/api_error.json"
    exit 1
  fi

  # 验证响应是有效 JSON
  if ! echo "$RESPONSE_BODY" | jq empty 2>/dev/null; then
    log_error "API 返回的不是有效 JSON"
    echo "$RESPONSE_BODY" > "$WORK_DIR/api_error.json"
    exit 1
  fi

  WORKFLOW_ID=$(echo "$RESPONSE_BODY" | jq -r '.id // empty')
  WORKFLOW_NAME=$(echo "$RESPONSE_BODY" | jq -r '.name // empty')
  NODE_COUNT=$(echo "$RESPONSE_BODY" | jq '.nodes | length' 2>/dev/null)

  # 验证 NODE_COUNT 是有效数字
  if [[ -z "$NODE_COUNT" ]] || [[ ! "$NODE_COUNT" =~ ^[0-9]+$ ]]; then
    NODE_COUNT=0
  fi

  # 验证必要字段非空
  if [[ -z "$WORKFLOW_ID" ]]; then
    log_error "API 返回的 workflow id 为空"
    echo "$RESPONSE_BODY" > "$WORK_DIR/api_error.json"
    exit 1
  fi

  # 验证 workflow ID 格式
  if [[ ! "$WORKFLOW_ID" =~ ^[a-zA-Z0-9]+$ ]]; then
    log_error "API 返回的 workflow id 格式无效: $WORKFLOW_ID"
    exit 1
  fi

  [[ -z "$WORKFLOW_NAME" ]] && WORKFLOW_NAME="$TASK_NAME"

  log_info "Workflow 创建成功: $WORKFLOW_NAME (ID: $WORKFLOW_ID, 节点数: $NODE_COUNT)"

  # ============================================================
  # [4/5] 激活 Workflow
  # ============================================================
  log_info "[4/5] 激活 Workflow..."

  activate_ok=false
  for retry in 1 2 3; do
    ACTIVATE_RESPONSE=$(curl -sf --connect-timeout 10 --max-time 30 \
      -X PATCH "$N8N_API_URL/workflows/$WORKFLOW_ID" \
      -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{"active": true}' 2>&1)

    if echo "$ACTIVATE_RESPONSE" | jq -e '.active == true' > /dev/null 2>&1; then
      activate_ok=true
      break
    fi
    [[ $retry -lt 3 ]] && { log_warn "激活失败，重试 $retry/3..."; sleep 2; }
  done

  if [[ "$activate_ok" == "true" ]]; then
    log_info "Workflow 已激活"
  else
    log_warn "Workflow 激活失败"
    ACTIVATION_FAILED=true
  fi
fi

# ============================================================
# 保存结果
# ============================================================
# 如果激活失败，设置 RESULT_SUCCESS=false
if [[ "${ACTIVATION_FAILED:-}" == "true" ]]; then
  RESULT_SUCCESS=false
else
  RESULT_SUCCESS=true
fi

# 确保 NODE_COUNT 是有效数字（用于 jq --argjson）
if [[ ! "$NODE_COUNT" =~ ^[0-9]+$ ]]; then
  NODE_COUNT=0
fi

RESULT_ARTIFACTS=$(jq -n \
  --arg type "workflow" \
  --arg id "$WORKFLOW_ID" \
  --arg name "$WORKFLOW_NAME" \
  --arg template_id "${TEMPLATE_ID:-none}" \
  --argjson node_count "$NODE_COUNT" \
  '[{
    type: $type,
    id: $id,
    name: $name,
    template_used: $template_id,
    node_count: $node_count
  }]')

save_result

# ============================================================
# [5/5] 截图：执行结果证明
# ============================================================
log_info "[5/5] 生成执行结果截图..."

# HTML 转义变量（防止 XSS 和 HTML 注入）
SAFE_WORKFLOW_ID=$(html_escape "$WORKFLOW_ID")
SAFE_WORKFLOW_NAME=$(html_escape "$WORKFLOW_NAME")
SAFE_TEMPLATE_ID=$(html_escape "${TEMPLATE_ID:-}")

MAIN_CONTENT="
<div class=\"grid\">
  <div class=\"card\">
    <div class=\"card-title\">Workflow ID</div>
    <div class=\"card-value\">${SAFE_WORKFLOW_ID}</div>
  </div>
  <div class=\"card\">
    <div class=\"card-title\">节点数量</div>
    <div class=\"card-value\">${NODE_COUNT} 个</div>
  </div>
</div>
<div class=\"card\">
  <div class=\"card-title\">Workflow 名称</div>
  <div class=\"card-value\" style=\"font-size: 20px;\">${SAFE_WORKFLOW_NAME}</div>
</div>
<div class=\"card\">
  <div class=\"info-row\">
    <span class=\"info-label\">使用模板</span>
    <span class=\"info-value\">$(if [[ -n "$SAFE_TEMPLATE_ID" && "$SAFE_TEMPLATE_ID" != "none" ]]; then echo "$SAFE_TEMPLATE_ID"; else echo "无（Claude 生成）"; fi)</span>
  </div>
</div>
"

REPORT_HTML=$(generate_result_report_html "n8n Workflow 创建成功" "✅" "$MAIN_CONTENT")
screenshot_html_report "$RUN_ID" "n8n-execute-result" "$REPORT_HTML" || log_warn "结果截图失败，继续执行"

# 如果是真实模式且有 Workflow ID，截取 n8n 编辑器页面
if [[ "${TEST_MODE:-}" != "1" && -n "$WORKFLOW_ID" ]]; then
  N8N_WORKFLOW_URL="https://zenithjoy21xx.app.n8n.cloud/workflow/${WORKFLOW_ID}"
  log_info "截取 n8n Workflow 页面: $N8N_WORKFLOW_URL"
  save_screenshot "$RUN_ID" "n8n-workflow-editor" "$N8N_WORKFLOW_URL" --delay 3000 || log_warn "Workflow 页面截图失败"
fi

# ============================================================
# 保存到 exports 目录
# ============================================================
EXPORT_DIR="$WORKFLOWS_DIR/exports/bundles/ai-factory"
mkdir -p "$EXPORT_DIR"

# 添加 .gitignore 避免导出文件污染 git 状态
if [[ ! -f "$EXPORT_DIR/.gitignore" ]]; then
  echo "# 自动生成的导出文件" > "$EXPORT_DIR/.gitignore"
  echo "*.json" >> "$EXPORT_DIR/.gitignore"
  echo "!bundle.json" >> "$EXPORT_DIR/.gitignore"
fi

# 使用任务名生成文件名（移除特殊字符，中文名用 run_id 作为后备）
SAFE_NAME=$(echo "$WORKFLOW_NAME" | tr -cd '[:alnum:]_-' | tr '[:upper:]' '[:lower:]')
SAFE_NAME=$(echo "$SAFE_NAME" | sed 's/^[-_]*//;s/[-_]*$//')
SAFE_NAME_STRIPPED=$(echo "$SAFE_NAME" | tr -d '_' | tr -d '-')
if [[ -z "$SAFE_NAME_STRIPPED" || ${#SAFE_NAME_STRIPPED} -lt 3 ]]; then
  SAFE_NAME="workflow"
fi

# 验证清理后的文件名长度至少为 1
if [[ ${#SAFE_NAME} -lt 1 ]]; then
  SAFE_NAME="workflow"
fi

EXPORT_FILE="$EXPORT_DIR/${SAFE_NAME}-${RUN_ID}.json"

# 先验证 jq 输出再写文件
EXPORT_JSON=$(echo "$WORKFLOW_JSON" | jq --arg id "$WORKFLOW_ID" '. + {n8n_id: $id}' 2>/dev/null)
if [[ -n "$EXPORT_JSON" && "$EXPORT_JSON" != "null" ]]; then
  if echo "$EXPORT_JSON" > "$EXPORT_FILE"; then
    log_info "Workflow 已导出: $EXPORT_FILE"
  else
    log_warn "无法写入导出文件: $EXPORT_FILE"
  fi
else
  log_warn "jq 处理失败，无法导出 workflow"
fi

# ============================================================
# 完成
# ============================================================
log_execute_end "n8n"

jq -n \
  --argjson success true \
  --arg workflow_id "$WORKFLOW_ID" \
  --arg workflow_name "$WORKFLOW_NAME" \
  --argjson node_count "$NODE_COUNT" \
  --arg template_used "${TEMPLATE_ID:-none}" \
  --arg export_path "$EXPORT_FILE" \
  '{success: $success, workflow_id: $workflow_id, workflow_name: $workflow_name, node_count: $node_count, template_used: $template_used, export_path: $export_path}'
