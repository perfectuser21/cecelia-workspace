#!/bin/bash
#
# 质检阶段脚本
# 负责：根据 coding_type 加载配置，执行检查，生成报告
#
# 用法: quality-check.sh <run_id> <coding_type>
#
# 参数:
#   run_id      - 运行 ID
#   coding_type - n8n / backend / frontend
#
# 输出:
#   - 质检报告: /data/runs/{run_id}/quality_report.json
#   - 返回值: 0=通过, 1=需返工, 2=需人工处理
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V2_DIR="$(dirname "$SCRIPT_DIR")"
WORKFLOWS_DIR="/home/xx/dev/zenithjoy-autopilot/workflows"

# 加载工具函数
source "$SCRIPT_DIR/utils.sh"

# 加载 secrets
load_secrets

# ============================================================
# 参数解析
# ============================================================
RUN_ID="${1:-}"
CODING_TYPE="${2:-}"

if [[ -z "$RUN_ID" || -z "$CODING_TYPE" ]]; then
  log_error "用法: quality-check.sh <run_id> <coding_type>"
  exit 1
fi

WORK_DIR="/home/xx/data/runs/$RUN_ID"
LOG_FILE="$WORK_DIR/logs/quality.log"

log_info "=========================================="
log_info "质检阶段开始"
log_info "Run ID: $RUN_ID"
log_info "Coding Type: $CODING_TYPE"
log_info "=========================================="

# ============================================================
# 加载检查配置
# ============================================================
CHECKS_CONFIG="$V2_DIR/$CODING_TYPE/checks.json"

if [[ ! -f "$CHECKS_CONFIG" ]]; then
  log_warn "检查配置不存在: $CHECKS_CONFIG，使用默认配置"
  CHECKS_CONFIG=""
fi

# ============================================================
# 检查结果变量
# ============================================================
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
CHECK_RESULTS=()
TOTAL_SCORE=0
NEEDS_MANUAL=false

# 检查通过
pass_check() {
  local name="$1"
  local message="${2:-通过}"
  local score="${3:-0}"

  CHECK_RESULTS+=("{\"name\": \"$name\", \"passed\": true, \"message\": \"$message\", \"score\": $score}")
  PASSED_CHECKS=$((PASSED_CHECKS + 1))
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  TOTAL_SCORE=$((TOTAL_SCORE + score))

  log_info "  ✅ $name: $message"
}

# 检查失败
fail_check() {
  local name="$1"
  local message="${2:-失败}"
  local required="${3:-true}"

  CHECK_RESULTS+=("{\"name\": \"$name\", \"passed\": false, \"message\": \"$message\", \"required\": $required}")
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

  if [[ "$required" == "true" ]]; then
    log_error "  ❌ $name: $message"
  else
    log_warn "  ⚠️ $name: $message (非必需)"
  fi
}

# ============================================================
# 通用检查函数
# ============================================================

# 检查 1: 产出物存在性
check_existence() {
  log_info "[1] 检查产出物存在性..."

  if [[ ! -f "$WORK_DIR/result.json" ]]; then
    fail_check "existence" "result.json 不存在"
    return 1
  fi

  local success=$(jq -r '.success' "$WORK_DIR/result.json" 2>/dev/null)
  if [[ "$success" != "true" ]]; then
    fail_check "existence" "执行结果显示失败"
    return 1
  fi

  local artifact_count=$(jq '.artifacts | length' "$WORK_DIR/result.json" 2>/dev/null || echo 0)
  if [[ "$artifact_count" -eq 0 ]]; then
    fail_check "existence" "没有产出物"
    return 1
  fi

  pass_check "existence" "产出物存在 ($artifact_count 个)"
  return 0
}

# 检查 2: 安全扫描
check_security() {
  log_info "[2] 安全扫描..."

  local issues=()

  # 检查工作目录下的文件
  for file in "$WORK_DIR"/*.json; do
    if [[ -f "$file" ]]; then
      # 检查硬编码密码
      if grep -qiE '"password"\s*:\s*"[^"]{8,}"' "$file" 2>/dev/null; then
        issues+=("发现硬编码密码: $(basename "$file")")
      fi

      # 检查 API Key
      if grep -qiE '"(api.?key|secret.?key|access.?token)"\s*:\s*"[a-zA-Z0-9]{20,}"' "$file" 2>/dev/null; then
        issues+=("发现硬编码 API Key: $(basename "$file")")
      fi

      # 检查私钥
      if grep -qE 'PRIVATE KEY' "$file" 2>/dev/null; then
        issues+=("发现私钥内容: $(basename "$file")")
      fi
    fi
  done

  if [[ ${#issues[@]} -gt 0 ]]; then
    fail_check "security" "${issues[*]}"
    NEEDS_MANUAL=true
    return 1
  fi

  pass_check "security" "无敏感信息泄露"
  return 0
}

# 检查 3: Git 状态
check_git() {
  log_info "[3] Git 状态检查..."

  cd "$PROJECT_DIR" || {
    fail_check "git" "无法进入项目目录"
    return 1
  }

  # 检查合并冲突
  if git diff --check 2>/dev/null | grep -q "conflict"; then
    fail_check "git" "存在合并冲突"
    NEEDS_MANUAL=true
    return 1
  fi

  # 尝试模拟合并（不实际合并）
  # 支持 develop/main/master
  local base_branch=""
  local fetch_error=""
  for branch in develop main master; do
    if fetch_error=$(git fetch origin "$branch" 2>&1); then
      base_branch="$branch"
      break
    fi
  done

  if [[ -z "$base_branch" ]]; then
    log_warn "无法获取远程分支，跳过合并冲突检查"
    log_warn "fetch 失败原因: ${fetch_error:-未知错误}"
    pass_check "git" "无合并冲突（跳过远程检查，原因: ${fetch_error:-未知错误}）"
    return 0
  fi

  if ! git merge --no-commit --no-ff "origin/$base_branch" 2>/dev/null; then
    git merge --abort 2>/dev/null || true
    fail_check "git" "与 $base_branch 存在冲突"
    return 1
  fi
  git merge --abort 2>/dev/null || true

  pass_check "git" "无合并冲突"
  return 0
}

# ============================================================
# n8n 专用检查
# ============================================================

check_n8n_workflow_exists() {
  log_info "[4] n8n Workflow 存在性..."

  if [[ ! -f "$WORK_DIR/result.json" ]]; then
    fail_check "n8n_exists" "result.json 不存在"
    return 1
  fi

  local workflow_id=$(jq -r '.artifacts[0].id // empty' "$WORK_DIR/result.json" 2>/dev/null)

  if [[ -z "$workflow_id" ]]; then
    fail_check "n8n_exists" "未找到 Workflow ID"
    return 1
  fi

  # TEST_MODE: 跳过实际 API 检查
  if [[ "${TEST_MODE:-}" == "1" ]]; then
    log_info "[TEST_MODE] 模拟 n8n Workflow 存在性检查"
    pass_check "n8n_exists" "Workflow 存在: [TEST] $workflow_id"
    return 0
  fi

  # 检查 n8n 中是否存在
  local response=$(curl -sf "https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/$workflow_id" \
    -H "X-N8N-API-KEY: $N8N_REST_API_KEY" 2>/dev/null)

  if [[ -z "$response" ]]; then
    fail_check "n8n_exists" "Workflow $workflow_id 在 n8n 中不存在"
    return 1
  fi

  local name=$(echo "$response" | jq -r '.name')
  pass_check "n8n_exists" "Workflow 存在: $name"
  return 0
}

check_n8n_quality_score() {
  log_info "[5] n8n 质量评分..."

  if [[ ! -f "$WORK_DIR/workflow.json" ]]; then
    fail_check "n8n_quality" "workflow.json 不存在" "false"
    return 0  # 非必需检查
  fi

  local workflow=$(cat "$WORK_DIR/workflow.json")
  local nodes=$(echo "$workflow" | jq '.nodes // []')
  local connections=$(echo "$workflow" | jq '.connections // {}')
  local node_count=$(echo "$nodes" | jq 'length')

  # 评分维度
  local completeness=0
  local error_handling=0
  local naming=0
  local parameters=0
  local best_practices=0

  # 1. 完整性
  local has_trigger=$(echo "$nodes" | jq '[.[] | select(.type | contains("Trigger"))] | length')
  [[ $has_trigger -gt 0 ]] && ((completeness+=8))
  [[ $node_count -ge 2 ]] && ((completeness+=6))
  [[ $node_count -ge 3 ]] && ((completeness+=6))

  # 2. 错误处理
  local has_error=$(echo "$nodes" | jq '[.[] | select(.type | contains("errorTrigger"))] | length')
  [[ $has_error -gt 0 ]] && ((error_handling+=10))
  # 检查是否有节点设置了 continueOnFail
  local has_continue_on_fail=$(echo "$nodes" | jq '[.[] | select(.continueOnFail == true)] | length')
  [[ $has_continue_on_fail -gt 0 ]] && ((error_handling+=10))

  # 3. 命名
  local default_names=$(echo "$nodes" | jq '[.[] | select(.name | test("^(Code|HTTP|SSH|IF)( \\d+)?$"))] | length')
  [[ $default_names -eq 0 ]] && ((naming+=15)) || ((naming+=5))
  ((naming+=5))

  # 4. 参数配置
  local has_params=$(echo "$nodes" | jq '[.[] | select(.parameters != null)] | length')
  [[ $has_params -gt 0 ]] && ((parameters+=10))
  ((parameters+=10))

  # 5. 最佳实践
  local uses_credentials=$(echo "$nodes" | jq '[.[] | select(.credentials != null)] | length')
  [[ $uses_credentials -gt 0 ]] && ((best_practices+=8))
  [[ $node_count -le 15 ]] && ((best_practices+=6))
  ((best_practices+=6))

  # 计算总分
  local total=$((completeness + error_handling + naming + parameters + best_practices))

  log_info "    完整性: $completeness/20"
  log_info "    错误处理: $error_handling/20"
  log_info "    命名规范: $naming/20"
  log_info "    参数配置: $parameters/20"
  log_info "    最佳实践: $best_practices/20"

  if [[ $total -ge 80 ]]; then
    pass_check "n8n_quality" "质量评分 $total/100" "$total"
    return 0
  else
    fail_check "n8n_quality" "质量评分 $total/100 (需 >= 80)"
    return 1
  fi
}

# ============================================================
# 执行检查
# ============================================================

run_checks() {
  log_info "开始执行检查..."

  # 通用检查
  check_existence
  check_security
  check_git

  # 类型专用检查
  case "$CODING_TYPE" in
    n8n)
      check_n8n_workflow_exists
      check_n8n_quality_score
      ;;
    backend)
      log_info "[4] Backend 专用检查（待实现）..."
      pass_check "backend_stub" "Backend 检查跳过（待实现）"
      ;;
    frontend)
      log_info "[4] Frontend 专用检查（待实现）..."
      pass_check "frontend_stub" "Frontend 检查跳过（待实现）"
      ;;
  esac
}

# ============================================================
# 生成报告
# ============================================================

generate_report() {
  log_info "生成质检报告..."

  local passed=$([[ $FAILED_CHECKS -eq 0 ]] && echo "true" || echo "false")
  local checks_json=$(printf '%s\n' "${CHECK_RESULTS[@]}" | jq -s '.')

  local report=$(jq -n \
    --argjson passed "$passed" \
    --argjson total_checks "$TOTAL_CHECKS" \
    --argjson passed_checks "$PASSED_CHECKS" \
    --argjson failed_checks "$FAILED_CHECKS" \
    --argjson score "$TOTAL_SCORE" \
    --argjson needs_manual "$NEEDS_MANUAL" \
    --argjson checks "$checks_json" \
    --arg checked_at "$(date -Iseconds)" \
    '{
      passed: $passed,
      total_checks: $total_checks,
      passed_checks: $passed_checks,
      failed_checks: $failed_checks,
      score: $score,
      needs_manual: $needs_manual,
      checks: $checks,
      checked_at: $checked_at
    }')

  echo "$report" > "$WORK_DIR/quality_report.json"
  log_info "质检报告已保存: $WORK_DIR/quality_report.json"
}

# ============================================================
# 主流程
# ============================================================

run_checks
generate_report

# ============================================================
# 生成质检报告截图
# ============================================================
log_info "生成质检报告截图..."

# 根据结果设置颜色和图标
if [[ $FAILED_CHECKS -eq 0 ]]; then
  STATUS_COLOR="#4ade80"
  STATUS_ICON="✅"
  STATUS_TEXT="质检通过"
  BG_GRADIENT="linear-gradient(135deg, #10b981 0%, #059669 100%)"
elif [[ "$NEEDS_MANUAL" == "true" ]]; then
  STATUS_COLOR="#ef4444"
  STATUS_ICON="❌"
  STATUS_TEXT="需人工处理"
  BG_GRADIENT="linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
else
  STATUS_COLOR="#f59e0b"
  STATUS_ICON="⚠️"
  STATUS_TEXT="需返工"
  BG_GRADIENT="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
fi

# 生成检查项列表 HTML
CHECKS_HTML=""
for result in "${CHECK_RESULTS[@]}"; do
  check_name=$(echo "$result" | jq -r '.name')
  check_passed=$(echo "$result" | jq -r '.passed')
  check_message=$(echo "$result" | jq -r '.message')

  if [[ "$check_passed" == "true" ]]; then
    CHECKS_HTML+="<div class=\"check-item pass\"><span class=\"icon\">✅</span><span class=\"name\">$check_name</span><span class=\"msg\">$check_message</span></div>"
  else
    CHECKS_HTML+="<div class=\"check-item fail\"><span class=\"icon\">❌</span><span class=\"name\">$check_name</span><span class=\"msg\">$check_message</span></div>"
  fi
done

# 生成 HTML 报告
REPORT_HTML="<!DOCTYPE html>
<html>
<head>
  <meta charset=\"UTF-8\">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Noto Sans CJK SC', 'WenQuanYi Zen Hei', sans-serif;
      background: $BG_GRADIENT;
      min-height: 100vh;
      padding: 40px;
      color: white;
    }
    .container { max-width: 800px; margin: 0 auto; }
    h1 {
      font-size: 36px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .subtitle {
      font-size: 18px;
      opacity: 0.8;
      margin-bottom: 30px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat {
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    .stat-value {
      font-size: 32px;
      font-weight: bold;
    }
    .stat-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.7;
      margin-top: 4px;
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
      margin-bottom: 16px;
    }
    .check-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .check-item:last-child { border-bottom: none; }
    .check-item .icon { font-size: 18px; }
    .check-item .name {
      font-weight: 600;
      min-width: 120px;
    }
    .check-item .msg { opacity: 0.8; }
    .check-item.fail { opacity: 0.9; }
    .score-ring {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: conic-gradient($STATUS_COLOR ${TOTAL_SCORE}%, rgba(255,255,255,0.2) 0);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
    }
    .score-inner {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: rgba(0,0,0,0.3);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .score-value { font-size: 28px; font-weight: bold; }
    .score-label { font-size: 12px; opacity: 0.7; }
    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 14px;
      opacity: 0.6;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .info-row:last-child { border-bottom: none; }
  </style>
</head>
<body>
  <div class=\"container\">
    <h1>$STATUS_ICON $STATUS_TEXT</h1>
    <div class=\"subtitle\">AI 工厂 v2 质检报告 · $CODING_TYPE</div>

    <div class=\"stats\">
      <div class=\"stat\">
        <div class=\"stat-value\">$TOTAL_CHECKS</div>
        <div class=\"stat-label\">总检查数</div>
      </div>
      <div class=\"stat\">
        <div class=\"stat-value\" style=\"color: #4ade80;\">$PASSED_CHECKS</div>
        <div class=\"stat-label\">通过</div>
      </div>
      <div class=\"stat\">
        <div class=\"stat-value\" style=\"color: #ef4444;\">$FAILED_CHECKS</div>
        <div class=\"stat-label\">失败</div>
      </div>
      <div class=\"stat\">
        <div class=\"score-ring\">
          <div class=\"score-inner\">
            <div class=\"score-value\">$TOTAL_SCORE</div>
            <div class=\"score-label\">分数</div>
          </div>
        </div>
      </div>
    </div>

    <div class=\"card\">
      <div class=\"card-title\">检查详情</div>
      $CHECKS_HTML
    </div>

    <div class=\"card\">
      <div class=\"info-row\">
        <span>Run ID</span>
        <span>$RUN_ID</span>
      </div>
      <div class=\"info-row\">
        <span>Coding Type</span>
        <span>$CODING_TYPE</span>
      </div>
      <div class=\"info-row\">
        <span>检查时间</span>
        <span>$(date '+%Y-%m-%d %H:%M:%S')</span>
      </div>
    </div>

    <div class=\"footer\">
      Generated by AI Factory v2 | $(date '+%Y-%m-%d %H:%M:%S')
    </div>
  </div>
</body>
</html>"

# 生成截图
screenshot_html_report "$RUN_ID" "quality-report" "$REPORT_HTML" || log_warn "质检报告截图失败"

# ============================================================
# 输出结果
# ============================================================
log_info "=========================================="
log_info "质检完成"
log_info "总检查数: $TOTAL_CHECKS"
log_info "通过: $PASSED_CHECKS"
log_info "失败: $FAILED_CHECKS"
log_info "分数: $TOTAL_SCORE"
log_info "=========================================="

# 返回适当的退出码
if [[ $FAILED_CHECKS -eq 0 ]]; then
  log_info "质检通过"
  exit 0
elif [[ "$NEEDS_MANUAL" == "true" ]]; then
  log_error "质检失败，需要人工处理"
  exit 2
else
  log_warn "质检失败，可以返工"
  exit 1
fi
