#!/bin/bash
#
# AI Factory v3.1 - 主执行入口
#
# 用法: executor.sh <task_id> [options]
#
# 参数:
#   task_id     - Notion 任务 ID
#
# 选项:
#   --model     - 使用的模型 (默认: sonnet)
#   --budget    - 最大预算 USD (默认: 5)
#   --ralph     - 使用 Ralph loop 模式 (默认)
#   --simple    - 使用简单的 claude -p 单次执行
#   --max-iter  - Ralph 最大迭代次数 (默认: 30)
#   --dry-run   - 只准备，不执行
#
# 流程:
#   1. prepare.sh  - 准备阶段（获取任务、创建 worktree、生成 prompt）
#   2. 执行阶段   - Ralph loop 或 claude -p
#   3. cleanup.sh  - 收尾阶段（合并、通知）
#

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"
source "$SCRIPT_DIR/utils.sh"

# Ralph plugin 路径
# RALPH_SETUP_SCRIPT="$HOME/.claude/plugins/cache/claude-plugins-official/ralph-wiggum/unknown/scripts/setup-ralph-loop.sh"  # Currently unused

# 参数解析
TASK_ID=""
MODEL="opus"
BUDGET="100"  # Max 用户，不限制
MAX_ITERATIONS="30"
USE_RALPH=true
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --model)
      MODEL="$2"
      shift 2
      ;;
    --budget)
      BUDGET="$2"
      shift 2
      ;;
    --max-iter|--max-iterations)
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    --ralph)
      USE_RALPH=true
      shift
      ;;
    --simple)
      USE_RALPH=false
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -*)
      log_error "未知选项: $1"
      exit 1
      ;;
    *)
      if [[ -z "$TASK_ID" ]]; then
        TASK_ID="$1"
      fi
      shift
      ;;
  esac
done

if [[ -z "$TASK_ID" ]]; then
  echo "用法: executor.sh <task_id> [options]"
  echo ""
  echo "参数:"
  echo "  task_id          Notion 任务 ID"
  echo ""
  echo "选项:"
  echo "  --model MODEL    模型 (sonnet/opus/haiku, 默认: sonnet)"
  echo "  --budget USD     最大预算 (默认: 5)"
  echo "  --max-iter N     Ralph 最大迭代次数 (默认: 30)"
  echo "  --ralph          使用 Ralph loop 模式 (默认)"
  echo "  --simple         使用 claude -p 单次执行"
  echo "  --dry-run        只准备，不执行"
  exit 1
fi

# LOG_FILE="${LOGS_DIR}/executor-${TASK_ID}.log"  # Currently unused
mkdir -p "$LOGS_DIR"

# 记录开始时间
START_TIME=$(date '+%Y-%m-%d %H:%M:%S')

log_info "AI Factory v3.1 - 开始执行"
log_info "Task ID: $TASK_ID"
log_info "Model: $MODEL"
log_info "Budget: $BUDGET USD"
log_info "Mode: $(if $USE_RALPH; then echo "Ralph loop (max $MAX_ITERATIONS)"; else echo "Simple"; fi)"
log_info "Dry Run: $DRY_RUN"
log_info "Start Time: $START_TIME"

# 阶段 1: 准备
log_info "[1/3] 准备阶段..."

PREPARE_OUTPUT=$("$SCRIPT_DIR/prepare.sh" "$TASK_ID" 2>&1)
PREPARE_EXIT=$?

# 提取 JSON（从第一个 { 到最后一个 }）
PREPARE_RESULT=$(echo "$PREPARE_OUTPUT" | sed -n '/^{$/,/^}$/p')

if [[ $PREPARE_EXIT -ne 0 || -z "$PREPARE_RESULT" ]]; then
  log_error "准备阶段失败"
  log_error "$PREPARE_OUTPUT"
  send_feishu_card "任务准备失败" "failed" "Task ID: $TASK_ID\n\n错误: 准备阶段失败" \
    "https://notion.so/${TASK_ID//-/}" || true
  exit 1
fi

# 解析准备结果
WORKTREE_PATH=$(echo "$PREPARE_RESULT" | jq -r '.worktree_path // empty')
PROMPT_FILE=$(echo "$PREPARE_RESULT" | jq -r '.prompt_file // empty')
TASK_NAME=$(echo "$PREPARE_RESULT" | jq -r '.task_name // "Unknown"')

if [[ -z "$WORKTREE_PATH" || -z "$PROMPT_FILE" ]]; then
  log_error "准备结果解析失败"
  log_error "PREPARE_RESULT: $PREPARE_RESULT"
  exit 1
fi

log_info "Worktree: $WORKTREE_PATH"
log_info "Prompt: $PROMPT_FILE"
log_info "任务: $TASK_NAME"

# 阶段 2: 执行
if [[ "$DRY_RUN" == "true" ]]; then
  log_info "[2/3] 执行阶段 (跳过 - dry run)"
  log_info "Prompt 内容:"
  cat "$PROMPT_FILE"
  EXECUTION_RESULT="success"
else
  log_info "[2/3] 执行阶段..."

  # 读取 prompt
  PROMPT=$(cat "$PROMPT_FILE")

  # 切换到 worktree 目录执行
  cd "$WORKTREE_PATH" || {
    log_error "无法进入 worktree: $WORKTREE_PATH"
    exit 1
  }

  CLAUDE_OUTPUT_FILE="${LOGS_DIR}/claude-${TASK_ID}.log"

  if [[ "$USE_RALPH" == "true" ]]; then
    log_info "启动 Headless Ralph Loop..."
    log_info "  模型: $MODEL"
    log_info "  最大迭代: $MAX_ITERATIONS"

    ITERATION=1
    EXECUTION_RESULT="failed"
    ITERATION_TIMEOUT=600  # 每次迭代最多 10 分钟
    QUALITY_CHECK_FEEDBACK=""  # 质检失败时的反馈信息

    while [[ $ITERATION -le $MAX_ITERATIONS ]]; do
      log_info "━━━ Ralph 迭代 $ITERATION/$MAX_ITERATIONS ━━━"

      ITERATION_OUTPUT="${LOGS_DIR}/claude-${TASK_ID}-iter${ITERATION}.log"

      # 获取上次改动（git diff）
      PREVIOUS_CHANGES=""
      if [[ $ITERATION -gt 1 ]]; then
        # 获取未暂存的改动
        GIT_DIFF=$(git diff 2>/dev/null | head -500)
        # 获取已暂存的改动
        GIT_DIFF_STAGED=$(git diff --cached 2>/dev/null | head -200)
        # 获取未跟踪的新文件列表
        GIT_UNTRACKED=$(git status --porcelain 2>/dev/null | grep "^??" | head -20)

        if [[ -n "$GIT_DIFF" || -n "$GIT_DIFF_STAGED" || -n "$GIT_UNTRACKED" ]]; then
          PREVIOUS_CHANGES="
## Previous Changes (from iteration $((ITERATION-1)))

### Modified files:
\`\`\`diff
${GIT_DIFF:-No unstaged changes}
\`\`\`

### Staged changes:
\`\`\`diff
${GIT_DIFF_STAGED:-No staged changes}
\`\`\`

### New files:
${GIT_UNTRACKED:-None}

Review the above changes and continue working on the task.
"
          log_info "检测到之前的改动，已加入 prompt"
        fi
      fi

      # 构建带迭代信息的 prompt
      ITERATION_PROMPT="$PROMPT
$QUALITY_CHECK_FEEDBACK
$PREVIOUS_CHANGES
---
🔄 Ralph iteration $ITERATION/$MAX_ITERATIONS
To complete: output <promise>TASK_COMPLETE</promise> when ALL requirements are met."

      # 运行 claude -p
      if timeout "$ITERATION_TIMEOUT" cd "$WORKTREE_PATH" && claude -p \
        --model "$MODEL" \
        --permission-mode "bypassPermissions" \
        --dangerously-skip-permissions \
        "$ITERATION_PROMPT" > "$ITERATION_OUTPUT" 2>&1; then

        # 检查输出中是否包含完成标记
        if grep -q "<promise>TASK_COMPLETE</promise>" "$ITERATION_OUTPUT"; then
          log_info "✅ 检测到 <promise>TASK_COMPLETE</promise>"

          log_info "开始质检..."
          QUALITY_CHECK_OUTPUT=$("$SCRIPT_DIR/quality-check.sh" "$WORKTREE_PATH" 2>&1)
          QUALITY_CHECK_EXIT=$?

          # 提取 JSON 结果（最后一个以 { 开头的行）
          QUALITY_RESULT=$(echo "$QUALITY_CHECK_OUTPUT" | grep '^{' | tail -1)

          if [[ $QUALITY_CHECK_EXIT -eq 0 ]]; then
            log_info "✅ 质检通过"
            EXECUTION_RESULT="success"
            QUALITY_CHECK_FEEDBACK=""  # 清除质检反馈
            break
          else
            log_warn "❌ 质检失败，继续下一次迭代..."

            # 提取错误信息（每个错误一行，编号显示）
            QUALITY_ERRORS=$(echo "$QUALITY_RESULT" | jq -r '.errors[] | "- " + .' 2>/dev/null || echo "- 质检失败（未知错误）")

            # 将错误信息保存到 QUALITY_CHECK_FEEDBACK，会在下一次迭代使用
            QUALITY_CHECK_FEEDBACK="
## ❌ Quality Check Failed

质检阶段发现以下问题，需要修复：

$QUALITY_ERRORS

**Please fix these issues before marking the task as complete.**
"

            log_info "错误信息已加入下一次迭代的 prompt"
          fi
        else
          log_info "未检测到完成标记，继续下一次迭代..."
        fi
      else
        EXIT_CODE=$?
        if [[ $EXIT_CODE -eq 124 ]]; then
          log_warn "迭代 $ITERATION 超时"
        else
          log_warn "迭代 $ITERATION 异常退出 (code: $EXIT_CODE)"
        fi
      fi

      # 合并日志
      cat "$ITERATION_OUTPUT" >> "$CLAUDE_OUTPUT_FILE" 2>/dev/null || true
      echo -e "\n--- End of iteration $ITERATION ---\n" >> "$CLAUDE_OUTPUT_FILE"

      ((ITERATION++))
    done

    if [[ "$EXECUTION_RESULT" == "success" ]]; then
      log_info "Ralph Loop 完成 (迭代: $((ITERATION)))"
    else
      log_warn "Ralph Loop 达到最大迭代次数 ($MAX_ITERATIONS)"
      # 检查是否有实质性的代码改动
      if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
        log_info "检测到代码改动，标记为成功"
        EXECUTION_RESULT="success"
      fi
    fi

  else
    log_info "启动 Claude Code (简单模式)..."
    log_info "  模型: $MODEL"
    log_info "  预算: $BUDGET USD"

    if cd "$WORKTREE_PATH" && claude -p \
      --model "$MODEL" \
      --permission-mode "bypassPermissions" \
      --dangerously-skip-permissions \
      "$PROMPT" > "$CLAUDE_OUTPUT_FILE" 2>&1; then
      EXECUTION_RESULT="success"
      log_info "Claude Code 执行成功"
    else
      EXECUTION_RESULT="failed"
      log_error "Claude Code 执行失败"
    fi
  fi

  # 记录输出摘要
  if [[ -f "$CLAUDE_OUTPUT_FILE" ]]; then
    OUTPUT_LINES=$(wc -l < "$CLAUDE_OUTPUT_FILE")
    log_info "Claude 输出: $OUTPUT_LINES 行"
    log_info "日志: $CLAUDE_OUTPUT_FILE"
  fi
fi

# 阶段 3: 收尾
log_info "[3/3] 收尾阶段..."

CLEANUP_OUTPUT=$("$SCRIPT_DIR/cleanup.sh" "$TASK_ID" "$EXECUTION_RESULT" --start-time "$START_TIME" --model "$MODEL" 2>&1)
# CLEANUP_EXIT=$?  # Currently unused

# 提取 JSON（从第一个 { 到最后一个 }）
CLEANUP_RESULT=$(echo "$CLEANUP_OUTPUT" | sed -n '/^{$/,/^}$/p')

# 提取最终状态
FINAL_STATUS=$(echo "$CLEANUP_RESULT" | jq -r '.final_status // "Unknown"')
HAS_CONFLICT=$(echo "$CLEANUP_RESULT" | jq -r '.has_conflict // false')

log_info "AI Factory v3.1 - 执行完成"
log_info "任务: $TASK_NAME"
log_info "执行结果: $EXECUTION_RESULT"
log_info "最终状态: $FINAL_STATUS"
log_info "有冲突: $HAS_CONFLICT"

# 输出最终结果
jq -n \
  --arg task_id "$TASK_ID" \
  --arg task_name "$TASK_NAME" \
  --arg execution_result "$EXECUTION_RESULT" \
  --arg final_status "$FINAL_STATUS" \
  --argjson has_conflict "$HAS_CONFLICT" \
  --arg worktree_path "$WORKTREE_PATH" \
  --arg model "$MODEL" \
  --argjson use_ralph "$USE_RALPH" \
  '{
    task_id: $task_id,
    task_name: $task_name,
    execution_result: $execution_result,
    final_status: $final_status,
    has_conflict: $has_conflict,
    worktree_path: $worktree_path,
    model: $model,
    use_ralph: $use_ralph,
    timestamp: now | todate
  }'

# 返回状态码
if [[ "$FINAL_STATUS" == "AI Done" ]]; then
  exit 0
else
  exit 1
fi
