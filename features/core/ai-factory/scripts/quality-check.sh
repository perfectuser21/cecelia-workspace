#!/bin/bash
#
# AI Factory v3.1 - 质检阶段
#
# 用法: quality-check.sh <worktree_path>
#
# 参数:
#   worktree_path - 工作树路径
#
# 输出:
#   JSON 格式: {"passed": true/false, "errors": ["..."]}
#   返回值: 0=通过, 1=失败
#

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"
source "$SCRIPT_DIR/utils.sh"

# ============================================================
# 参数解析
# ============================================================
WORKTREE_PATH="${1:-}"

if [[ -z "$WORKTREE_PATH" ]]; then
  log_error "用法: quality-check.sh <worktree_path>"
  exit 1
fi

if [[ ! -d "$WORKTREE_PATH" ]]; then
  log_error "Worktree 目录不存在: $WORKTREE_PATH"
  exit 1
fi

log_info "=========================================="
log_info "质检阶段开始"
log_info "Worktree: $WORKTREE_PATH"
log_info "=========================================="

# ============================================================
# 检查结果
# ============================================================
ERRORS=()
PASSED=true

# ============================================================
# 检查 1: Git 状态（无合并冲突标记）
# ============================================================
check_git() {
  log_info "[1] 检查 Git 状态..."

  cd "$WORKTREE_PATH" || {
    ERRORS+=("无法进入 worktree 目录")
    PASSED=false
    return 1
  }

  # 检查合并冲突标记
  local conflict_files
  conflict_files=$(grep -rl "^<<<<<<< " \
    --include="*.sh" --include="*.json" --include="*.ts" --include="*.js" --include="*.py" --include="*.tsx" --include="*.jsx" \
    --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build \
    . 2>/dev/null || true)

  if [[ -n "$conflict_files" ]]; then
    local conflict_list
    conflict_list=$(echo "$conflict_files" | head -3 | sed 's/^/  /')
    ERRORS+=("存在合并冲突标记:\n$conflict_list")
    log_error "  ❌ 存在合并冲突标记"
    PASSED=false
    return 1
  fi

  log_info "  ✅ 无合并冲突标记"
  return 0
}

# ============================================================
# 检查 2: TypeScript 编译
# ============================================================
check_typescript() {
  log_info "[2] TypeScript 编译检查..."

  cd "$WORKTREE_PATH" || return 1

  # 查找 TypeScript 配置文件
  local tsconfig_files=()
  while IFS= read -r -d '' file; do
    tsconfig_files+=("$file")
  done < <(find . -name "tsconfig.json" -not -path "*/node_modules/*" -not -path "*/.git/*" -print0 2>/dev/null)

  if [[ ${#tsconfig_files[@]} -eq 0 ]]; then
    log_info "  ⏭️  未找到 tsconfig.json，跳过"
    return 0
  fi

  local has_error=false
  for tsconfig in "${tsconfig_files[@]}"; do
    local project_dir
    project_dir="$(dirname "$tsconfig")"

    log_info "  检查: $tsconfig"

    # 检查是否有 node_modules
    if [[ ! -d "$project_dir/node_modules" ]]; then
      log_warn "  ⚠️  $project_dir 缺少 node_modules，跳过"
      continue
    fi

    # 运行 tsc --noEmit
    local tsc_output
    if tsc_output=$(cd "$project_dir" && npx tsc --noEmit 2>&1); then
      log_info "  ✅ TypeScript 编译通过"
    else
      log_error "  ❌ TypeScript 编译失败"

      # 提取错误摘要（前 5 个错误）
      local error_summary
      error_summary=$(echo "$tsc_output" | grep "error TS" | head -5 | sed 's/^/  /')

      if [[ -n "$error_summary" ]]; then
        ERRORS+=("TypeScript 编译失败 ($project_dir):\n$error_summary")
      else
        ERRORS+=("TypeScript 编译失败: $project_dir")
      fi

      has_error=true
      PASSED=false
    fi
  done

  if [[ "$has_error" == "false" ]]; then
    return 0
  fi

  return 1
}

# ============================================================
# 检查 3: Build 检查
# ============================================================
check_build() {
  log_info "[3] Build 检查..."

  cd "$WORKTREE_PATH" || return 1

  # 查找包含 build 脚本的 package.json
  local package_files=()
  while IFS= read -r -d '' file; do
    if jq -e '.scripts.build' "$file" > /dev/null 2>&1; then
      package_files+=("$file")
    fi
  done < <(find . -name "package.json" -not -path "*/node_modules/*" -not -path "*/.git/*" -print0 2>/dev/null)

  if [[ ${#package_files[@]} -eq 0 ]]; then
    log_info "  ⏭️  未找到 build 脚本，跳过"
    return 0
  fi

  local has_error=false
  for package_json in "${package_files[@]}"; do
    local project_dir
    project_dir="$(dirname "$package_json")"

    log_info "  构建: $project_dir"

    # 检查是否有 node_modules
    if [[ ! -d "$project_dir/node_modules" ]]; then
      log_warn "  ⚠️  $project_dir 缺少 node_modules，跳过"
      continue
    fi

    # 运行 npm run build
    local build_output
    if build_output=$(cd "$project_dir" && npm run build 2>&1); then
      log_info "  ✅ Build 成功"
    else
      log_error "  ❌ Build 失败"

      # 提取错误摘要（最后 10 行）
      local error_summary
      error_summary=$(echo "$build_output" | tail -10 | sed 's/^/  /')

      if [[ -n "$error_summary" ]]; then
        ERRORS+=("Build 失败 ($project_dir):\n$error_summary")
      else
        ERRORS+=("Build 失败: $project_dir")
      fi

      has_error=true
      PASSED=false
    fi
  done

  if [[ "$has_error" == "false" ]]; then
    return 0
  fi

  return 1
}

# ============================================================
# 检查 4: 基础语法检查
# ============================================================
check_syntax() {
  log_info "[4] 基础语法检查..."

  cd "$WORKTREE_PATH" || return 1

  local has_error=false

  # 检查 JSON 文件
  local json_files
  json_files=$(git diff --name-only --diff-filter=AM 2>/dev/null | grep '\.json$' || true)

  if [[ -n "$json_files" ]]; then
    while IFS= read -r json_file; do
      if [[ -f "$json_file" ]]; then
        if ! jq empty "$json_file" 2>/dev/null; then
          ERRORS+=("JSON 语法错误: $json_file")
          log_error "  ❌ JSON 语法错误: $json_file"
          has_error=true
          PASSED=false
        fi
      fi
    done <<< "$json_files"

    if [[ "$has_error" == "false" ]]; then
      log_info "  ✅ JSON 语法正确"
    fi
  fi

  # 检查 Shell 脚本
  local sh_files
  sh_files=$(git diff --name-only --diff-filter=AM 2>/dev/null | grep '\.sh$' || true)

  if [[ -n "$sh_files" ]]; then
    while IFS= read -r sh_file; do
      if [[ -f "$sh_file" ]]; then
        if ! bash -n "$sh_file" 2>/dev/null; then
          ERRORS+=("Shell 脚本语法错误: $sh_file")
          log_error "  ❌ Shell 脚本语法错误: $sh_file"
          has_error=true
          PASSED=false
        fi
      fi
    done <<< "$sh_files"

    if [[ "$has_error" == "false" ]]; then
      log_info "  ✅ Shell 脚本语法正确"
    fi
  fi

  if [[ -z "$json_files" && -z "$sh_files" ]]; then
    log_info "  ⏭️  无需检查的文件"
  fi

  return 0
}

# ============================================================
# 执行所有检查
# ============================================================

check_git || true
check_typescript || true
check_build || true
check_syntax || true

# ============================================================
# 输出结果
# ============================================================
log_info "=========================================="

if [[ "$PASSED" == "true" ]]; then
  log_info "质检通过"
else
  log_error "质检失败，发现 ${#ERRORS[@]} 个问题"
fi

log_info "=========================================="

# 构建 JSON 结果
if [[ ${#ERRORS[@]} -eq 0 ]]; then
  jq -n \
    --argjson passed "$PASSED" \
    --arg checked_at "$(date -Iseconds)" \
    '{
      passed: $passed,
      errors: [],
      checked_at: $checked_at
    }'
else
  # 将 ERRORS 数组转换为 JSON
  local errors_json
  errors_json=$(printf '%s\n' "${ERRORS[@]}" | jq -R . | jq -s .)

  jq -n \
    --argjson passed "$PASSED" \
    --argjson errors "$errors_json" \
    --arg checked_at "$(date -Iseconds)" \
    '{
      passed: $passed,
      errors: $errors,
      checked_at: $checked_at
    }'
fi

# 返回状态码
if [[ "$PASSED" == "true" ]]; then
  exit 0
else
  exit 1
fi
