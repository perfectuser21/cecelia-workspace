#!/bin/bash
#
# AI 工厂 v2 主入口脚本
# 负责：协调四个阶段的执行，处理返工逻辑
#
# 用法: main.sh <task_id> <coding_type>
#
# 参数:
#   task_id     - Notion 任务 ID
#   coding_type - n8n / backend / frontend
#
# 环境变量:
#   MAX_RETRIES    - 最大返工次数（默认 2）
#   STABILITY_RUNS - 稳定性验证次数（默认 3，质检通过后再跑N次确认）
#   FULL_RETRY_MAX - 稳定性验证失败后整体重试次数（默认 1）
#   RETRY_DELAY    - 返工/重试前的等待时间秒数（默认 2）
#
# 输出:
#   - JSON 格式的执行结果
#   - 返回值:
#     0 = 成功
#     1 = 一般失败
#     2 = 失败需人工处理（质检失败或超过最大返工次数）
#     3 = 质检超时
#     4 = 准备阶段失败
#     5 = 准备数据异常
#     6 = 致命错误（如脚本不存在）
#

set -e

# 环境变量安全设置
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
IFS=$' \t\n'
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# v1.1: 使用固定位置的 shared 脚本，避免 git checkout 影响
SHARED_DIR="/home/xx/bin/ai-factory-v2"

# 加载工具函数
source "$SHARED_DIR/utils.sh"

# 检查必需的命令
for cmd in jq curl git; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "错误: $cmd 未安装"
    exit 1
  }
done

# 检查 bash 版本
if [[ "${BASH_VERSINFO[0]}" -lt 4 ]]; then
  echo "错误: 需要 bash 4.0 或更高版本 (当前: $BASH_VERSION)"
  exit 1
fi

# ============================================================
# 参数解析
# ============================================================
TASK_ID="${1:-}"
CODING_TYPE="${2:-}"

# P0 修复: 验证数值变量，防止非数字值导致算术运算失败
validate_numeric() {
  local var_name="$1"
  local var_value="$2"
  local default="$3"

  if [[ ! "$var_value" =~ ^[0-9]+$ ]]; then
    echo "$var_name 不是有效数字 ('$var_value')，使用默认值 $default" >&2
    echo "$default"
  else
    echo "$var_value"
  fi
}

# Ralph Wiggum 模式：无限循环直到成功
MAX_RETRIES=$(validate_numeric "MAX_RETRIES" "${MAX_RETRIES:-9999}" 9999)
STABILITY_RUNS=$(validate_numeric "STABILITY_RUNS" "${STABILITY_RUNS:-0}" 0)
FULL_RETRY_MAX=$(validate_numeric "FULL_RETRY_MAX" "${FULL_RETRY_MAX:-1}" 1)
RETRY_DELAY=$(validate_numeric "RETRY_DELAY" "${RETRY_DELAY:-2}" 2)

if [[ -z "$TASK_ID" ]]; then
  echo "用法: main.sh <task_id> <coding_type>"
  echo ""
  echo "参数:"
  echo "  task_id     - Notion 任务 ID"
  echo "  coding_type - n8n / backend / frontend"
  echo ""
  echo "示例:"
  echo "  main.sh abc123def456 n8n"
  exit 1
fi

if [[ -z "$CODING_TYPE" ]]; then
  echo "错误: 缺少 coding_type 参数"
  exit 1
fi

# 验证 coding_type
case "$CODING_TYPE" in
  n8n|backend|frontend|check)
    ;;
  *)
    echo "错误: 无效的 coding_type: $CODING_TYPE (应为: n8n/backend/frontend/check)"
    exit 1
    ;;
esac

# ============================================================
# 获取锁
# ============================================================
if ! load_secrets; then
  echo "错误: 加载 secrets 失败"
  exit 1
fi
if ! acquire_lock; then
  echo "错误: 无法获取执行锁，另一个任务正在执行"
  curl -sX PATCH "https://api.notion.com/v1/pages/$TASK_ID" -H "Authorization: Bearer $NOTION_API_KEY" -H "Notion-Version: 2022-06-28" -H "Content-Type: application/json" -d '{"properties":{"Status":{"status":{"name":"Next Action"}}}}' > /dev/null 2>&1 || true
  exit 1
fi

# 信号处理函数
# P0 修复: 使用数字 0/1 代替字符串，简化 trap 逻辑防止竞态
LOCK_RELEASED=0
CLEANUP_IN_PROGRESS=0
SIGNAL_RECEIVED=""

cleanup_and_exit() {
  local saved_exit_code=$?  # 保存进入时的退出码
  local sig="${1:-EXIT}"

  # P0 修复: 立即屏蔽信号，防止重入
  trap '' SIGINT SIGTERM SIGHUP

  # 防止重复触发（双重保险）
  if [[ $CLEANUP_IN_PROGRESS -eq 1 ]]; then
    # 如果是 EXIT trap 触发但已经清理过，直接返回
    [[ "$sig" == "EXIT" ]] && return $saved_exit_code
    return 0
  fi
  CLEANUP_IN_PROGRESS=1
  SIGNAL_RECEIVED="$sig"

  log_warn "收到信号 $sig，开始清理..."

  # 杀死所有子进程
  local child_pids
  child_pids=$(jobs -p 2>/dev/null) || true
  if [[ -n "$child_pids" ]]; then
    log_warn "终止子进程: $child_pids"
    kill $child_pids 2>/dev/null || true
    sleep 1
    kill -9 $child_pids 2>/dev/null || true
  fi

  # 释放锁
  if [[ $LOCK_RELEASED -eq 0 ]]; then
    release_lock
    LOCK_RELEASED=1
  fi

  # P0 修复: 信号触发时直接 exit，不返回（避免 EXIT trap 再次触发清理逻辑）
  # EXIT trap 会自动触发，但 CLEANUP_IN_PROGRESS=1 会阻止重复执行
  if [[ "$sig" != "EXIT" ]]; then
    exit 130
  fi

  return $saved_exit_code
}

# P0 修复: 设置 trap 确保锁释放
# 信号 trap 和 EXIT trap 分开处理，cleanup_and_exit 内部防止重复执行
trap 'cleanup_and_exit SIGINT' SIGINT
trap 'cleanup_and_exit SIGTERM' SIGTERM
trap 'cleanup_and_exit SIGHUP' SIGHUP
trap 'cleanup_and_exit EXIT' EXIT

# ============================================================
# 初始化
# ============================================================
RUN_ID=$(generate_run_id)
RETRY_COUNT=0
STABILITY_COUNT=0
FULL_RETRY_COUNT=0
FINAL_RESULT=""
PASSED=false
FATAL_ERROR=false
# P1 修复: 添加标志区分不同失败类型
QUALITY_FAILED_MANUAL=false
QUALITY_TIMEOUT=false

echo "=========================================="
echo "AI 工厂 v2"
echo "=========================================="
echo "Task ID: $TASK_ID"
echo "Coding Type: $CODING_TYPE"
echo "Run ID: $RUN_ID"
echo "Max Retries: $MAX_RETRIES"
echo "Stability Runs: $STABILITY_RUNS"
echo "Full Retry Max: $FULL_RETRY_MAX"
echo "=========================================="

# ============================================================
# 阶段 1: 准备
# ============================================================
echo ""
echo "[阶段 1/4] 准备"
echo "----------------------------------------"

# 日志输出到终端(stderr)，JSON结果捕获到变量(stdout)
# P1 修复: 添加 timeout 控制，超时后 10 秒强杀
PREPARE_EXIT=0
PREPARE_RESULT=$(timeout -k 10 300 "$SHARED_DIR/prepare.sh" "$TASK_ID" "$CODING_TYPE" "$RUN_ID" 2>&1) || PREPARE_EXIT=$?
# 等待子进程确保退出
wait 2>/dev/null || true
if [[ $PREPARE_EXIT -ne 0 ]]; then
  # P0 修复: 区分超时和其他失败
  case $PREPARE_EXIT in
    124) echo "准备阶段超时 (exit code: 124, 超过 5 分钟)" ;;
    137) echo "准备阶段被强制终止 (exit code: 137, SIGKILL)" ;;
    *)   echo "准备阶段失败 (exit code: $PREPARE_EXIT)" ;;
  esac
  echo "更新 Notion 状态为 AI Failed..."
  curl -sX PATCH "https://api.notion.com/v1/pages/$TASK_ID" -H "Authorization: Bearer $NOTION_API_KEY" -H "Notion-Version: 2022-06-28" -H "Content-Type: application/json" -d '{"properties":{"Status":{"status":{"name":"AI Failed"}}}}' > /dev/null 2>&1 || true
  exit 4
fi

# 解析准备结果（只取最后的 JSON 块）
# 使用 grep -n 找到最后一个以 { 开头的行号，然后从该行开始提取
LAST_JSON_LINE=$(echo "$PREPARE_RESULT" | grep -n '^{' | tail -1 | cut -d: -f1)
if [[ -n "$LAST_JSON_LINE" ]]; then
  PREPARE_JSON=$(echo "$PREPARE_RESULT" | tail -n +"$LAST_JSON_LINE" | head -100)
else
  PREPARE_JSON=""
fi
WORK_DIR=$(echo "$PREPARE_JSON" | jq -r '.work_dir // empty' 2>/dev/null)
TASK_INFO_PATH=$(echo "$PREPARE_JSON" | jq -r '.task_info_path // empty' 2>/dev/null)

if [[ -z "$WORK_DIR" || -z "$TASK_INFO_PATH" ]]; then
  echo "准备阶段返回数据异常"
  curl -sX PATCH "https://api.notion.com/v1/pages/$TASK_ID" -H "Authorization: Bearer $NOTION_API_KEY" -H "Notion-Version: 2022-06-28" -H "Content-Type: application/json" -d '{"properties":{"Status":{"status":{"name":"AI Failed"}}}}' > /dev/null 2>&1 || true
  echo "Raw result: $PREPARE_RESULT"
  exit 5
fi

echo "准备完成: $WORK_DIR"

# ============================================================
# 阶段 2 & 3 & 3.5: 执行 + 质检 + 稳定性验证（带整体重试）
# ============================================================
while [[ $FULL_RETRY_COUNT -le $FULL_RETRY_MAX ]]; do
  # 如果是整体重试，显示提示并清理上次结果
  if [[ $FULL_RETRY_COUNT -gt 0 ]]; then
    echo ""
    echo "=========================================="
    echo "[整体重试 $FULL_RETRY_COUNT/$FULL_RETRY_MAX]"
    echo "=========================================="
    # 删除上次结果，强制重新开始
    rm -f "$WORK_DIR/result.json"
    rm -f "$WORK_DIR/quality_report.json"
    RETRY_COUNT=0  # 重置返工计数
    STABILITY_COUNT=0  # 重置稳定性验证计数
  fi

  # ------------------------------------------------------------
  # 执行 + 质检循环（带返工）
  # ------------------------------------------------------------
  while [[ $RETRY_COUNT -le $MAX_RETRIES ]]; do
  echo ""
  if [[ $RETRY_COUNT -gt 0 ]]; then
    echo "[返工 $RETRY_COUNT/$MAX_RETRIES]"
    # 删除上次结果，强制重新执行
    rm -f "$WORK_DIR/result.json"
  fi

  # ------------------------------------------------------------
  # 阶段 2: 执行
  # ------------------------------------------------------------
  echo "[阶段 2/4] 执行 ($CODING_TYPE)"
  echo "----------------------------------------"

  EXECUTE_SCRIPT="$SCRIPT_DIR/$CODING_TYPE/execute.sh"

  if [[ ! -f "$EXECUTE_SCRIPT" ]]; then
    echo "错误: 执行脚本不存在: $EXECUTE_SCRIPT"
    PASSED=false
    FATAL_ERROR=true
    # P0 修复: 使用 break 2 直接跳出外层循环
    break 2
  fi

  # P1 修复: 添加 timeout 控制，超时后 10 秒强杀
  EXECUTE_RESULT=$(timeout -k 10 600 "$EXECUTE_SCRIPT" "$RUN_ID" "$TASK_INFO_PATH" 2>&1) && EXECUTE_EXIT=0 || EXECUTE_EXIT=$?
  # 等待子进程确保退出
  wait 2>/dev/null || true

  if [[ $EXECUTE_EXIT -ne 0 ]]; then
    # P0 修复: 区分超时(124)和被杀死(137)的退出码
    case $EXECUTE_EXIT in
      124)
        echo "执行阶段超时 (exit code: 124, 超过 10 分钟)"
        echo '{"success": false, "error": "execute_timeout"}' > "$WORK_DIR/result.json"
        ;;
      137)
        echo "执行阶段被强制终止 (exit code: 137, SIGKILL)"
        echo '{"success": false, "error": "execute_killed"}' > "$WORK_DIR/result.json"
        ;;
      *)
        echo "执行阶段失败 (exit code: $EXECUTE_EXIT)"
        echo '{"success": false, "error": "execute_failed"}' > "$WORK_DIR/result.json"
        ;;
    esac

    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [[ $RETRY_COUNT -le $MAX_RETRIES ]]; then
      echo "准备返工..."
      sleep $RETRY_DELAY
      continue
    else
      PASSED=false
      break
    fi
  fi

  echo "执行完成"

  # ------------------------------------------------------------
  # 阶段 3: 质检
  # ------------------------------------------------------------
  echo ""
  echo "[阶段 3/4] 质检"
  echo "----------------------------------------"

  QUALITY_SCRIPT="$SHARED_DIR/quality-check.sh"

  if [[ -f "$QUALITY_SCRIPT" ]]; then
    # P1 修复: 添加 timeout 控制，超时后 10 秒强杀
    QUALITY_RESULT=$(timeout -k 10 300 "$QUALITY_SCRIPT" "$RUN_ID" "$CODING_TYPE" 2>&1) && QUALITY_EXIT=0 || QUALITY_EXIT=$?
    # 等待子进程确保退出
    wait 2>/dev/null || true

    case $QUALITY_EXIT in
      0)
        echo "质检通过"
        # 进入稳定性验证阶段
        PASSED=true
        break
        ;;
      1)
        echo "质检失败，需要返工"
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [[ $RETRY_COUNT -le $MAX_RETRIES ]]; then
          echo "准备返工..."
          sleep $RETRY_DELAY
          continue
        else
          echo "超过最大返工次数，需要人工处理"
          PASSED=false
          break
        fi
        ;;
      2)
        echo "质检失败，需要人工处理"
        PASSED=false
        # P1 修复: 添加标志区分质检失败需人工处理
        QUALITY_FAILED_MANUAL=true
        # P0 修复: 使用 break 2 直接跳出外层循环
        break 2
        ;;
      124)
        # P1 修复: 区分超时退出
        echo "质检脚本超时 (exit code: 124, 超过 5 分钟)"
        PASSED=false
        QUALITY_TIMEOUT=true
        break
        ;;
      137)
        # P0 修复: 区分被强制终止
        echo "质检脚本被强制终止 (exit code: 137, SIGKILL)"
        PASSED=false
        QUALITY_TIMEOUT=true  # 超时后强杀也算超时
        break
        ;;
      *)
        echo "质检脚本异常退出: $QUALITY_EXIT"
        PASSED=false
        break
        ;;
    esac
  else
    # 如果质检脚本不存在，跳过质检（开发阶段）
    echo "质检脚本不存在，跳过质检"
    PASSED=true
    break
  fi
done

# ============================================================
# 阶段 3.5: 稳定性验证（质检通过后再跑N次确认）
# ============================================================
if [[ "$PASSED" == "true" && "$STABILITY_RUNS" -gt 0 ]]; then
  echo ""
  echo "[阶段 3.5] 稳定性验证"
  echo "----------------------------------------"
  echo "质检已通过，再跑 $STABILITY_RUNS 次确认稳定性..."

  STABILITY_COUNT=0
  STABILITY_FAILED=false

  # P1 修复: 按运行次数分离日志文件
  mkdir -p "$WORK_DIR/logs"

  while [[ $STABILITY_COUNT -lt $STABILITY_RUNS ]]; do
    STABILITY_COUNT=$((STABILITY_COUNT + 1))
    echo ""
    echo "[稳定性验证 $STABILITY_COUNT/$STABILITY_RUNS]"

    # P1 修复: 按运行次数分离日志
    STABILITY_LOG="$WORK_DIR/logs/stability-run-$STABILITY_COUNT.log"

    # 重新执行
    echo "  执行中..."
    # P1 修复: 添加 timeout 控制
    EXECUTE_RESULT=$(timeout -k 10 600 "$EXECUTE_SCRIPT" "$RUN_ID" "$TASK_INFO_PATH" 2>"$STABILITY_LOG") && EXECUTE_EXIT=0 || EXECUTE_EXIT=$?
    # 等待子进程确保退出
    wait 2>/dev/null || true

    if [[ $EXECUTE_EXIT -ne 0 ]]; then
      # P0 修复: 区分超时和其他失败
      case $EXECUTE_EXIT in
        124) echo "  执行超时 (第 $STABILITY_COUNT 次, 超过 10 分钟)" ;;
        137) echo "  执行被强制终止 (第 $STABILITY_COUNT 次, SIGKILL)" ;;
        *)   echo "  执行失败 (第 $STABILITY_COUNT 次, exit: $EXECUTE_EXIT)" ;;
      esac
      STABILITY_FAILED=true
      break
    fi

    # 重新质检
    echo "  质检中..."
    # P1 修复: 添加 timeout 控制
    QUALITY_RESULT=$(timeout -k 10 300 "$QUALITY_SCRIPT" "$RUN_ID" "$CODING_TYPE" 2>>"$STABILITY_LOG") && QUALITY_EXIT=0 || QUALITY_EXIT=$?
    # 等待子进程确保退出
    wait 2>/dev/null || true

    if [[ $QUALITY_EXIT -ne 0 ]]; then
      # P0 修复: 区分超时和其他失败
      case $QUALITY_EXIT in
        124) echo "  质检超时 (第 $STABILITY_COUNT 次, 超过 5 分钟)" ;;
        137) echo "  质检被强制终止 (第 $STABILITY_COUNT 次, SIGKILL)" ;;
        *)   echo "  质检失败 (第 $STABILITY_COUNT 次, exit: $QUALITY_EXIT)" ;;
      esac
      STABILITY_FAILED=true
      break
    fi

    echo "  通过"
  done

  if [[ "$STABILITY_FAILED" == "true" ]]; then
    echo ""
    echo "稳定性验证失败！在第 $STABILITY_COUNT 次验证时出错"

    # 检查是否还有整体重试机会
    FULL_RETRY_COUNT=$((FULL_RETRY_COUNT + 1))
    if [[ $FULL_RETRY_COUNT -le $FULL_RETRY_MAX ]]; then
      echo "将进行整体重试 ($FULL_RETRY_COUNT/$FULL_RETRY_MAX)..."
      sleep $RETRY_DELAY
      PASSED=false
      continue  # 继续外层循环，整体重试
    else
      echo "已用完整体重试次数，需要人工处理"
      PASSED=false
      break  # 跳出外层循环
    fi
  else
    echo ""
    echo "稳定性验证通过！连续 $STABILITY_RUNS 次执行全部成功"
    break  # 成功，跳出外层循环
  fi
fi

# P0 修复: 无论成功还是失败，都应该退出外层循环
# - 成功：进入收尾阶段
# - 失败：报告错误
# 整体重试只在稳定性验证失败时触发（在上面的代码里处理）
break

done  # 结束整体重试循环

# ============================================================
# 阶段 4: 收尾
# ============================================================
echo ""
echo "[阶段 4/4] 收尾"
echo "----------------------------------------"

CLEANUP_RESULT=$(timeout -k 10 300 "$SHARED_DIR/cleanup.sh" "$RUN_ID" "$TASK_ID" "$PASSED" "$RETRY_COUNT") || {
  CLEANUP_EXIT=$?
  if [[ $CLEANUP_EXIT -eq 124 ]]; then
    echo "收尾阶段超时（5分钟）"
  else
    echo "收尾阶段失败"
  fi
  echo "$CLEANUP_RESULT"
}

echo "收尾完成"

# ============================================================
# 输出最终结果
# ============================================================
echo ""
echo "=========================================="
echo "执行完成"
echo "=========================================="
echo "Run ID: $RUN_ID"
echo "Task ID: $TASK_ID"
echo "结果: $(if [[ "$PASSED" == "true" ]]; then echo '成功'; else echo '失败'; fi)"
echo "返工次数: $RETRY_COUNT"
if [[ "$PASSED" == "true" ]]; then
  echo "稳定性验证: $STABILITY_COUNT/$STABILITY_RUNS 次通过"
else
  echo "稳定性验证: $STABILITY_COUNT/$STABILITY_RUNS 次 (最后一次失败)"
fi
echo "整体重试: $FULL_RETRY_COUNT/$FULL_RETRY_MAX 次"
echo "=========================================="

# 输出 JSON 结果
FINAL_RESULT=$(jq -n \
  --arg run_id "$RUN_ID" \
  --arg task_id "$TASK_ID" \
  --arg coding_type "$CODING_TYPE" \
  --argjson passed "$PASSED" \
  --argjson retry_count "$RETRY_COUNT" \
  --argjson stability_count "$STABILITY_COUNT" \
  --argjson stability_runs "$STABILITY_RUNS" \
  --argjson full_retry_count "$FULL_RETRY_COUNT" \
  --argjson full_retry_max "$FULL_RETRY_MAX" \
  --arg work_dir "$WORK_DIR" \
  '{
    run_id: $run_id,
    task_id: $task_id,
    coding_type: $coding_type,
    passed: $passed,
    retry_count: $retry_count,
    stability_count: $stability_count,
    stability_runs: $stability_runs,
    full_retry_count: $full_retry_count,
    full_retry_max: $full_retry_max,
    work_dir: $work_dir
  }')

echo "$FINAL_RESULT"

# P1 修复: 返回适当的退出码，区分不同失败类型
if [[ "$PASSED" == "true" ]]; then
  exit 0  # 成功
elif [[ "$QUALITY_FAILED_MANUAL" == "true" ]]; then
  exit 2  # 质检失败，需要人工处理
elif [[ "$QUALITY_TIMEOUT" == "true" ]]; then
  exit 3  # 质检超时
elif [[ "$FATAL_ERROR" == "true" ]]; then
  exit 6  # 致命错误（如脚本不存在）
elif [[ $RETRY_COUNT -gt $MAX_RETRIES ]]; then
  exit 2  # 超过最大返工次数，需要人工处理
else
  exit 1  # 一般失败
fi
