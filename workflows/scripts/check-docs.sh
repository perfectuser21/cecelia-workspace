#!/bin/bash
# check-docs.sh - 文档一致性检查
# 检查文档完整性、一致性、更新记录

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKFLOWS_DIR="$(dirname "$SCRIPT_DIR")"
REPO_DIR="$(dirname "$WORKFLOWS_DIR")"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 结果收集
ISSUES=()
WARNINGS=()

log() { echo -e "${BLUE}[docs]${NC} $1"; }
pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; ISSUES+=("$1"); }
warn() { echo -e "${YELLOW}⚠${NC} $1"; WARNINGS+=("$1"); }

# ============================================================
# 检查 1: Bundle 文档完整性
# ============================================================
check_bundles() {
  log "检查 1/4: Bundle 文档完整性"

  local bundles_dir="$WORKFLOWS_DIR/bundles"

  if [[ ! -d "$bundles_dir" ]]; then
    warn "bundles 目录不存在"
    return 0
  fi

  for bundle in "$bundles_dir"/*/; do
    [[ ! -d "$bundle" ]] && continue
    local bundle_name=$(basename "$bundle")

    # 检查是否有 bundle.json 或 README
    if [[ ! -f "$bundle/bundle.json" && ! -f "$bundle/README.md" ]]; then
      warn "Bundle $bundle_name 缺少 bundle.json 或 README.md"
    fi
  done

  pass "Bundle 文档完整性检查完成"
}

# ============================================================
# 检查 2: WORKFLOWS.md 与实际 workflow 一致性
# ============================================================
check_workflows_md() {
  log "检查 2/4: WORKFLOWS.md 一致性"

  local workflows_md="$REPO_DIR/WORKFLOWS.md"

  if [[ ! -f "$workflows_md" ]]; then
    fail "WORKFLOWS.md 不存在"
    return 1
  fi

  # 提取 WORKFLOWS.md 中记录的 workflow IDs
  local documented_ids=$(grep -oE '[a-zA-Z0-9]{16}' "$workflows_md" | sort -u)

  # 检查关键 workflow IDs 是否在文档中
  local critical_workflows=(
    "wqeeHpnTcJolnse4"  # 夜间健康检查
    "70DVZ55roILCGAMM"  # 夜间备份
    "wOg5NRZ2yx0D18nY"  # 夜间清理
    "YFqEplFiSl5Qd3x9"  # nightly-scheduler
  )

  local missing=0
  for wf_id in "${critical_workflows[@]}"; do
    if ! echo "$documented_ids" | grep -q "$wf_id"; then
      warn "关键 workflow $wf_id 未在 WORKFLOWS.md 中记录"
      ((missing++))
    fi
  done

  if [[ $missing -eq 0 ]]; then
    pass "WORKFLOWS.md 包含所有关键 workflow"
  fi
}

# ============================================================
# 检查 3: CLAUDE.md 与代码一致性
# ============================================================
check_claude_md() {
  log "检查 3/4: CLAUDE.md 一致性"

  local claude_md="$REPO_DIR/CLAUDE.md"

  if [[ ! -f "$claude_md" ]]; then
    fail "CLAUDE.md 不存在"
    return 1
  fi

  # 检查 CLAUDE.md 中的端口信息
  local ports_in_doc=$(grep -oE '192[0-9]{2}' "$claude_md" | sort -u | wc -l)

  # 检查脚本中引用的端口
  local ports_in_scripts=0
  for script in "$REPO_DIR"/*.sh "$REPO_DIR"/scripts/*.sh; do
    [[ -f "$script" ]] && ports_in_scripts=$((ports_in_scripts + $(grep -oE '192[0-9]{2}' "$script" 2>/dev/null | wc -l)))
  done

  # 检查关键配置项
  local missing_configs=()

  # 检查 VPS IP
  if ! grep -q "146.190.52.84" "$claude_md"; then
    missing_configs+=("VPS IP")
  fi

  # 检查 n8n URL
  if ! grep -q "zenithjoy21xx.app.n8n.cloud" "$claude_md"; then
    missing_configs+=("n8n URL")
  fi

  # 检查 SSH 凭据 ID
  if ! grep -q "vvJsQOZ95sqzemla" "$claude_md"; then
    missing_configs+=("SSH 凭据 ID")
  fi

  if [[ ${#missing_configs[@]} -gt 0 ]]; then
    for config in "${missing_configs[@]}"; do
      warn "CLAUDE.md 缺少配置: $config"
    done
  else
    pass "CLAUDE.md 配置完整"
  fi
}

# ============================================================
# 检查 4: 代码变更但文档未更新
# ============================================================
check_doc_updates() {
  log "检查 4/4: 文档更新追踪"

  # 检查今天的 commits
  local today=$(date +%Y-%m-%d)

  # 获取今天的代码变更文件
  local code_files=$(git -C "$REPO_DIR" log --since="$today 00:00" --name-only --pretty=format: 2>/dev/null | \
    grep -vE '^\s*$|\.md$|docs/' | sort -u | wc -l)

  # 获取今天的文档变更文件
  local doc_files=$(git -C "$REPO_DIR" log --since="$today 00:00" --name-only --pretty=format: 2>/dev/null | \
    grep -E '\.md$|docs/' | sort -u | wc -l)

  if [[ $code_files -gt 5 && $doc_files -eq 0 ]]; then
    warn "今天有 $code_files 个代码文件变更，但没有文档更新"
  elif [[ $code_files -gt 0 ]]; then
    pass "代码变更: $code_files 文件, 文档变更: $doc_files 文件"
  else
    pass "今天暂无代码变更"
  fi

  # 检查最近的重要脚本是否有对应文档
  local scripts_without_docs=()
  for script in "$REPO_DIR"/workflows/scripts/*.sh; do
    [[ ! -f "$script" ]] && continue
    local script_name=$(basename "$script" .sh)

    # 检查是否在 CLAUDE.md 或任何文档中提及
    if ! grep -rq "$script_name" "$REPO_DIR"/*.md "$REPO_DIR"/docs/ 2>/dev/null; then
      scripts_without_docs+=("$script_name")
    fi
  done

  if [[ ${#scripts_without_docs[@]} -gt 0 ]]; then
    for script in "${scripts_without_docs[@]}"; do
      warn "脚本 $script 未在文档中记录"
    done
  fi
}

# ============================================================
# 生成 JSON 报告
# ============================================================
generate_report() {
  local report_file="$HOME/maintenance-reports/docs-check-$(date +%Y%m%d).json"
  mkdir -p "$(dirname "$report_file")"

  local issues_json="[]"
  local warnings_json="[]"

  if [[ ${#ISSUES[@]} -gt 0 ]]; then
    issues_json=$(printf '%s\n' "${ISSUES[@]}" | jq -R . | jq -s .)
  fi
  if [[ ${#WARNINGS[@]} -gt 0 ]]; then
    warnings_json=$(printf '%s\n' "${WARNINGS[@]}" | jq -R . | jq -s .)
  fi

  cat > "$report_file" << JSONEOF
{
  "success": $([ ${#ISSUES[@]} -eq 0 ] && echo "true" || echo "false"),
  "issues": ${issues_json:-[]},
  "issues_count": ${#ISSUES[@]},
  "warnings": ${warnings_json:-[]},
  "warnings_count": ${#WARNINGS[@]},
  "timestamp": "$(date -Iseconds)",
  "report_file": "$report_file"
}
JSONEOF

  # 输出 JSON 结果
  cat "$report_file"
}

# ============================================================
# 主函数
# ============================================================
main() {
  echo ""
  echo "=========================================="
  echo "  文档一致性检查"
  echo "=========================================="
  echo "项目: $REPO_DIR"
  echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""

  check_bundles
  check_workflows_md
  check_claude_md
  check_doc_updates

  echo ""
  echo "=========================================="
  echo "  检查结果汇总"
  echo "=========================================="
  echo "Issues: ${#ISSUES[@]}"
  echo "Warnings: ${#WARNINGS[@]}"
  echo ""

  if [[ ${#ISSUES[@]} -eq 0 && ${#WARNINGS[@]} -eq 0 ]]; then
    echo -e "${GREEN}✅ 文档检查通过${NC}"
  elif [[ ${#ISSUES[@]} -eq 0 ]]; then
    echo -e "${YELLOW}⚠️ 文档检查通过（有警告）${NC}"
  else
    echo -e "${RED}❌ 文档检查失败${NC}"
  fi

  echo ""
  generate_report
}

main "$@"
