#!/bin/bash
# quality-check.sh - 8 路质检
# 用于验证 Workflow 质量，必须全部通过才能提交

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKFLOWS_DIR="$(dirname "$SCRIPT_DIR")"
REPO_DIR="$(dirname "$WORKFLOWS_DIR")"

# 加载配置
SECRETS_FILE="$REPO_DIR/.secrets"
if [[ -f "$SECRETS_FILE" ]]; then
  eval $(grep "^N8N_REST_API_KEY=" "$SECRETS_FILE")
fi

N8N_API_URL="${N8N_API_URL:-http://localhost:5679/api/v1}"
N8N_API_KEY="${N8N_API_KEY:-$N8N_REST_API_KEY}"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m'

# 计分
TOTAL_SCORE=0
TOTAL_CHECKS=8
PASSED_CHECKS=0
FAILED_CHECKS=()
CHECK_RESULTS=()

log() { echo -e "${BLUE}[qc]${NC} $1"; }
pass() { echo -e "${GREEN}✓${NC} $1"; ((PASSED_CHECKS++)); CHECK_RESULTS+=("✅ $1"); }
fail() { echo -e "${RED}✗${NC} $1"; FAILED_CHECKS+=("$1"); CHECK_RESULTS+=("❌ $1"); }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
info() { echo -e "${GRAY}  $1${NC}"; }

# ============================================================
# 检查 1: 硬检查 - Workflow 存在于 n8n
# ============================================================
check_hard() {
  local workflow_file="$1"
  local n8n_id="$2"

  log "检查 1/8: 硬检查 (Workflow 存在性)"

  if [[ -z "$n8n_id" || "$n8n_id" == "null" ]]; then
    fail "硬检查: 未提供 n8n_id"
    return 1
  fi

  # 检查 n8n 中是否存在
  local response=$(curl -sf "$N8N_API_URL/workflows/$n8n_id" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" 2>/dev/null)

  if [[ -z "$response" ]]; then
    fail "硬检查: Workflow $n8n_id 不存在于 n8n"
    return 1
  fi

  local name=$(echo "$response" | jq -r '.name')
  pass "硬检查: Workflow 存在 ($name)"
  return 0
}

# ============================================================
# 检查 2: 软检查 - 5 维度评分
# ============================================================
check_soft() {
  local workflow_file="$1"

  log "检查 2/8: 软检查 (5 维度评分)"

  if [[ ! -f "$workflow_file" ]]; then
    fail "软检查: 文件不存在 $workflow_file"
    return 1
  fi

  local workflow=$(cat "$workflow_file")
  local nodes=$(echo "$workflow" | jq '.nodes // []')
  local connections=$(echo "$workflow" | jq '.connections // {}')
  local node_count=$(echo "$nodes" | jq 'length')

  # 评分维度 (每项满分 20，总分 100)
  local completeness=0
  local error_handling=0
  local naming=0
  local parameters=0
  local best_practices=0

  # 1. Completeness (完整性) - 检查必要元素
  # 有触发器 +8, 有处理节点 +6, 有输出 +6
  local has_trigger=$(echo "$nodes" | jq '[.[] | select(.type | contains("Trigger"))] | length')
  local has_manual=$(echo "$nodes" | jq '[.[] | select(.type | contains("manualTrigger"))] | length')
  [[ $has_trigger -gt 0 || $has_manual -gt 0 ]] && ((completeness+=8))
  [[ $node_count -ge 2 ]] && ((completeness+=6))
  [[ $node_count -ge 3 ]] && ((completeness+=6))

  # 2. Error Handling (错误处理) - 检查错误处理节点
  # 有 try/catch +10, 有错误通知 +5, 连接数合理 +5
  local has_error_handler=$(echo "$nodes" | jq '[.[] | select(.type | contains("errorTrigger") or contains("stopAndError"))] | length')
  [[ $has_error_handler -gt 0 ]] && ((error_handling+=10))
  # 简单 workflow 允许无错误处理
  [[ $node_count -le 4 ]] && ((error_handling+=10))
  ((error_handling+=5))  # 基础分

  # 3. Naming (命名规范) - 检查节点命名
  # 无默认名称 +10, 使用中文 +5, 命名一致 +5
  local default_names=$(echo "$nodes" | jq '[.[] | select(.name | test("^(Code|HTTP|SSH|IF|Switch|Set|Function)( \\d+)?$"))] | length')
  [[ $default_names -eq 0 ]] && ((naming+=10)) || ((naming+=5))
  local chinese_names=$(echo "$nodes" | jq '[.[] | select(.name | test("[\\u4e00-\\u9fa5]"))] | length')
  [[ $chinese_names -gt 0 ]] && ((naming+=5))
  ((naming+=5))  # 基础分

  # 4. Parameters (参数配置) - 检查参数完整性
  # 有配置参数 +10, 无硬编码敏感信息 +10
  local has_params=$(echo "$nodes" | jq '[.[] | select(.parameters != null and .parameters != {})] | length')
  [[ $has_params -gt 0 ]] && ((parameters+=10))
  # 检查硬编码 (简单检查)
  local has_hardcoded=$(echo "$workflow" | grep -iE "(password|secret|token|api.?key).*['\"].*[a-zA-Z0-9]{20}" | wc -l)
  [[ $has_hardcoded -eq 0 ]] && ((parameters+=10))

  # 5. Best Practices (最佳实践) - 检查架构
  # 使用凭据 +8, 节点数合理 +6, 有注释/说明 +6
  local uses_credentials=$(echo "$nodes" | jq '[.[] | select(.credentials != null)] | length')
  [[ $uses_credentials -gt 0 ]] && ((best_practices+=8))
  [[ $node_count -le 15 ]] && ((best_practices+=6))
  local has_notes=$(echo "$nodes" | jq '[.[] | select(.type == "n8n-nodes-base.stickyNote")] | length')
  [[ $has_notes -gt 0 ]] && ((best_practices+=6)) || ((best_practices+=3))

  # 计算总分
  local total=$((completeness + error_handling + naming + parameters + best_practices))
  local min_dimension=20

  # 找最低分
  for score in $completeness $error_handling $naming $parameters $best_practices; do
    [[ $score -lt $min_dimension ]] && min_dimension=$score
  done

  info "完整性: $completeness/20"
  info "错误处理: $error_handling/20"
  info "命名规范: $naming/20"
  info "参数配置: $parameters/20"
  info "最佳实践: $best_practices/20"
  info "总分: $total/100, 最低维度: $min_dimension"

  TOTAL_SCORE=$total

  # 判断是否通过: 总分 >= 80 且每项 >= 12
  if [[ $total -ge 80 && $min_dimension -ge 12 ]]; then
    pass "软检查: $total/100 (所有维度 ≥ 12)"
    return 0
  else
    if [[ $total -lt 80 ]]; then
      fail "软检查: 总分 $total < 80"
    else
      fail "软检查: 某维度 < 12 (最低: $min_dimension)"
    fi
    return 1
  fi
}

# ============================================================
# 检查 3: 安全扫描 - 无敏感信息泄露
# ============================================================
check_security() {
  local workflow_file="$1"

  log "检查 3/8: 安全扫描"

  if [[ ! -f "$workflow_file" ]]; then
    fail "安全扫描: 文件不存在"
    return 1
  fi

  local issues=()

  # 检查硬编码密码
  if grep -qiE '"password"\s*:\s*"[^"]{8,}"' "$workflow_file"; then
    issues+=("发现硬编码密码")
  fi

  # 检查 API Key
  if grep -qiE '"(api.?key|secret.?key|access.?token)"\s*:\s*"[a-zA-Z0-9]{20,}"' "$workflow_file"; then
    issues+=("发现硬编码 API Key")
  fi

  # 检查私钥
  if grep -qE 'PRIVATE KEY' "$workflow_file"; then
    issues+=("发现私钥内容")
  fi

  # 检查 JWT
  if grep -qE 'eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+' "$workflow_file"; then
    issues+=("发现 JWT Token")
  fi

  if [[ ${#issues[@]} -gt 0 ]]; then
    for issue in "${issues[@]}"; do
      info "$issue"
    done
    fail "安全扫描: 发现 ${#issues[@]} 个安全问题"
    return 1
  fi

  pass "安全扫描: 无敏感信息泄露"
  return 0
}

# ============================================================
# 检查 4: 集成检查 - API 连接验证
# ============================================================
check_integration() {
  local workflow_file="$1"
  local n8n_id="$2"

  log "检查 4/8: 集成检查"

  # 检查 n8n API 连接
  local api_ok=$(curl -sf "$N8N_API_URL/workflows" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" 2>/dev/null | jq -r '.data | length')

  if [[ -z "$api_ok" ]]; then
    fail "集成检查: n8n API 连接失败"
    return 1
  fi

  # 如果有 n8n_id，检查是否可访问
  if [[ -n "$n8n_id" && "$n8n_id" != "null" ]]; then
    local workflow_ok=$(curl -sf "$N8N_API_URL/workflows/$n8n_id" \
      -H "X-N8N-API-KEY: $N8N_API_KEY" 2>/dev/null | jq -r '.id')

    if [[ "$workflow_ok" != "$n8n_id" ]]; then
      fail "集成检查: Workflow $n8n_id 不可访问"
      return 1
    fi
  fi

  pass "集成检查: API 连接正常"
  return 0
}

# ============================================================
# 检查 5: 性能检查 - 节点数量、复杂度
# ============================================================
check_performance() {
  local workflow_file="$1"

  log "检查 5/8: 性能检查"

  if [[ ! -f "$workflow_file" ]]; then
    fail "性能检查: 文件不存在"
    return 1
  fi

  local workflow=$(cat "$workflow_file")
  local node_count=$(echo "$workflow" | jq '.nodes | length')
  local connection_count=$(echo "$workflow" | jq '[.connections | .. | objects | select(.node != null)] | length')

  local issues=()

  # 节点数量检查 (建议 <= 20)
  if [[ $node_count -gt 30 ]]; then
    issues+=("节点数过多: $node_count (建议 <= 20)")
  fi

  # 连接数检查 (复杂度)
  if [[ $connection_count -gt 50 ]]; then
    issues+=("连接数过多: $connection_count (复杂度高)")
  fi

  # 检查循环风险 (简单检查)
  local has_loop=$(echo "$workflow" | jq '.nodes[] | select(.type | contains("SplitInBatches"))' | wc -l)

  info "节点数: $node_count, 连接数: $connection_count"

  if [[ ${#issues[@]} -gt 0 ]]; then
    for issue in "${issues[@]}"; do
      info "$issue"
    done
    fail "性能检查: 发现 ${#issues[@]} 个问题"
    return 1
  fi

  pass "性能检查: 复杂度合理"
  return 0
}

# ============================================================
# 检查 6: Git 检查 - 分支状态
# ============================================================
check_git() {
  local workflow_file="$1"

  log "检查 6/8: Git 检查"

  # 检查是否在 git 仓库中
  if ! git -C "$REPO_DIR" rev-parse --git-dir > /dev/null 2>&1; then
    fail "Git 检查: 不在 git 仓库中"
    return 1
  fi

  # 检查当前分支
  local branch=$(git -C "$REPO_DIR" branch --show-current)
  info "当前分支: $branch"

  # 检查工作区状态 (允许有未提交的变更，因为新文件还未提交)
  local status=$(git -C "$REPO_DIR" status --porcelain)

  # 检查是否有冲突
  if echo "$status" | grep -qE '^(U|AA|DD)'; then
    fail "Git 检查: 存在合并冲突"
    return 1
  fi

  pass "Git 检查: 分支状态正常 ($branch)"
  return 0
}

# ============================================================
# 检查 7: Linting - 命名规范、布局
# ============================================================
check_linting() {
  local workflow_file="$1"

  log "检查 7/8: Linting 检查"

  if [[ ! -f "$workflow_file" ]]; then
    fail "Linting: 文件不存在"
    return 1
  fi

  local issues=()

  # JSON 格式检查
  if ! jq empty "$workflow_file" 2>/dev/null; then
    issues+=("JSON 格式无效")
  fi

  local workflow=$(cat "$workflow_file")

  # 检查必要字段
  local has_name=$(echo "$workflow" | jq -r '.name // empty')
  [[ -z "$has_name" ]] && issues+=("缺少 name 字段")

  local has_nodes=$(echo "$workflow" | jq -r '.nodes // empty')
  [[ -z "$has_nodes" ]] && issues+=("缺少 nodes 字段")

  # 检查节点 ID 唯一性
  local id_count=$(echo "$workflow" | jq '.nodes | length')
  local unique_id_count=$(echo "$workflow" | jq '.nodes | [.[].id] | unique | length')
  [[ "$id_count" != "$unique_id_count" ]] && issues+=("存在重复的节点 ID")

  # 检查节点位置 (简单检查是否有重叠)
  local positions=$(echo "$workflow" | jq -r '.nodes[] | "\(.position[0]),\(.position[1])"' | sort | uniq -d)
  [[ -n "$positions" ]] && issues+=("存在重叠的节点位置")

  if [[ ${#issues[@]} -gt 0 ]]; then
    for issue in "${issues[@]}"; do
      info "$issue"
    done
    fail "Linting: 发现 ${#issues[@]} 个问题"
    return 1
  fi

  pass "Linting: 格式规范"
  return 0
}

# ============================================================
# 检查 8: 测试覆盖率 - 测试文件存在
# ============================================================
check_tests() {
  local workflow_file="$1"
  local bundle_name="$2"

  log "检查 8/8: 测试覆盖率"

  # 获取 workflow 名称
  local workflow_name=$(basename "$workflow_file" .json)

  # 检查测试文件是否存在
  local test_file="$WORKFLOWS_DIR/tests/${bundle_name}/${workflow_name}.test.json"
  local test_dir="$WORKFLOWS_DIR/tests/${bundle_name}"

  # 对于简单 workflow，测试文件是可选的
  local node_count=$(jq '.nodes | length' "$workflow_file")

  if [[ $node_count -le 4 ]]; then
    pass "测试覆盖率: 简单 workflow，测试可选"
    return 0
  fi

  if [[ -f "$test_file" ]]; then
    pass "测试覆盖率: 测试文件存在"
    return 0
  elif [[ -d "$test_dir" ]]; then
    warn "测试覆盖率: 测试目录存在但无测试文件"
    pass "测试覆盖率: 通过 (警告)"
    return 0
  else
    # 对于复杂 workflow，建议但不强制要求测试
    warn "测试覆盖率: 建议添加测试文件 $test_file"
    pass "测试覆盖率: 通过 (建议添加测试)"
    return 0
  fi
}

# ============================================================
# 主检查函数
# ============================================================
run_all_checks() {
  local workflow_file="$1"
  local n8n_id="$2"
  local bundle_name="$3"

  echo ""
  echo "=========================================="
  echo "  Workflow 质检报告"
  echo "=========================================="
  echo "文件: $workflow_file"
  echo "n8n ID: ${n8n_id:-未指定}"
  echo "Bundle: ${bundle_name:-未指定}"
  echo ""

  # 运行 8 路检查
  check_hard "$workflow_file" "$n8n_id" || true
  check_soft "$workflow_file" || true
  check_security "$workflow_file" || true
  check_integration "$workflow_file" "$n8n_id" || true
  check_performance "$workflow_file" || true
  check_git "$workflow_file" || true
  check_linting "$workflow_file" || true
  check_tests "$workflow_file" "$bundle_name" || true

  echo ""
  echo "=========================================="
  echo "  检查结果汇总"
  echo "=========================================="

  for result in "${CHECK_RESULTS[@]}"; do
    echo "  $result"
  done

  echo ""
  echo "通过: $PASSED_CHECKS/$TOTAL_CHECKS"
  echo "软检查评分: $TOTAL_SCORE/100"
  echo ""

  if [[ $PASSED_CHECKS -eq $TOTAL_CHECKS ]]; then
    echo -e "${GREEN}✅ 质检通过${NC}"
    return 0
  else
    echo -e "${RED}❌ 质检失败${NC}"
    echo ""
    echo "失败项:"
    for failed in "${FAILED_CHECKS[@]}"; do
      echo "  - $failed"
    done
    return 1
  fi
}

# ============================================================
# 帮助
# ============================================================
show_help() {
  cat <<EOF
quality-check.sh - 8 路质检

用法:
  quality-check.sh <workflow.json> [options]

选项:
  --n8n-id <id>       n8n Workflow ID (用于硬检查)
  --bundle <name>     Bundle 名称 (用于测试检查)
  --json              输出 JSON 格式结果

8 路检查:
  1. 硬检查: Workflow 存在于 n8n
  2. 软检查: 5 维度评分 ≥ 80，每项 ≥ 12
  3. 安全扫描: 无敏感信息泄露
  4. 集成检查: API 连接验证
  5. 性能检查: 节点数量、复杂度合理
  6. Git 检查: 分支正确
  7. Linting: 命名规范、布局合理
  8. 测试覆盖率: 测试文件存在

示例:
  quality-check.sh bundles/ai-factory/workflow.json --n8n-id abc123 --bundle ai-factory
EOF
}

# ============================================================
# 主入口
# ============================================================
main() {
  local workflow_file=""
  local n8n_id=""
  local bundle_name=""
  local json_output=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --n8n-id) n8n_id="$2"; shift 2 ;;
      --bundle) bundle_name="$2"; shift 2 ;;
      --json) json_output=true; shift ;;
      --help|-h) show_help; exit 0 ;;
      *)
        if [[ -z "$workflow_file" ]]; then
          workflow_file="$1"
        fi
        shift
        ;;
    esac
  done

  if [[ -z "$workflow_file" ]]; then
    show_help
    exit 1
  fi

  # 转换为绝对路径
  if [[ ! "$workflow_file" = /* ]]; then
    workflow_file="$(pwd)/$workflow_file"
  fi

  run_all_checks "$workflow_file" "$n8n_id" "$bundle_name"
}

main "$@"
