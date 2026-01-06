#!/bin/bash
#
# AI Factory - 收尾阶段脚本
#
# 用法: cleanup.sh <task_id> <execution_result>
#
# 参数:
#   task_id          - Notion 任务 ID
#   execution_result - 执行结果 (success / failed)
#
# 流程:
#   1. 如果 success: 尝试合并到 main
#      - 合并成功 → 清理 worktree → AI Done
#      - 合并冲突 → 保留 worktree → AI Done (备注需人工处理)
#   2. 如果 failed: 保留 worktree → AI Failed
#   3. 更新 Notion 状态
#   4. 写执行报告到 Notion
#   5. 发飞书通知
#

# 版本号常量
AI_FACTORY_VERSION="3.2.1"

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"
source "$SCRIPT_DIR/utils.sh"
source "$SCRIPT_DIR/worktree-manager.sh"

# ============================================================
# 锁机制 - 防止同一任务的 cleanup 被重复执行
# ============================================================
LOCK_DIR="${DATA_DIR}/locks"
mkdir -p "$LOCK_DIR"

acquire_lock() {
  local task_id="$1"
  local lock_file="${LOCK_DIR}/cleanup-${task_id}.lock"

  # 使用 flock 获取独占锁，非阻塞模式
  exec 200>"$lock_file"
  if ! flock -n 200; then
    echo "ERROR: cleanup 已在执行中 (task: $task_id)，跳过重复执行" >&2
    return 1
  fi

  # 写入 PID 用于调试
  echo "$$" > "$lock_file"
  return 0
}

release_lock() {
  local task_id="$1"
  local lock_file="${LOCK_DIR}/cleanup-${task_id}.lock"

  # 释放锁并清理文件
  flock -u 200 2>/dev/null || true
  rm -f "$lock_file" 2>/dev/null || true
}

# 脚本退出时释放锁
cleanup_on_exit() {
  if [[ -n "$TASK_ID" ]]; then
    release_lock "$TASK_ID"
  fi
}
trap cleanup_on_exit EXIT

# ============================================================
# 参数解析
# ============================================================
TASK_ID=""
EXECUTION_RESULT=""
START_TIME=""
MODEL=""

# 解析命令行参数
while [[ $# -gt 0 ]]; do
  case "$1" in
    --start-time)
      START_TIME="$2"
      shift 2
      ;;
    --model)
      MODEL="$2"
      shift 2
      ;;
    *)
      if [[ -z "$TASK_ID" ]]; then
        TASK_ID="$1"
      elif [[ -z "$EXECUTION_RESULT" ]]; then
        EXECUTION_RESULT="$1"
      fi
      shift
      ;;
  esac
done

if [[ -z "$TASK_ID" || -z "$EXECUTION_RESULT" ]]; then
  echo "用法: cleanup.sh <task_id> <execution_result> [--start-time <time>] [--model <model>]"
  echo ""
  echo "参数:"
  echo "  task_id          Notion 任务 ID"
  echo "  execution_result success 或 failed"
  echo "  --start-time     任务开始时间（可选）"
  echo "  --model          使用的模型（可选）"
  exit 1
fi

# 验证 execution_result
if [[ "$EXECUTION_RESULT" != "success" && "$EXECUTION_RESULT" != "failed" ]]; then
  log_error "execution_result 必须是 success 或 failed"
  exit 1
fi

# 获取锁，防止同一任务的 cleanup 被重复执行
if ! acquire_lock "$TASK_ID"; then
  exit 0  # 锁已被占用，静默退出
fi

BRANCH_NAME="${GIT_BRANCH_PREFIX}/${TASK_ID}"
WORKTREE_PATH="${WORKTREES_DIR}/${TASK_ID}"
LOG_FILE="${LOGS_DIR}/cleanup-${TASK_ID}.log"
NOTION_URL="https://notion.so/${TASK_ID//-/}"

# 确保日志目录存在
mkdir -p "$LOGS_DIR"

log_info "=========================================="
log_info "AI Factory v${AI_FACTORY_VERSION} - 收尾阶段"
log_info "=========================================="
log_info "Task ID: $TASK_ID"
log_info "执行结果: $EXECUTION_RESULT"
log_info "分支: $BRANCH_NAME"
log_info "Worktree: $WORKTREE_PATH"
log_info "模型: ${MODEL:-未指定}"
log_info "开始时间: ${START_TIME:-未记录}"
log_info "=========================================="

# ============================================================
# 获取任务信息
# ============================================================
log_info "[1/5] 获取任务信息..."

TASK_NAME="Unknown Task"

TASK_INFO=$(fetch_notion_task "$TASK_ID" 2>/dev/null) || true
if [[ -n "$TASK_INFO" ]]; then
  TASK_NAME=$(echo "$TASK_INFO" | jq -r '.task_name // "Unknown Task"')
fi

log_info "任务名称: $TASK_NAME"

# ============================================================
# 提前统计文件改动数（在 worktree 被清理前）
# ============================================================
CHANGED_FILES_COUNT=0
if [[ -d "$WORKTREE_PATH" ]]; then
  cd "$WORKTREE_PATH" 2>/dev/null || true
  # 获取当前分支与 main 的差异统计
  local_diff_stat=$(git diff --stat origin/${GIT_BASE_BRANCH}..HEAD 2>/dev/null | tail -1)
  if [[ -n "$local_diff_stat" ]]; then
    # 从 "X files changed" 中提取文件数
    CHANGED_FILES_COUNT=$(echo "$local_diff_stat" | grep -oE '[0-9]+ file' | grep -oE '[0-9]+' | head -1)
    [[ -z "$CHANGED_FILES_COUNT" ]] && CHANGED_FILES_COUNT=0
  fi
  log_info "统计文件改动数: ${CHANGED_FILES_COUNT} 个文件"
fi

# ============================================================
# 处理执行结果
# ============================================================
log_info "[2/5] 处理执行结果..."

FINAL_STATUS=""
MERGE_RESULT=""
HAS_CONFLICT=false
CONFLICT_FILES=""
REPORT_CONTENT=""

if [[ "$EXECUTION_RESULT" == "success" ]]; then
  log_info "执行成功，尝试合并到 $GIT_BASE_BRANCH..."

  # 先在 worktree 中提交更改（如果有）
  if [[ -d "$WORKTREE_PATH" ]]; then
    cd "$WORKTREE_PATH" || true
    # 检查是否有未暂存或未跟踪的更改
    if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
      log_info "提交 worktree 中的更改..."

      # 添加所有更改
      git add -A 2>/dev/null || true

      # 只有在有更改的情况下才提交
      if git diff --cached --quiet 2>/dev/null; then
        log_info "没有需要提交的更改"
      else
        git commit -m "feat(${TASK_ID:0:8}): $TASK_NAME

Task: $NOTION_URL

Generated by AI Factory v${AI_FACTORY_VERSION}

Co-Authored-By: Claude <noreply@anthropic.com>" 2>/dev/null || true

        # 推送分支
        if timeout "$GIT_TIMEOUT" git push -u origin "$BRANCH_NAME" 2>/dev/null; then
          log_info "分支已推送: $BRANCH_NAME"
        else
          log_warn "推送分支失败"
        fi
      fi
    else
      log_info "worktree 中没有未提交的更改"
    fi
  fi

  # 尝试合并
  MERGE_RESULT=$(merge_to_main "$BRANCH_NAME")

  case "$MERGE_RESULT" in
    success)
      log_info "合并成功"
      FINAL_STATUS="AI Done"

      # 清理 worktree
      if [[ "$CLEANUP_ON_SUCCESS" == "true" ]]; then
        log_info "清理 worktree..."
        cleanup_worktree "$TASK_ID" "true" || log_warn "清理 worktree 失败"
      fi

      REPORT_CONTENT="# 执行报告 [SUCCESS]

## 基本信息
- 任务: ${TASK_NAME}

- 状态: 成功
- 执行时间: $(date '+%Y-%m-%d %H:%M:%S')

## 合并结果
- 分支 ${BRANCH_NAME} 已成功合并到 ${GIT_BASE_BRANCH}
- Worktree 已清理

---
Generated by AI Factory v${AI_FACTORY_VERSION}"
      ;;

    conflict)
      log_warn "合并冲突"
      FINAL_STATUS="AI Done"
      HAS_CONFLICT=true

      # 获取冲突文件列表
      CONFLICT_FILES=$(get_conflict_files "$BRANCH_NAME" 2>/dev/null | head -20)

      log_warn "冲突文件列表:"
      echo "$CONFLICT_FILES" | while read -r file; do
        [[ -n "$file" ]] && log_warn "  - $file"
      done

      REPORT_CONTENT="# 执行报告 [CONFLICT]

## 基本信息
- 任务: ${TASK_NAME}

- 状态: 需人工处理合并冲突
- 执行时间: $(date '+%Y-%m-%d %H:%M:%S')

## 冲突信息
分支 ${BRANCH_NAME} 与 ${GIT_BASE_BRANCH} 存在合并冲突。

### 可能冲突的文件
${CONFLICT_FILES}

### 人工处理步骤
1. 进入 worktree 目录:
   cd ${WORKTREE_PATH}

2. 或者在主仓库处理:
   cd ${PROJECT_DIR}
   git checkout ${GIT_BASE_BRANCH}
   git pull origin ${GIT_BASE_BRANCH}
   git merge ${BRANCH_NAME}

3. 解决冲突后提交:
   git add .
   git commit
   git push origin ${GIT_BASE_BRANCH}

4. 清理 worktree:
   ${SCRIPT_DIR}/worktree-manager.sh cleanup ${TASK_ID}

---
Generated by AI Factory v${AI_FACTORY_VERSION}"
      ;;

    no_changes)
      log_info "没有更改需要合并"
      FINAL_STATUS="AI Done"

      # 清理 worktree
      if [[ "$CLEANUP_ON_SUCCESS" == "true" ]]; then
        cleanup_worktree "$TASK_ID" "true" || log_warn "清理 worktree 失败"
      fi

      REPORT_CONTENT="# 执行报告 [SUCCESS]

## 基本信息
- 任务: ${TASK_NAME}

- 状态: 成功 (无代码更改)
- 执行时间: $(date '+%Y-%m-%d %H:%M:%S')

## 备注
任务执行完成，但没有产生代码更改。

---
Generated by AI Factory v${AI_FACTORY_VERSION}"
      ;;

    error|*)
      log_error "合并失败"
      FINAL_STATUS="AI Failed"

      REPORT_CONTENT="# 执行报告 [FAILED]

## 基本信息
- 任务: ${TASK_NAME}

- 状态: 失败
- 执行时间: $(date '+%Y-%m-%d %H:%M:%S')

## 失败原因
合并操作失败，请检查分支状态。

### 调试信息
- 分支: ${BRANCH_NAME}
- Worktree: ${WORKTREE_PATH}

---
Generated by AI Factory v${AI_FACTORY_VERSION}"
      ;;
  esac

else
  # 执行失败
  log_error "执行失败，保留 worktree 用于调试"
  FINAL_STATUS="AI Failed"

  REPORT_CONTENT="# 执行报告 [FAILED]

## 基本信息
- 任务: ${TASK_NAME}

- 状态: 执行失败
- 执行时间: $(date '+%Y-%m-%d %H:%M:%S')

## 调试信息
- 分支: ${BRANCH_NAME}
- Worktree: ${WORKTREE_PATH} (已保留)

### 排查步骤
1. 进入 worktree 目录查看代码:
   cd ${WORKTREE_PATH}

2. 查看执行日志:
   cat ${LOG_FILE}

3. 修复后重新执行或手动完成

---
Generated by AI Factory v${AI_FACTORY_VERSION}"
fi

log_info "最终状态: $FINAL_STATUS"

# ============================================================
# 更新 Notion 状态
# ============================================================
log_info "[3/5] 更新 Notion 状态..."

if update_notion_status "$TASK_ID" "$FINAL_STATUS"; then
  log_info "Notion 状态已更新: $FINAL_STATUS"
else
  log_warn "更新 Notion 状态失败"
fi

# ============================================================
# 写报告到 Notion
# ============================================================
log_info "[4/6] 写执行报告到 Notion..."

if [[ -n "$REPORT_CONTENT" ]]; then
  if append_to_notion_page "$TASK_ID" "$REPORT_CONTENT"; then
    log_info "报告已写入 Notion"
  else
    log_warn "写入报告失败"
  fi
fi

# ============================================================
# 追加执行摘要到 Notion
# ============================================================
log_info "[5/6] 追加执行摘要到 Notion..."

# 获取当前时间作为结束时间
END_TIME=$(date '+%Y-%m-%d %H:%M:%S')

# 确定摘要状态
SUMMARY_STATUS="$EXECUTION_RESULT"
if [[ "$EXECUTION_RESULT" == "success" && "$HAS_CONFLICT" == "true" ]]; then
  SUMMARY_STATUS="conflict"
fi

# 调用 append_execution_summary（传入预先统计的文件改动数）
if append_execution_summary "$TASK_ID" "$SUMMARY_STATUS" "$START_TIME" "$END_TIME" "$MODEL" "$WORKTREE_PATH" "$BRANCH_NAME" "$CHANGED_FILES_COUNT"; then
  log_info "执行摘要已追加"
else
  log_warn "追加执行摘要失败"
fi

# ============================================================
# 发送飞书通知
# ============================================================
log_info "[6/6] 发送飞书通知..."

FEISHU_TITLE=""
FEISHU_STATUS=""
FEISHU_CONTENT=""

if [[ "$FINAL_STATUS" == "AI Done" ]]; then
  if [[ "$HAS_CONFLICT" == "true" ]]; then
    FEISHU_TITLE="任务完成 - 需处理合并冲突"
    FEISHU_STATUS="warning"
    FEISHU_CONTENT="**任务**: ${TASK_NAME}

**状态**: 代码已完成，但有合并冲突

**冲突文件**:
\`\`\`
$(echo "$CONFLICT_FILES" | head -10)
\`\`\`

请手动处理合并冲突后，运行:
\`\`\`
${SCRIPT_DIR}/worktree-manager.sh cleanup ${TASK_ID}
\`\`\`"
  else
    FEISHU_TITLE="任务完成"
    FEISHU_STATUS="success"
    FEISHU_CONTENT="**任务**: ${TASK_NAME}

**状态**: 已完成并合并到 ${GIT_BASE_BRANCH}

请验收代码。"
  fi
else
  FEISHU_TITLE="任务执行失败"
  FEISHU_STATUS="failed"
  FEISHU_CONTENT="**任务**: ${TASK_NAME}

**状态**: 执行失败

**调试信息**:
- Worktree: \`${WORKTREE_PATH}\`
- 日志: \`${LOG_FILE}\`

请查看日志排查问题。"
fi

send_feishu_card "$FEISHU_TITLE" "$FEISHU_STATUS" "$FEISHU_CONTENT" "$NOTION_URL" || log_warn "飞书通知发送失败"

# ============================================================
# 输出结果
# ============================================================
log_info "=========================================="
log_info "收尾阶段完成"
log_info "=========================================="

# 输出 JSON 结果
# 转换 bash boolean 为 JSON boolean
if [[ "$HAS_CONFLICT" == "true" ]]; then
  JSON_CONFLICT="true"
else
  JSON_CONFLICT="false"
fi

jq -n \
  --arg task_id "$TASK_ID" \
  --arg execution_result "$EXECUTION_RESULT" \
  --arg final_status "$FINAL_STATUS" \
  --arg merge_result "$MERGE_RESULT" \
  --argjson has_conflict "$JSON_CONFLICT" \
  --arg worktree_path "$WORKTREE_PATH" \
  --arg branch_name "$BRANCH_NAME" \
  --arg version "$AI_FACTORY_VERSION" \
  '{
    task_id: $task_id,
    execution_result: $execution_result,
    final_status: $final_status,
    merge_result: $merge_result,
    has_conflict: $has_conflict,
    worktree_path: $worktree_path,
    branch_name: $branch_name,
    version: $version,
    timestamp: now | todate
  }'

# 返回状态码
if [[ "$FINAL_STATUS" == "AI Done" ]]; then
  exit 0
else
  exit 1
fi
