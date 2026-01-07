#!/bin/bash
#
# AI Factory v3.0 - Git Worktree 管理器
#
# 功能：
# - create_worktree <task_id>: 创建独立的 Worktree
# - merge_to_main <branch_name>: 合并分支到主分支
# - cleanup_worktree <task_id>: 清理 Worktree
# - list_worktrees: 列出所有活跃的 Worktree
#

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"
source "$SCRIPT_DIR/utils.sh"

# ============================================================
# create_worktree
# ============================================================
# 创建一个新的 Git Worktree
#
# 参数:
#   $1 = task_id (Notion 任务 ID)
#
# 返回:
#   成功: 输出 worktree 路径，返回 0
#   失败: 返回非 0
#
# 示例:
#   worktree_path=$(create_worktree "abc123")
#
create_worktree() {
  local task_id="$1"

  if [[ -z "$task_id" ]]; then
    log_error "task_id 不能为空"
    return 1
  fi

  local branch_name="${GIT_BRANCH_PREFIX}/${task_id}"
  local worktree_path="${WORKTREES_DIR}/${task_id}"

  # 检查主仓库是否存在
  if [[ ! -d "$PROJECT_DIR/.git" ]]; then
    log_error "主仓库不存在: $PROJECT_DIR"
    return 1
  fi

  # 如果 worktree 已存在，直接返回路径
  if [[ -d "$worktree_path" ]]; then
    log_info "Worktree 已存在: $worktree_path"
    echo "$worktree_path"
    return 0
  fi

  # 确保 worktrees 目录存在
  mkdir -p "$WORKTREES_DIR"

  # 进入主仓库
  cd "$PROJECT_DIR" || {
    log_error "无法进入主仓库: $PROJECT_DIR"
    return 1
  }

  # 获取最新的主分支
  log_info "更新主分支 $GIT_BASE_BRANCH..."
  if ! timeout "$GIT_TIMEOUT" git fetch origin "$GIT_BASE_BRANCH" 2>/dev/null; then
    log_warn "无法 fetch 远程分支，使用本地版本"
  fi

  # 检查本地分支是否已存在
  local branch_exists=false
  if git show-ref --verify --quiet "refs/heads/$branch_name"; then
    branch_exists=true
  fi

  # 创建 worktree
  if [[ "$branch_exists" == "true" ]]; then
    # 分支已存在，直接创建 worktree
    log_info "使用现有分支创建 Worktree: $branch_name"
    if ! timeout "$GIT_TIMEOUT" git worktree add "$worktree_path" "$branch_name" 2>/dev/null; then
      log_error "创建 Worktree 失败 (使用现有分支)"
      return 1
    fi
  else
    # 创建新分支并创建 worktree
    log_info "创建新分支和 Worktree: $branch_name"
    if ! timeout "$GIT_TIMEOUT" git worktree add -b "$branch_name" "$worktree_path" "origin/$GIT_BASE_BRANCH" 2>/dev/null; then
      # 如果 origin/$GIT_BASE_BRANCH 不存在，尝试用本地分支
      if ! timeout "$GIT_TIMEOUT" git worktree add -b "$branch_name" "$worktree_path" "$GIT_BASE_BRANCH" 2>/dev/null; then
        log_error "创建 Worktree 失败"
        return 1
      fi
    fi
  fi

  # 验证 worktree 创建成功
  if [[ ! -d "$worktree_path/.git" && ! -f "$worktree_path/.git" ]]; then
    log_error "Worktree 验证失败: $worktree_path"
    return 1
  fi

  log_info "Worktree 创建成功: $worktree_path"
  log_info "分支: $branch_name"

  echo "$worktree_path"
  return 0
}

# ============================================================
# merge_to_main
# ============================================================
# 将指定分支合并到主分支
#
# 参数:
#   $1 = branch_name (要合并的分支名)
#
# 返回:
#   "success" - 合并成功
#   "conflict" - 合并冲突
#   "no_changes" - 没有更改需要合并
#   "error" - 其他错误
#
# 注意:
#   - 在主仓库中执行操作（不是 worktree）
#   - 合并成功后会自动推送到远程
#   - 冲突时会 abort 合并，不会留下脏状态
#
merge_to_main() {
  local branch_name="$1"

  if [[ -z "$branch_name" ]]; then
    log_error "branch_name 不能为空"
    echo "error"
    return 1
  fi

  # 进入主仓库
  cd "$PROJECT_DIR" || {
    log_error "无法进入主仓库: $PROJECT_DIR"
    echo "error"
    return 1
  }

  # 检查分支是否存在
  if ! git show-ref --verify --quiet "refs/heads/$branch_name"; then
    log_error "分支不存在: $branch_name"
    echo "error"
    return 1
  fi

  # 检查分支是否有提交
  local main_commit feature_commit
  main_commit=$(git rev-parse "$GIT_BASE_BRANCH" 2>/dev/null)
  feature_commit=$(git rev-parse "$branch_name" 2>/dev/null)

  if [[ "$main_commit" == "$feature_commit" ]]; then
    log_info "分支没有新的提交，跳过合并"
    echo "no_changes"
    return 0
  fi

  # 确保工作区干净（忽略未跟踪文件）
  # 只检查已修改(M)、已删除(D)、已添加(A)等，忽略未跟踪(??)
  if git status --porcelain | grep -qE "^[MADRC]"; then
    log_error "主仓库有未提交的更改，无法合并"
    git status --porcelain | grep -E "^[MADRC]" | head -5 >&2
    echo "error"
    return 1
  fi

  # 切换到主分支
  log_info "切换到 $GIT_BASE_BRANCH..."
  if ! timeout "$GIT_TIMEOUT" git checkout "$GIT_BASE_BRANCH" >/dev/null 2>&1; then
    log_error "无法切换到 $GIT_BASE_BRANCH"
    echo "error"
    return 1
  fi

  # 拉取最新
  log_info "拉取最新的 $GIT_BASE_BRANCH..."
  if ! timeout "$GIT_TIMEOUT" git pull origin "$GIT_BASE_BRANCH" >/dev/null 2>&1; then
    log_warn "无法拉取远程分支，使用本地版本"
  fi

  # 先尝试 rebase 到最新的 master，避免分叉冲突
  log_info "Rebase 分支 $branch_name 到最新的 $GIT_BASE_BRANCH..."
  if timeout "$GIT_TIMEOUT" git checkout "$branch_name" >/dev/null 2>&1; then
    if timeout "$GIT_TIMEOUT" git rebase "$GIT_BASE_BRANCH" >/dev/null 2>&1; then
      log_info "Rebase 成功"
    else
      log_warn "Rebase 失败，尝试 abort 并继续合并"
      git rebase --abort 2>/dev/null || true
    fi
    # 切回主分支
    timeout "$GIT_TIMEOUT" git checkout "$GIT_BASE_BRANCH" >/dev/null 2>&1
  else
    log_warn "无法切换到 $branch_name，跳过 rebase"
  fi

  # 尝试合并（使用 --no-edit 避免打开编辑器）
  log_info "合并分支: $branch_name -> $GIT_BASE_BRANCH"
  local merge_output
  if merge_output=$(timeout "$GIT_TIMEOUT" git merge --no-edit "$branch_name" 2>&1); then
    # 合并成功
    log_info "合并成功"

    # 推送到远程
    log_info "推送到远程..."
    if timeout "$GIT_TIMEOUT" git push origin "$GIT_BASE_BRANCH" 2>/dev/null; then
      log_info "推送成功"
    else
      log_warn "推送失败，但本地合并已完成"
    fi

    echo "success"
    return 0
  else
    # 检查是否是冲突
    if echo "$merge_output" | grep -qi "conflict\|CONFLICT"; then
      log_warn "合并冲突，正在 abort..."

      # 获取冲突文件列表
      local conflict_files
      conflict_files=$(git diff --name-only --diff-filter=U 2>/dev/null | head -20)

      # Abort 合并
      git merge --abort 2>/dev/null

      log_warn "冲突文件:"
      echo "$conflict_files" | while read -r file; do
        log_warn "  - $file"
      done

      echo "conflict"
      return 0
    else
      # 其他错误
      log_error "合并失败: $merge_output"
      git merge --abort 2>/dev/null || true
      echo "error"
      return 1
    fi
  fi
}

# ============================================================
# get_conflict_files
# ============================================================
# 获取潜在冲突文件列表（在实际合并之前检测）
#
# 参数:
#   $1 = branch_name (要检查的分支名)
#
# 返回:
#   可能冲突的文件列表（每行一个）
#
get_conflict_files() {
  local branch_name="$1"

  if [[ -z "$branch_name" ]]; then
    return 1
  fi

  cd "$PROJECT_DIR" || return 1

  # 使用 git merge-tree 检测潜在冲突
  local base_commit
  base_commit=$(git merge-base "$GIT_BASE_BRANCH" "$branch_name" 2>/dev/null)

  if [[ -z "$base_commit" ]]; then
    return 1
  fi

  # 获取分支修改的文件
  git diff --name-only "$base_commit" "$branch_name" 2>/dev/null
}

# ============================================================
# cleanup_worktree
# ============================================================
# 清理 Worktree 和相关分支
#
# 参数:
#   $1 = task_id (Notion 任务 ID)
#   $2 = delete_branch (可选，默认 true，是否删除分支)
#
# 返回:
#   0 = 成功
#   1 = 失败
#
cleanup_worktree() {
  local task_id="$1"
  local delete_branch="${2:-true}"

  if [[ -z "$task_id" ]]; then
    log_error "task_id 不能为空"
    return 1
  fi

  local branch_name="${GIT_BRANCH_PREFIX}/${task_id}"
  local worktree_path="${WORKTREES_DIR}/${task_id}"

  # 进入主仓库
  cd "$PROJECT_DIR" || {
    log_error "无法进入主仓库: $PROJECT_DIR"
    return 1
  }

  # 移除 worktree
  if [[ -d "$worktree_path" ]]; then
    log_info "移除 Worktree: $worktree_path"

    # 先尝试正常移除
    if ! timeout "$GIT_TIMEOUT" git worktree remove "$worktree_path" 2>/dev/null; then
      # 如果失败，强制移除
      log_warn "正常移除失败，尝试强制移除..."
      if ! timeout "$GIT_TIMEOUT" git worktree remove --force "$worktree_path" 2>/dev/null; then
        # 最后手段：手动删除目录
        log_warn "强制移除失败，手动删除目录..."
        rm -rf "$worktree_path"
      fi
    fi
  fi

  # 清理悬挂的 worktree 引用
  git worktree prune 2>/dev/null

  # 删除分支（如果指定）
  if [[ "$delete_branch" == "true" ]]; then
    if git show-ref --verify --quiet "refs/heads/$branch_name"; then
      log_info "删除分支: $branch_name"
      if ! timeout "$GIT_TIMEOUT" git branch -D "$branch_name" 2>/dev/null; then
        log_warn "删除本地分支失败"
      fi

      # 删除远程分支（可选）
      if timeout "$GIT_TIMEOUT" git push origin --delete "$branch_name" 2>/dev/null; then
        log_info "远程分支已删除"
      else
        log_debug "远程分支不存在或删除失败"
      fi
    fi
  fi

  log_info "Worktree 清理完成: $task_id"
  return 0
}

# ============================================================
# list_worktrees
# ============================================================
# 列出所有活跃的 Worktree
#
# 输出格式:
#   JSON 数组，每个元素包含 worktree 路径、分支名、提交哈希
#
list_worktrees() {
  cd "$PROJECT_DIR" || {
    log_error "无法进入主仓库: $PROJECT_DIR"
    return 1
  }

  # 使用 git worktree list --porcelain 获取结构化输出
  local worktree_output
  worktree_output=$(git worktree list --porcelain 2>/dev/null)

  if [[ -z "$worktree_output" ]]; then
    echo "[]"
    return 0
  fi

  # 解析输出并构建 JSON
  local json_result="["
  local first=true
  local current_path=""
  local current_head=""
  local current_branch=""

  while IFS= read -r line; do
    if [[ "$line" == worktree\ * ]]; then
      # 如果有前一个 worktree，添加到结果
      if [[ -n "$current_path" && "$first" == "false" ]]; then
        json_result+=","
      fi
      if [[ -n "$current_path" ]]; then
        first=false
        # 只包含在 WORKTREES_DIR 下的 worktree
        if [[ "$current_path" == "$WORKTREES_DIR"* ]]; then
          local task_id
          task_id=$(basename "$current_path")
          json_result+=$(jq -n \
            --arg path "$current_path" \
            --arg branch "$current_branch" \
            --arg head "$current_head" \
            --arg task_id "$task_id" \
            '{path: $path, branch: $branch, head: $head, task_id: $task_id}')
        fi
      fi
      current_path="${line#worktree }"
      current_head=""
      current_branch=""
    elif [[ "$line" == HEAD\ * ]]; then
      current_head="${line#HEAD }"
    elif [[ "$line" == branch\ * ]]; then
      current_branch="${line#branch refs/heads/}"
    fi
  done <<< "$worktree_output"

  # 处理最后一个 worktree
  if [[ -n "$current_path" && "$current_path" == "$WORKTREES_DIR"* ]]; then
    if [[ "$first" == "false" ]]; then
      json_result+=","
    fi
    local task_id
    task_id=$(basename "$current_path")
    json_result+=$(jq -n \
      --arg path "$current_path" \
      --arg branch "$current_branch" \
      --arg head "$current_head" \
      --arg task_id "$task_id" \
      '{path: $path, branch: $branch, head: $head, task_id: $task_id}')
  fi

  json_result+="]"
  echo "$json_result"
}

# ============================================================
# 如果直接运行脚本，作为命令行工具使用
# ============================================================
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  case "${1:-}" in
    create)
      create_worktree "${2:-}"
      ;;
    merge)
      merge_to_main "${2:-}"
      ;;
    cleanup)
      cleanup_worktree "${2:-}" "${3:-true}"
      ;;
    list)
      list_worktrees
      ;;
    conflict-check)
      get_conflict_files "${2:-}"
      ;;
    *)
      echo "用法: $0 <command> [args]"
      echo ""
      echo "命令:"
      echo "  create <task_id>             创建 Worktree"
      echo "  merge <branch_name>          合并分支到主分支"
      echo "  cleanup <task_id> [delete_branch]  清理 Worktree"
      echo "  list                         列出所有 Worktree"
      echo "  conflict-check <branch>      检查潜在冲突文件"
      exit 1
      ;;
  esac
fi

# ============================================================
# 导出函数
# ============================================================
export -f create_worktree merge_to_main cleanup_worktree list_worktrees get_conflict_files
