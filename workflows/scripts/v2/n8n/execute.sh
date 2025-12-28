#!/bin/bash
#
# n8n 执行阶段脚本
# 负责：模板匹配、生成 Workflow JSON、调用 n8n API 创建、激活
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

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED_DIR="$(dirname "$SCRIPT_DIR")/shared"
WORKFLOWS_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/.."

# 加载工具函数
source "$SHARED_DIR/utils.sh"

# 加载 secrets
load_secrets

# HTML 转义函数：防止 XSS 和 HTML 注入
html_escape() {
  echo "$1" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g; s/'"'"'/\&#39;/g'
}

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
if [[ ! -f "$TASK_INFO_PATH" ]]; then
  log_error "任务信息文件不存在: $TASK_INFO_PATH"
  exit 1
fi

TASK_ID=$(jq -r '.task_id' "$TASK_INFO_PATH")
TASK_NAME=$(jq -r '.task_name' "$TASK_INFO_PATH")
TASK_CONTENT=$(jq -r '.content' "$TASK_INFO_PATH")

log_info "=========================================="
log_info "n8n 执行阶段开始"
log_info "Run ID: $RUN_ID"
log_info "Task: $TASK_NAME"
log_info "=========================================="

# ============================================================
# 检查是否已有执行结果（稳定性验证时跳过重复创建）
# ============================================================
if [[ -f "$WORK_DIR/result.json" ]]; then
  EXISTING_SUCCESS=$(jq -r '.success' "$WORK_DIR/result.json" 2>/dev/null)
  EXISTING_ID=$(jq -r '.artifacts[0].id // empty' "$WORK_DIR/result.json" 2>/dev/null)

  if [[ "$EXISTING_SUCCESS" == "true" && -n "$EXISTING_ID" ]]; then
    log_info "已存在成功的执行结果 (Workflow ID: $EXISTING_ID)，跳过重复创建"
    log_info "这是稳定性验证，只需重新验证质检"

    # 重新读取结果信息用于输出
    WORKFLOW_ID="$EXISTING_ID"
    WORKFLOW_NAME=$(jq -r '.artifacts[0].name' "$WORK_DIR/result.json")
    NODE_COUNT=$(jq -r '.artifacts[0].node_count' "$WORK_DIR/result.json")
    TEMPLATE_ID=$(jq -r '.artifacts[0].template_used' "$WORK_DIR/result.json")

    # 直接输出结果并退出（使用 jq 安全构建 JSON）
    jq -n \
      --argjson success true \
      --arg workflow_id "$WORKFLOW_ID" \
      --arg workflow_name "$WORKFLOW_NAME" \
      --argjson node_count "${NODE_COUNT:-0}" \
      --arg template_used "${TEMPLATE_ID:-none}" \
      --argjson skipped true \
      --arg reason "stability_verification" \
      '{success: $success, workflow_id: $workflow_id, workflow_name: $workflow_name, node_count: $node_count, template_used: $template_used, skipped: $skipped, reason: $reason}'
    exit 0
  fi
fi

# ============================================================
# 模板匹配
# ============================================================
log_info "[1/5] 模板匹配..."

# 模板索引
TEMPLATES_INDEX="$WORKFLOWS_DIR/templates/index.json"

# 从任务内容中匹配模板
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
# 生成 Workflow JSON
# ============================================================
log_info "[2/5] 生成 Workflow JSON..."

WORKFLOW_JSON=""

# 如果有模板，加载模板
if [[ -n "$TEMPLATE_ID" ]]; then
  TEMPLATE_FILE="$WORKFLOWS_DIR/templates/$TEMPLATE_ID/template.json"
  if [[ -f "$TEMPLATE_FILE" ]]; then
    log_info "加载模板: $TEMPLATE_FILE"
    WORKFLOW_JSON=$(cat "$TEMPLATE_FILE")

    # 根据任务内容修改模板（简化处理）
    # 实际使用时可能需要 Claude 来调整
    WORKFLOW_JSON=$(echo "$WORKFLOW_JSON" | jq --arg name "$TASK_NAME" '.name = $name')
  fi
fi

# 如果没有模板或模板加载失败，使用 Claude 生成
if [[ -z "$WORKFLOW_JSON" ]]; then
  # TEST_MODE: 使用 mock workflow JSON
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
              command: "df -h / | tail -1 | awk '\"'\"'{print $5}'\"'\"'"
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

  # 调用 Claude（超时 600s，复杂 workflow 需要更多时间）
  CLAUDE_EXIT=0
  CLAUDE_OUTPUT=$(cd /home/xx/data/factory-workspace && timeout -k 10 600 claude -p "$PROMPT" \
    --add-dir "$WORKFLOWS_DIR" --model "sonnet" 2>&1) || CLAUDE_EXIT=$?

  if [[ $CLAUDE_EXIT -ne 0 ]]; then
    log_error "Claude 调用失败 (exit: $CLAUDE_EXIT)"
    echo "$CLAUDE_OUTPUT" > "$WORK_DIR/claude_error_debug.txt"
    exit 1
  fi

  # 提取 JSON - 使用 jq 验证和提取，避免 awk 括号计数问题
  WORKFLOW_JSON=""
  # 先尝试直接解析整个输出（Claude 有时只返回纯 JSON）
  if echo "$CLAUDE_OUTPUT" | jq empty 2>/dev/null; then
    WORKFLOW_JSON="$CLAUDE_OUTPUT"
  else
    # 否则移除 markdown 代码块后尝试解析
    CLEANED_OUTPUT=$(echo "$CLAUDE_OUTPUT" | sed 's/```json//g; s/```//g')
    # 使用 jq -s 'last' 提取最后一个有效 JSON 对象
    WORKFLOW_JSON=$(echo "$CLEANED_OUTPUT" | jq -s 'last' 2>/dev/null) || true
  fi

  # 验证 JSON
  if [[ -z "$WORKFLOW_JSON" ]] || ! echo "$WORKFLOW_JSON" | jq empty 2>/dev/null; then
    log_error "生成的 JSON 无效"
    echo "$CLAUDE_OUTPUT" > "$WORK_DIR/claude_output_debug.txt"
    exit 1
  fi

  log_info "Workflow JSON 生成成功"
  fi
fi

# 保存 Workflow JSON
if ! echo "$WORKFLOW_JSON" > "$WORK_DIR/workflow.json"; then
  log_error "无法写入 workflow.json"
  exit 1
fi
log_info "Workflow JSON 已保存: $WORK_DIR/workflow.json"

# ============================================================
# 调用 n8n API 创建 Workflow
# ============================================================
log_info "[3/5] 创建 Workflow..."

# TEST_MODE: 使用 mock API 响应
if [[ "${TEST_MODE:-}" == "1" ]]; then
  log_info "[TEST_MODE] 模拟 n8n API 创建"
  WORKFLOW_ID="test-workflow-$(date +%s)"
  WORKFLOW_NAME=$(echo "$WORKFLOW_JSON" | jq -r '.name')
  NODE_COUNT=$(echo "$WORKFLOW_JSON" | jq '.nodes | length')
  log_info "Workflow 创建成功: $WORKFLOW_NAME (ID: $WORKFLOW_ID, 节点数: $NODE_COUNT)"

  log_info "[4/5] 激活 Workflow..."
  log_info "[TEST_MODE] 模拟激活成功"
else
  if [[ -z "$N8N_REST_API_KEY" ]]; then
    log_error "N8N_REST_API_KEY 未设置"
    exit 1
  fi

  N8N_API_URL="https://zenithjoy21xx.app.n8n.cloud/api/v1"

  # 过滤 JSON，只保留 API 接受的字段
  FILTERED_JSON=$(echo "$WORKFLOW_JSON" | jq '{
    name: .name,
    nodes: .nodes,
    connections: .connections,
    settings: (.settings // {executionOrder: "v1"})
  }')

  # 创建 Workflow
  RESPONSE=$(curl -sf -w "\n%{http_code}" -X POST "$N8N_API_URL/workflows" \
    -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$FILTERED_JSON" 2>&1)

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')

  if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "201" ]]; then
    log_error "n8n API 创建失败 (HTTP $HTTP_CODE)"
    echo "$RESPONSE_BODY" > "$WORK_DIR/api_error.json"
    exit 1
  fi

  WORKFLOW_ID=$(echo "$RESPONSE_BODY" | jq -r '.id')
  WORKFLOW_NAME=$(echo "$RESPONSE_BODY" | jq -r '.name')
  NODE_COUNT=$(echo "$RESPONSE_BODY" | jq '.nodes | length')

  log_info "Workflow 创建成功: $WORKFLOW_NAME (ID: $WORKFLOW_ID, 节点数: $NODE_COUNT)"

  # ============================================================
  # 激活 Workflow
  # ============================================================
  log_info "[4/5] 激活 Workflow..."

  ACTIVATE_RESPONSE=$(curl -sf -X PATCH "$N8N_API_URL/workflows/$WORKFLOW_ID" \
    -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"active": true}' 2>&1)

  if echo "$ACTIVATE_RESPONSE" | jq -e '.active == true' > /dev/null 2>&1; then
    log_info "Workflow 已激活"
  else
    log_warn "Workflow 激活失败，但继续执行"
  fi
fi

# ============================================================
# 保存结果
# ============================================================
RESULT_JSON=$(jq -n \
  --arg success "true" \
  --arg workflow_id "$WORKFLOW_ID" \
  --arg workflow_name "$WORKFLOW_NAME" \
  --arg template_id "${TEMPLATE_ID:-none}" \
  --argjson node_count "$NODE_COUNT" \
  --arg created_at "$(date -Iseconds)" \
  '{
    success: ($success == "true"),
    artifacts: [
      {
        type: "workflow",
        id: $workflow_id,
        name: $workflow_name,
        template_used: $template_id,
        node_count: $node_count
      }
    ],
    created_at: $created_at
  }')

if ! echo "$RESULT_JSON" > "$WORK_DIR/result.json"; then
  log_error "无法写入 result.json"
  exit 1
fi

# ============================================================
# 截图：执行结果证明
# ============================================================
log_info "[5/5] 生成执行结果截图..."

# HTML 转义变量（防止 XSS 和 HTML 注入）
SAFE_WORKFLOW_ID=$(html_escape "$WORKFLOW_ID")
SAFE_WORKFLOW_NAME=$(html_escape "$WORKFLOW_NAME")
SAFE_TEMPLATE_ID=$(html_escape "${TEMPLATE_ID:-}")
SAFE_RUN_ID=$(html_escape "$RUN_ID")
SAFE_TASK_ID=$(html_escape "$TASK_ID")

# 生成结果报告 HTML
REPORT_HTML="<!DOCTYPE html>
<html>
<head>
  <meta charset=\"UTF-8\">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Noto Sans CJK SC', 'WenQuanYi Zen Hei', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 40px;
      color: white;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
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
    .card-value.success { color: #4ade80; }
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
  <div class=\"container\">
    <h1>✅ n8n Workflow 创建成功</h1>
    <div class=\"subtitle\">AI 工厂 v2 执行报告</div>

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
      <div class=\"info-row\">
        <span class=\"info-label\">Run ID</span>
        <span class=\"info-value\">${SAFE_RUN_ID}</span>
      </div>
      <div class=\"info-row\">
        <span class=\"info-label\">Task ID</span>
        <span class=\"info-value\">${SAFE_TASK_ID}</span>
      </div>
      <div class=\"info-row\">
        <span class=\"info-label\">创建时间</span>
        <span class=\"info-value\">$(date '+%Y-%m-%d %H:%M:%S')</span>
      </div>
    </div>

    <div class=\"footer\">
      Generated by AI Factory v2 | $(date '+%Y-%m-%d %H:%M:%S')
    </div>
  </div>
</body>
</html>"

# 保存并截图
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
# 去掉开头和结尾的连字符/下划线（中文名过滤后可能只剩 "-workflow"）
SAFE_NAME=$(echo "$SAFE_NAME" | sed 's/^[-_]*//;s/[-_]*$//')
# 如果只剩下连字符/下划线或太短，用 "workflow" 作为前缀
SAFE_NAME_STRIPPED=$(echo "$SAFE_NAME" | tr -d '_' | tr -d '-')
if [[ -z "$SAFE_NAME_STRIPPED" || ${#SAFE_NAME_STRIPPED} -lt 3 ]]; then
  SAFE_NAME="workflow"
fi
# 添加 RUN_ID 后缀避免文件名冲突
EXPORT_FILE="$EXPORT_DIR/${SAFE_NAME}-${RUN_ID}.json"

if ! echo "$WORKFLOW_JSON" | jq --arg id "$WORKFLOW_ID" '. + {n8n_id: $id}' > "$EXPORT_FILE"; then
  log_warn "无法导出 workflow 到: $EXPORT_FILE"
else
  log_info "Workflow 已导出: $EXPORT_FILE"
fi

# ============================================================
# 输出结果
# ============================================================
log_info "=========================================="
log_info "n8n 执行阶段完成"
log_info "Workflow ID: $WORKFLOW_ID"
log_info "节点数: $NODE_COUNT"
log_info "=========================================="

jq -n \
  --argjson success true \
  --arg workflow_id "$WORKFLOW_ID" \
  --arg workflow_name "$WORKFLOW_NAME" \
  --argjson node_count "$NODE_COUNT" \
  --arg template_used "${TEMPLATE_ID:-none}" \
  --arg export_path "$EXPORT_FILE" \
  '{success: $success, workflow_id: $workflow_id, workflow_name: $workflow_name, node_count: $node_count, template_used: $template_used, export_path: $export_path}'
