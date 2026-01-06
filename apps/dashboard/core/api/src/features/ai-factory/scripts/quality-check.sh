#!/bin/bash
#
# AI Factory v3.1 - 质检脚本（简化版）
# 只做硬性检查：build、TypeScript、tests
#
# 用法: quality-check.sh <worktree_path>
#
# 输出格式:
#   {"passed": true/false, "errors": [...]}
#
# 返回值:
#   0 = 通过
#   1 = 失败

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

# ============================================================
# 参数验证
# ============================================================
WORKTREE_PATH="${1:-}"

if [[ -z "$WORKTREE_PATH" ]]; then
  echo '{"passed": false, "errors": ["用法: quality-check.sh <worktree_path>"]}'
  exit 1
fi

if [[ ! -d "$WORKTREE_PATH" ]]; then
  echo '{"passed": false, "errors": ["工作目录不存在: '$WORKTREE_PATH'"]}'
  exit 1
fi

# 切换到工作目录
cd "$WORKTREE_PATH" || {
  echo '{"passed": false, "errors": ["无法进入工作目录"]}'
  exit 1
}

# ============================================================
# 检查变量
# ============================================================
ERRORS=()
PASSED=true

# ============================================================
# 检查 1: Git 冲突标记
# ============================================================
check_git_conflicts() {
  log_info "检查 Git 冲突标记..."

  # 查找冲突标记，排除二进制文件和常见生成目录
  local conflict_files
  conflict_files=$(grep -rl "^<<<<<<< \|^======= \|^>>>>>>> " \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir=build \
    --exclude-dir=.git \
    --exclude-dir=.next \
    --exclude-dir=coverage \
    --exclude="*.min.js" \
    --exclude="*.min.css" \
    --exclude="*.map" \
    . 2>/dev/null || true)

  if [[ -n "$conflict_files" ]]; then
    local files_list=$(echo "$conflict_files" | head -3 | tr '\n' ', ' | sed 's/, $//')
    ERRORS+=("存在 Git 冲突标记: $files_list")
    PASSED=false
    return 1
  fi

  log_info "  ✅ 无冲突标记"
  return 0
}

# ============================================================
# 检查 2: Build 构建
# ============================================================
check_build() {
  log_info "检查项目构建..."

  # 检查是否存在构建配置
  local has_build=false
  local build_command=""

  # 检查 package.json
  if [[ -f "package.json" ]]; then
    # 检查是否有 build script
    if jq -e '.scripts.build' package.json > /dev/null 2>&1; then
      has_build=true
      build_command="npm run build"

      # 如果有 pnpm-lock.yaml 使用 pnpm
      if [[ -f "pnpm-lock.yaml" ]]; then
        build_command="pnpm build"
      # 如果有 yarn.lock 使用 yarn
      elif [[ -f "yarn.lock" ]]; then
        build_command="yarn build"
      fi
    fi
  fi

  # 检查子目录的 package.json（如 frontend/, apps/dashboard/frontend/ 等）
  if [[ "$has_build" == "false" ]]; then
    for dir in frontend apps/dashboard/frontend apps/*/frontend; do
      if [[ -f "$dir/package.json" ]]; then
        if jq -e '.scripts.build' "$dir/package.json" > /dev/null 2>&1; then
          has_build=true
          cd "$dir"
          build_command="npm run build"

          if [[ -f "pnpm-lock.yaml" ]]; then
            build_command="pnpm build"
          elif [[ -f "yarn.lock" ]]; then
            build_command="yarn build"
          fi
          break
        fi
      fi
    done
  fi

  if [[ "$has_build" == "false" ]]; then
    log_info "  ⚠️ 未找到构建脚本，跳过"
    return 0
  fi

  log_info "  执行: $build_command"

  # 执行构建（限时 5 分钟）
  local build_output
  local build_exit

  if build_output=$(timeout 300 bash -c "$build_command" 2>&1); then
    build_exit=0
    log_info "  ✅ 构建成功"
  else
    build_exit=$?

    # 提取错误信息（最后 20 行）
    local error_lines=$(echo "$build_output" | tail -20 | head -10)

    # 转义特殊字符
    error_lines=$(echo "$error_lines" | sed 's/"/\\"/g' | tr '\n' ' ')

    ERRORS+=("构建失败: $error_lines")
    PASSED=false
    log_error "  ❌ 构建失败 (exit code: $build_exit)"
    return 1
  fi

  return 0
}

# ============================================================
# 检查 3: TypeScript 类型检查
# ============================================================
check_typescript() {
  log_info "检查 TypeScript 类型..."

  # 查找 tsconfig.json
  local has_typescript=false
  local tsc_command=""

  if [[ -f "tsconfig.json" ]]; then
    has_typescript=true

    # 检查是否有 typecheck script
    if [[ -f "package.json" ]] && jq -e '.scripts.typecheck' package.json > /dev/null 2>&1; then
      # 优先级：pnpm > yarn > npm
      if [[ -f "pnpm-lock.yaml" ]] && command -v pnpm > /dev/null 2>&1; then
        tsc_command="pnpm typecheck"
      elif [[ -f "yarn.lock" ]] && command -v yarn > /dev/null 2>&1; then
        tsc_command="yarn typecheck"
      else
        tsc_command="npm run typecheck"
      fi
    else
      # 直接使用 tsc
      if [[ -f "pnpm-lock.yaml" ]] && command -v pnpm > /dev/null 2>&1; then
        tsc_command="pnpm tsc --noEmit"
      elif [[ -f "yarn.lock" ]] && command -v yarn > /dev/null 2>&1; then
        tsc_command="yarn tsc --noEmit"
      else
        tsc_command="npx tsc --noEmit"
      fi
    fi
  fi

  # 检查子目录
  if [[ "$has_typescript" == "false" ]]; then
    for dir in frontend apps/dashboard/frontend apps/*/frontend; do
      if [[ -f "$dir/tsconfig.json" ]]; then
        has_typescript=true
        cd "$dir"

        if [[ -f "package.json" ]] && jq -e '.scripts.typecheck' package.json > /dev/null 2>&1; then
          if [[ -f "pnpm-lock.yaml" ]]; then
            tsc_command="pnpm typecheck"
          elif [[ -f "yarn.lock" ]]; then
            tsc_command="yarn typecheck"
          else
            tsc_command="npm run typecheck"
          fi
        else
          if [[ -f "pnpm-lock.yaml" ]]; then
            tsc_command="pnpm tsc --noEmit"
          elif [[ -f "yarn.lock" ]]; then
            tsc_command="yarn tsc --noEmit"
          else
            tsc_command="npx tsc --noEmit"
          fi
        fi
        break
      fi
    done
  fi

  if [[ "$has_typescript" == "false" ]]; then
    log_info "  ⚠️ 非 TypeScript 项目，跳过"
    return 0
  fi

  log_info "  执行: $tsc_command"

  # 执行类型检查（限时 3 分钟）
  local tsc_output
  local tsc_exit

  if tsc_output=$(timeout 180 bash -c "$tsc_command" 2>&1); then
    tsc_exit=0
    log_info "  ✅ 类型检查通过"
  else
    tsc_exit=$?

    # 提取错误数量
    local error_count=$(echo "$tsc_output" | grep -E "Found [0-9]+ error" | grep -oE "[0-9]+" | head -1)

    # 提取前 5 个错误
    local error_samples=$(echo "$tsc_output" | grep -E "^[^:]+:[0-9]+:[0-9]+" | head -5 | tr '\n' '; ')

    if [[ -n "$error_count" ]]; then
      ERRORS+=("TypeScript 错误 ($error_count 个): $error_samples")
    else
      ERRORS+=("TypeScript 类型检查失败")
    fi

    PASSED=false
    log_error "  ❌ 类型检查失败 (${error_count:-unknown} errors)"
    return 1
  fi

  return 0
}

# ============================================================
# 检查 4: 测试（如果有）
# ============================================================
check_tests() {
  log_info "检查测试..."

  # 检查是否有测试脚本
  local has_tests=false
  local test_command=""

  if [[ -f "package.json" ]]; then
    # 检查是否有 test script（排除默认的无操作脚本）
    local test_script=$(jq -r '.scripts.test // ""' package.json)

    if [[ -n "$test_script" ]] && \
       [[ "$test_script" != "echo \"Error: no test specified\" && exit 1" ]] && \
       [[ "$test_script" != "echo \"No test specified\"" ]]; then
      has_tests=true

      if [[ -f "pnpm-lock.yaml" ]]; then
        test_command="pnpm test"
      elif [[ -f "yarn.lock" ]]; then
        test_command="yarn test"
      else
        test_command="npm test"
      fi
    fi
  fi

  # 检查子目录
  if [[ "$has_tests" == "false" ]]; then
    for dir in frontend apps/dashboard/frontend apps/*/frontend; do
      if [[ -f "$dir/package.json" ]]; then
        local test_script=$(jq -r '.scripts.test // ""' "$dir/package.json")

        if [[ -n "$test_script" ]] && \
           [[ "$test_script" != "echo \"Error: no test specified\" && exit 1" ]] && \
           [[ "$test_script" != "echo \"No test specified\"" ]]; then
          has_tests=true
          cd "$dir"

          if [[ -f "pnpm-lock.yaml" ]]; then
            test_command="pnpm test"
          elif [[ -f "yarn.lock" ]]; then
            test_command="yarn test"
          else
            test_command="npm test"
          fi
          break
        fi
      fi
    done
  fi

  if [[ "$has_tests" == "false" ]]; then
    log_info "  ⚠️ 未找到测试脚本，跳过"
    return 0
  fi

  log_info "  执行: $test_command"

  # 执行测试（限时 5 分钟）
  # 设置 CI 环境变量，避免交互式模式
  local test_output
  local test_exit

  if test_output=$(CI=true timeout 300 bash -c "$test_command" 2>&1); then
    test_exit=0
    log_info "  ✅ 测试通过"
  else
    test_exit=$?

    # 提取失败的测试数量或错误信息
    local failed_info=$(echo "$test_output" | grep -E "(failed|FAIL)" | head -5 | tr '\n' '; ')

    if [[ -n "$failed_info" ]]; then
      ERRORS+=("测试失败: $failed_info")
    else
      ERRORS+=("测试执行失败 (exit code: $test_exit)")
    fi

    PASSED=false
    log_error "  ❌ 测试失败"
    return 1
  fi

  return 0
}

# ============================================================
# 检查 5: Python 语法检查（如果有）
# ============================================================
check_python() {
  log_info "检查 Python 语法..."

  # 查找 Python 文件
  local py_files
  py_files=$(find . -name "*.py" -type f \
    -not -path "./node_modules/*" \
    -not -path "./.venv/*" \
    -not -path "./venv/*" \
    -not -path "./__pycache__/*" \
    2>/dev/null | head -20)

  if [[ -z "$py_files" ]]; then
    log_info "  ⚠️ 未找到 Python 文件，跳过"
    return 0
  fi

  # 检查语法错误
  local syntax_errors=""
  for file in $py_files; do
    if ! python3 -m py_compile "$file" 2>/dev/null; then
      syntax_errors="$syntax_errors $file"
    fi
  done

  if [[ -n "$syntax_errors" ]]; then
    ERRORS+=("Python 语法错误:$syntax_errors")
    PASSED=false
    log_error "  ❌ Python 语法错误"
    return 1
  fi

  log_info "  ✅ Python 语法检查通过"
  return 0
}

# ============================================================
# 主流程
# ============================================================
log_info "=========================================="
log_info "AI Factory v3.1 质检开始"
log_info "工作目录: $WORKTREE_PATH"
log_info "=========================================="

# 执行各项检查（使用 || true 防止脚本退出）
check_git_conflicts || true
check_build || true
check_typescript || true
check_tests || true
check_python || true

# ============================================================
# 输出结果
# ============================================================
log_info "=========================================="
if [[ "$PASSED" == "true" ]]; then
  log_info "✅ 质检通过"
  echo '{"passed": true, "errors": []}'
  exit 0
else
  log_error "❌ 质检失败"
  log_error "发现 ${#ERRORS[@]} 个问题"

  # 构建 JSON 输出
  # 强制安装 jq 如果不存在（系统必需工具）
  if ! command -v jq > /dev/null 2>&1; then
    log_error "jq 工具不存在，尝试安装..."
    if command -v apt-get > /dev/null 2>&1; then
      sudo apt-get update && sudo apt-get install -y jq > /dev/null 2>&1 || true
    fi
  fi

  # 使用 jq 来确保正确的 JSON 转义
  if command -v jq > /dev/null 2>&1; then
    printf '%s\n' "${ERRORS[@]}" | jq -R -s 'split("\n")[:-1] | {passed: false, errors: .}'
  else
    # 最后的备用方案：只输出简单的错误信息
    echo '{"passed": false, "errors": ["质检失败，请查看日志"]}'
  fi

  exit 1
fi
