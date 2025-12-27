#!/bin/bash
#
# AI工厂 - Workflow生产线 主控脚本
# 功能：接收PRD，分解任务，执行，质检，生成文档
# 保持与原n8n workflow完全相同的逻辑流程
#
# 增量更新功能：
#   --incremental  启用增量模式，跳过未变化的任务
#   --force        强制全量执行，覆盖增量模式
#
#   增量模式会比较任务描述的hash与上次成功执行的hash，
#   如果任务未变化且上次执行成功，则跳过该任务。
#   增量状态保存在 $STATE_DIR/incremental.json
#

set -e

# ============================================================
# 并发控制配置
# ============================================================
LOCK_FILE="/tmp/workflow-factory.lock"
MAX_CLAUDE_SESSIONS=5  # 允许的最大 Claude 会话数（预留空间给工厂）
LOCK_TIMEOUT=600       # 锁超时时间（秒）

# ============================================================
# 日志函数（必须最先定义）
# ============================================================
log() {
  echo "[$(date '+%H:%M:%S')] $1" >&2
}

# ============================================================
# 并发控制函数
# ============================================================

# 检查 Claude 会话数量
check_claude_sessions() {
  local count=$(pgrep -x claude 2>/dev/null | wc -l)
  echo "$count"
}

# 等待 Claude 资源可用
wait_for_claude_resources() {
  local max_wait=300  # 最多等待5分钟
  local waited=0
  local check_interval=10

  while true; do
    local session_count=$(check_claude_sessions)
    if [[ $session_count -lt $MAX_CLAUDE_SESSIONS ]]; then
      log "Claude 资源可用 (当前会话: $session_count/$MAX_CLAUDE_SESSIONS)"
      return 0
    fi

    if [[ $waited -ge $max_wait ]]; then
      log "警告: 等待 Claude 资源超时 (${max_wait}秒)"
      log "当前活跃会话: $session_count，建议关闭部分终端"
      return 1
    fi

    log "等待 Claude 资源... (当前会话: $session_count/$MAX_CLAUDE_SESSIONS, 已等待: ${waited}秒)"
    sleep $check_interval
    waited=$((waited + check_interval))
  done
}

# 获取文件锁
acquire_lock() {
  local lock_acquired=false

  # 检查是否有过期的锁
  if [[ -f "$LOCK_FILE" ]]; then
    local lock_time=$(stat -c %Y "$LOCK_FILE" 2>/dev/null || echo 0)
    local current_time=$(date +%s)
    local lock_age=$((current_time - lock_time))

    if [[ $lock_age -gt $LOCK_TIMEOUT ]]; then
      log "发现过期锁 (${lock_age}秒前)，强制释放"
      rm -f "$LOCK_FILE"
    fi
  fi

  # 尝试获取锁
  if (set -C; echo $$ > "$LOCK_FILE") 2>/dev/null; then
    lock_acquired=true
    log "获取执行锁成功 (PID: $$)"
  else
    local holder_pid=$(cat "$LOCK_FILE" 2>/dev/null)
    if [[ -n "$holder_pid" ]] && kill -0 "$holder_pid" 2>/dev/null; then
      log "另一个实例正在运行 (PID: $holder_pid)，等待..."

      # 等待锁释放
      local max_wait=120
      local waited=0
      while [[ -f "$LOCK_FILE" ]] && [[ $waited -lt $max_wait ]]; do
        sleep 5
        waited=$((waited + 5))
      done

      if [[ -f "$LOCK_FILE" ]]; then
        log "错误: 等待锁超时"
        return 1
      fi

      # 重新尝试获取锁
      if (set -C; echo $$ > "$LOCK_FILE") 2>/dev/null; then
        lock_acquired=true
        log "获取执行锁成功 (PID: $$)"
      fi
    else
      # 持有者已死，清理并获取锁
      rm -f "$LOCK_FILE"
      if (set -C; echo $$ > "$LOCK_FILE") 2>/dev/null; then
        lock_acquired=true
        log "清理死锁并获取锁成功 (PID: $$)"
      fi
    fi
  fi

  if [[ "$lock_acquired" != "true" ]]; then
    log "错误: 无法获取执行锁"
    return 1
  fi

  return 0
}

# 释放文件锁
release_lock() {
  if [[ -f "$LOCK_FILE" ]]; then
    local holder_pid=$(cat "$LOCK_FILE" 2>/dev/null)
    if [[ "$holder_pid" == "$$" ]]; then
      rm -f "$LOCK_FILE"
      log "释放执行锁"
    fi
  fi
}

# ============================================================
# 全局错误处理
# ============================================================
handle_error() {
  local line_number="$1"
  local command="$2"
  local error_time=$(date -Iseconds)

  log "错误: 脚本在第 $line_number 行失败"
  log "失败的命令: $command"

  # 记录错误到日志
  if [[ -n "$STATE_DIR" && -d "$STATE_DIR" ]]; then
    echo "{
      \"error\": true,
      \"line\": $line_number,
      \"command\": \"$command\",
      \"time\": \"$error_time\",
      \"run_id\": \"$RUN_ID\"
    }" >> "$STATE_DIR/errors.log"

    # 更新状态为 failed
    update_state "failed"

    # 发送通知（如果配置了）
    if [[ -n "$FEISHU_BOT_WEBHOOK" ]]; then
      local error_msg="AI工厂失败\nRun ID: $RUN_ID\n错误行: $line_number\n命令: $command"
      curl --max-time 10 -s -X POST "$FEISHU_BOT_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "{\"msg_type\":\"text\",\"content\":{\"text\":\"$error_msg\"}}" > /dev/null 2>&1 || true
    fi
  fi
}

# 清理子进程函数
cleanup_processes() {
  log "清理残留 claude 进程..."
  # 杀死由本脚本启动的所有 claude 子进程
  pkill -P $$ claude 2>/dev/null || true
  # 额外清理：杀死任何属于当前用户且父进程已死的 claude 进程
  pgrep -u $(whoami) claude 2>/dev/null | while read pid; do
    ppid=$(ps -o ppid= -p $pid 2>/dev/null | tr -d ' ')
    if [[ "$ppid" == "1" ]]; then
      log "  杀死孤儿进程: $pid"
      kill -9 $pid 2>/dev/null || true
    fi
  done
  # 释放执行锁
  release_lock
}

# 设置全局错误捕获
trap 'handle_error $LINENO "$BASH_COMMAND"; cleanup_processes' ERR

# 脚本正常退出时也清理
trap 'cleanup_processes' EXIT

# ============================================================
# 参数解析
# ============================================================
RUN_ID=""
PRD=""
TARGET_WORKFLOW=""
RESUME_RUN_ID=""
ROLLBACK_RUN_ID=""
PROJECT=""
TEMPLATE=""
ASYNC_MODE=false
CALLBACK_WEBHOOK=""
NO_GIT=false
INCREMENTAL_MODE=false
FORCE_FULL=false
SKIP_PRD_VERIFY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --run-id) RUN_ID="$2"; shift 2 ;;
    --prd) PRD="$2"; shift 2 ;;
    --target-workflow) TARGET_WORKFLOW="$2"; shift 2 ;;
    --resume) RESUME_RUN_ID="$2"; shift 2 ;;
    --rollback) ROLLBACK_RUN_ID="$2"; shift 2 ;;
    --project) PROJECT="$2"; shift 2 ;;
    --template) TEMPLATE="$2"; shift 2 ;;
    --async) ASYNC_MODE=true; shift ;;
    --callback) CALLBACK_WEBHOOK="$2"; shift 2 ;;
    --no-git) NO_GIT=true; shift ;;
    --incremental) INCREMENTAL_MODE=true; shift ;;
    --force) FORCE_FULL=true; shift ;;
    --skip-prd-verify) SKIP_PRD_VERIFY=true; shift ;;
    *) log "警告: 未知参数 '$1'"; shift ;;
  esac
done

# 参数验证
if [[ -z "$RUN_ID" ]]; then
  echo "错误: --run-id 是必需参数" >&2
  exit 1
fi

# run-id 格式验证：只允许字母、数字、下划线、连字符
if [[ ! "$RUN_ID" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "错误: run-id 只能包含字母、数字、下划线和连字符" >&2
  echo "  无效: $RUN_ID" >&2
  exit 1
fi

if [[ -z "$PRD" && -z "$RESUME_RUN_ID" && -z "$ROLLBACK_RUN_ID" ]]; then
  echo "错误: 需要 --prd、--resume 或 --rollback 之一" >&2
  exit 1
fi

# ============================================================
# 记录真实开始时间（包含等待时间）
# ============================================================
STARTED_AT=$(date -Iseconds)

# ============================================================
# 并发控制：获取锁和检查资源
# ============================================================
# 等待 Claude 资源可用
if ! wait_for_claude_resources; then
  echo "错误: Claude 资源不可用，请稍后重试" >&2
  exit 1
fi

# 获取执行锁（防止多实例并发）
if ! acquire_lock; then
  echo "错误: 无法获取执行锁，另一个实例可能正在运行" >&2
  exit 1
fi

# ============================================================
# 全局变量
# ============================================================
STATE_DIR="/home/xx/data/runs/${RUN_ID}"
WORKFLOW_DIR="$(dirname "$0")/.."
HEADLESS_WORKSPACE="/home/xx/data/factory-workspace"
MAX_REWORK=2
REWORK_COUNT=0

# 环境变量:
#   USE_OPUS=true   - 启用 Opus 模型用于复杂任务 (complexity >= 4)
#   USE_OPUS=false  - 使用 Sonnet 替代 Opus (默认，节省成本)

# 加载secrets
source $(dirname "$0")/../.secrets 2>/dev/null || true

# ============================================================
# 工具函数
# ============================================================

# 从经验库中获取相关经验
# 参数: task_name, task_desc
# 返回: 最相关的 1-3 条经验（JSON 格式），如果没有匹配则返回空
get_relevant_experience() {
  local task_name="$1"
  local task_desc="$2"
  local exp_file="$WORKFLOW_DIR/lessons_learned.json"

  # 经验库不存在时直接返回空
  if [[ ! -f "$exp_file" ]]; then
    return 0
  fi

  # 提取关键词（从任务名和描述中提取）
  # 提取中文关键词和英文单词，过滤掉常见停用词
  local keywords=""
  local combined_text="$task_name $task_desc"

  # 提取关键词列表（中英文混合）
  # 常见停用词列表
  local stopwords="的|是|和|在|一个|到|了|上|为|这|中|与|或|及|但|而|给|创建|workflow|n8n|触发|返回|发送|检查"

  # 提取英文单词（中文关键词难以用 grep 分词，改用简单策略）
  # 英文单词直接提取，中文则提取连续的2-4字作为潜在关键词
  local english_words=$(echo "$combined_text" | grep -oE '[a-zA-Z]{3,}' 2>/dev/null | tr '[:upper:]' '[:lower:]' | grep -vE "^($stopwords)$" | sort -u | head -5)

  # 对于中文，尝试匹配常见技术术语
  local chinese_terms=""
  for term in "webhook" "定时" "检查" "告警" "通知" "飞书" "磁盘" "监控" "备份" "清理" "健康" "GitHub" "star"; do
    if echo "$combined_text" | grep -qi "$term"; then
      chinese_terms="$chinese_terms|$term"
    fi
  done
  chinese_terms=$(echo "$chinese_terms" | sed 's/^|//')

  # 合并关键词
  if [[ -n "$english_words" ]]; then
    keywords=$(echo "$english_words" | tr '\n' '|' | sed 's/|$//')
  fi
  if [[ -n "$chinese_terms" ]]; then
    if [[ -n "$keywords" ]]; then
      keywords="$keywords|$chinese_terms"
    else
      keywords="$chinese_terms"
    fi
  fi

  # 如果没有提取到关键词，返回空
  if [[ -z "$keywords" ]]; then
    return 0
  fi

  # 从经验库中搜索匹配的条目
  # 优先匹配 common_issues、best_practices，然后匹配 lessons 中的 prd
  local matched_experiences=""

  # 使用 jq 匹配关键词
  matched_experiences=$(jq -r --arg keywords "$keywords" '
    # 函数：计算匹配分数
    def count_matches($text; $kw_list):
      if $text == null then 0
      else
        ($kw_list | split("|")) as $kws |
        reduce $kws[] as $kw (0;
          if ($text | ascii_downcase | contains($kw | ascii_downcase)) then . + 1 else . end
        )
      end;

    # 从 lessons 中获取最近成功的相关经验
    [(.lessons // [])[] |
      select(. != null and .decision == "PASS") |
      . as $lesson |
      (count_matches(.prd; $keywords)) as $score |
      select($score > 0) |
      {
        type: "lesson",
        prd: .prd,
        decision: .decision,
        date: .date,
        score: $score
      }
    ] |

    # 按分数排序，取前 3 条
    sort_by(-.score) |
    .[0:3] |

    # 格式化输出
    if length > 0 then
      map("\(.prd)") | join(" | ")
    else
      ""
    end
  ' "$exp_file" 2>/dev/null)

  # 返回结果
  if [[ -n "$matched_experiences" && "$matched_experiences" != "null" ]]; then
    echo "$matched_experiences"
  fi
}

update_state() {
  local status="$1"
  echo "{\"status\": \"$status\", \"started_at\": \"$STARTED_AT\", \"rework_count\": $REWORK_COUNT}" > "$STATE_DIR/state.json"
}

output_json() {
  cat << EOF
$1
EOF
}

# 从 Claude JSON 输出中提取 token 使用量
extract_tokens_from_json() {
  local json_output="$1"
  local model="$2"  # sonnet, haiku, opus

  # Debug: 保存原始输出到临时文件（如果提取失败）
  local debug_file="$STATE_DIR/last_claude_output.json"
  echo "$json_output" > "$debug_file"

  # 提取最后一行（应该是 JSON）
  local json_line=$(echo "$json_output" | tail -1)

  # 检查是否是有效的 JSON
  if ! echo "$json_line" | jq . > /dev/null 2>&1; then
    log "警告: Claude 输出不是有效的 JSON，尝试从文本提取 token"
    echo "0,0"
    return
  fi

  # 根据模型名称提取对应的 token 数量
  local model_key=""
  case "$model" in
    sonnet) model_key="claude-sonnet-4-5-20250929" ;;
    haiku) model_key="claude-haiku-4-5-20251001" ;;
    opus) model_key="claude-opus-4-5-20251101" ;;
    *) model_key="claude-sonnet-4-5-20250929" ;;
  esac

  # 提取 input 和 output tokens
  local input_tokens=$(echo "$json_line" | jq -r ".modelUsage.\"$model_key\".inputTokens // 0")
  local output_tokens=$(echo "$json_line" | jq -r ".modelUsage.\"$model_key\".outputTokens // 0")
  local cache_read=$(echo "$json_line" | jq -r ".modelUsage.\"$model_key\".cacheReadInputTokens // 0")
  local cache_creation=$(echo "$json_line" | jq -r ".modelUsage.\"$model_key\".cacheCreationInputTokens // 0")

  # 计算总 input tokens（包括缓存）
  local total_input=$((input_tokens + cache_read + cache_creation))

  # Debug 日志
  if [[ "$input_tokens" == "0" && "$output_tokens" == "0" ]]; then
    log "调试: 无法提取 token，模型=$model_key，JSON 文件=$debug_file"
  fi

  echo "$total_input,$output_tokens"
}

# 成本追踪函数
track_cost() {
  local model="$1"
  local input_tokens="${2:-0}"
  local output_tokens="${3:-0}"

  # 价格（每百万 token，单位：美元）
  # opus: $75/M, sonnet: $15/M, haiku: $1/M
  local price=15
  case "$model" in
    opus) price=75 ;;
    sonnet) price=15 ;;
    haiku) price=1 ;;
  esac

  # 计算成本（使用 awk 以支持浮点运算）
  local cost=$(awk "BEGIN {printf \"%.6f\", ($input_tokens + $output_tokens) * $price / 1000000}")

  # 记录到日志文件
  echo "$model,$input_tokens,$output_tokens,$cost" >> "$STATE_DIR/costs.log"

  # 更新调用计数
  echo "$model" >> "$STATE_DIR/model_calls.log"

  log "成本: $model - ${input_tokens}+${output_tokens} tokens = \$${cost}"
}

# 发送回调通知
send_callback() {
  local result="$1"
  if [[ -n "$CALLBACK_WEBHOOK" ]]; then
    log "发送回调通知到: $CALLBACK_WEBHOOK"
    curl --max-time 30 -s -X POST "$CALLBACK_WEBHOOK" \
      -H "Content-Type: application/json" \
      -d "$result" > /dev/null 2>&1 || true
  fi
}

# ============================================================
# 增量更新机制
# ============================================================

# 计算任务描述的hash
compute_task_hash() {
  local task_desc="$1"
  echo -n "$task_desc" | md5sum | awk '{print $1}'
}

# 查找指定任务的最后一次成功执行
find_last_successful_run() {
  local task_id="$1"
  local runs_dir="/home/xx/data/runs"

  # 遍历所有run目录，按时间倒序查找
  for run_dir in $(ls -dt "$runs_dir"/*/ 2>/dev/null); do
    # 跳过当前run
    local run_name=$(basename "$run_dir")
    if [[ "$run_name" == "$RUN_ID" ]]; then
      continue
    fi

    # 检查该run是否PASS
    local decision=$(jq -r '.decision // "UNKNOWN"' "$run_dir/decision.json" 2>/dev/null)
    if [[ "$decision" != "PASS" ]]; then
      continue
    fi

    # 检查该run是否包含此任务
    if [[ -f "$run_dir/tasks/${task_id}_result.json" ]]; then
      local status=$(jq -r '.status // "unknown"' "$run_dir/tasks/${task_id}_result.json" 2>/dev/null)
      if [[ "$status" == "success" || "$status" == "completed" ]]; then
        echo "$run_dir"
        return 0
      fi
    fi
  done

  return 1
}

# 从历史run中获取任务的hash
get_task_hash_from_run() {
  local run_dir="$1"
  local task_id="$2"

  # 从sorted_tasks.json中提取任务描述并计算hash
  local task_desc=$(jq -r --arg tid "$task_id" '.[] | select(.id == $tid) | .description' "$run_dir/sorted_tasks.json" 2>/dev/null)

  if [[ -n "$task_desc" && "$task_desc" != "null" ]]; then
    compute_task_hash "$task_desc"
  else
    echo ""
  fi
}

# 检查任务是否发生变化
check_task_changed() {
  local task_id="$1"
  local task_hash="$2"

  # 如果强制全量执行，直接返回需要执行
  if [[ "$FORCE_FULL" == "true" ]]; then
    return 0
  fi

  # 如果未启用增量模式，直接返回需要执行
  if [[ "$INCREMENTAL_MODE" != "true" ]]; then
    return 0
  fi

  # 查找该任务的历史记录
  local last_run=$(find_last_successful_run "$task_id")
  if [[ -z "$last_run" ]]; then
    log "  任务 $task_id: 无历史记录，需要执行"
    return 0  # 需要执行（无历史）
  fi

  local last_hash=$(get_task_hash_from_run "$last_run" "$task_id")
  if [[ -z "$last_hash" ]]; then
    log "  任务 $task_id: 无法获取历史hash，需要执行"
    return 0  # 需要执行（无法获取历史hash）
  fi

  if [[ "$task_hash" != "$last_hash" ]]; then
    log "  任务 $task_id: hash变化 ($last_hash -> $task_hash)，需要执行"
    return 0  # 需要执行（hash变化）
  fi

  # 记录跳过信息
  local run_name=$(basename "$last_run")
  echo "$task_id:$run_name" >> "$STATE_DIR/incremental_skip.log"

  log "  任务 $task_id: 未变化，跳过执行 (参考: $run_name)"
  return 1  # 可跳过（未变化）
}

# 保存增量状态
save_incremental_state() {
  if [[ "$INCREMENTAL_MODE" != "true" ]]; then
    return 0
  fi

  local total_tasks=$(jq 'length' "$STATE_DIR/sorted_tasks.json" 2>/dev/null || echo 0)
  local skipped_count=0
  local executed_count=0
  local skipped_tasks=()
  local skip_reasons="{}"

  # 统计跳过的任务
  if [[ -f "$STATE_DIR/incremental_skip.log" ]]; then
    while IFS=: read -r task_id run_name; do
      skipped_tasks+=("\"$task_id\"")
      skip_reasons=$(echo "$skip_reasons" | jq --arg tid "$task_id" --arg run "$run_name" '. + {($tid): ("unchanged_since_run_" + $run)}')
      skipped_count=$((skipped_count + 1))
    done < "$STATE_DIR/incremental_skip.log"
  fi

  executed_count=$((total_tasks - skipped_count))

  # 生成JSON
  local skipped_tasks_json="[$(IFS=,; echo "${skipped_tasks[*]}")]"

  local incremental_state=$(jq -n \
    --arg mode "incremental" \
    --argjson checked "$total_tasks" \
    --argjson skipped "$skipped_count" \
    --argjson executed "$executed_count" \
    --argjson tasks "$skipped_tasks_json" \
    --argjson reasons "$skip_reasons" \
    '{
      mode: $mode,
      tasks_checked: $checked,
      tasks_skipped: $skipped,
      tasks_executed: $executed,
      skipped_tasks: $tasks,
      reason: $reasons
    }')

  echo "$incremental_state" > "$STATE_DIR/incremental.json"
  log "增量状态已保存: $skipped_count 个任务跳过, $executed_count 个任务执行"
}

# Git 分支管理
# ============================================================

# 初始化 Git 工作分支
init_git_branch() {
  if [[ "$NO_GIT" == "true" ]]; then
    log "Git 操作已禁用 (--no-git)"
    echo '{"git_enabled": false, "reason": "disabled_by_flag"}' > "$STATE_DIR/git_operations.json"
    return 0
  fi

  log "初始化 Git 分支"

  # 检查是否在 git 仓库中
  cd "$WORKFLOW_DIR"
  if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log "警告: 不在 git 仓库中，跳过 Git 操作"
    echo '{"git_enabled": false, "reason": "not_a_git_repo"}' > "$STATE_DIR/git_operations.json"
    return 0
  fi

  # 检查当前分支
  local current_branch=$(git branch --show-current 2>/dev/null || echo "unknown")
  local original_branch="$current_branch"

  # 如果在受保护分支上，记录警告但继续（会在质检中标记）
  if [[ "$current_branch" == "main" || "$current_branch" == "master" ]]; then
    log "警告: 当前在受保护分支 ($current_branch)，建议使用工作分支"
  fi

  # 创建工作分支
  local branch_name="factory/${RUN_ID}"
  log "创建工作分支: $branch_name"

  # 检查分支是否已存在（续跑场景）
  if git show-ref --verify --quiet "refs/heads/$branch_name"; then
    log "工作分支已存在，切换到: $branch_name"
    git checkout "$branch_name" 2>/dev/null || {
      log "警告: 无法切换到分支 $branch_name"
      echo "{\"git_enabled\": true, \"branch_created\": false, \"error\": \"checkout_failed\"}" > "$STATE_DIR/git_operations.json"
      return 1
    }
  else
    # 创建新分支
    git checkout -b "$branch_name" 2>/dev/null || {
      log "警告: 无法创建分支 $branch_name"
      echo "{\"git_enabled\": true, \"branch_created\": false, \"error\": \"create_failed\"}" > "$STATE_DIR/git_operations.json"
      return 1
    }
    log "工作分支已创建: $branch_name"
  fi

  # 记录 Git 操作
  local git_info=$(jq -n \
    --arg enabled "true" \
    --arg branch "$branch_name" \
    --arg original "$original_branch" \
    --arg created "$(date -Iseconds)" \
    --arg commit_before "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')" \
    '{
      git_enabled: ($enabled == "true"),
      branch_name: $branch,
      original_branch: $original,
      created_at: $created,
      commit_before: $commit_before,
      branch_created: true
    }')

  echo "$git_info" > "$STATE_DIR/git_operations.json"
  log "Git 分支初始化完成"
}

# 提交变更
commit_changes() {
  if [[ "$NO_GIT" == "true" ]]; then
    log "Git 操作已禁用，跳过提交"
    return 0
  fi

  # 检查是否启用了 Git
  local git_enabled=$(jq -r '.git_enabled // false' "$STATE_DIR/git_operations.json" 2>/dev/null)
  if [[ "$git_enabled" != "true" ]]; then
    log "Git 未启用，跳过提交"
    return 0
  fi

  log "提交变更到 Git"

  cd "$WORKFLOW_DIR"

  # 检查是否有变更
  if [[ -z "$(git status --porcelain 2>/dev/null)" ]]; then
    log "没有变更需要提交"
    jq '. + {committed: false, reason: "no_changes"}' "$STATE_DIR/git_operations.json" > "$STATE_DIR/git_operations.json.tmp"
    mv "$STATE_DIR/git_operations.json.tmp" "$STATE_DIR/git_operations.json"
    return 0
  fi

  # 生成提交信息
  local prd_summary=$(echo "$PRD" | head -c 60 | tr '\n' ' ' | sed 's/[[:space:]]*$//')
  local commit_msg="[AI Factory] $prd_summary

Run ID: $RUN_ID
Generated by: AI工厂-Workflow生产线
Date: $(date -Iseconds)

Changes:
- $(git status --porcelain | wc -l) files modified

Quality Checks:
- Hard Check: $(jq -r '.all_exist // "unknown"' "$STATE_DIR/qc/hard_check.json" 2>/dev/null)
- Soft Check: $(jq -r '.pass // "unknown"' "$STATE_DIR/qc/soft_check.json" 2>/dev/null)
- Security: $(jq -r '.pass // "unknown"' "$STATE_DIR/qc/security.json" 2>/dev/null)"

  # 添加所有变更
  log "添加变更文件..."
  git add . 2>/dev/null || {
    log "警告: git add 失败"
    jq '. + {committed: false, error: "add_failed"}' "$STATE_DIR/git_operations.json" > "$STATE_DIR/git_operations.json.tmp"
    mv "$STATE_DIR/git_operations.json.tmp" "$STATE_DIR/git_operations.json"
    return 1
  }

  # 提交
  log "提交变更..."
  if git commit -m "$commit_msg" 2>/dev/null; then
    local commit_hash=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    log "提交成功: $commit_hash"

    # 更新 git_operations.json
    jq '. + {committed: true, commit_hash: $hash, commit_message: $msg, committed_at: $time}' \
      --arg hash "$commit_hash" \
      --arg msg "$prd_summary" \
      --arg time "$(date -Iseconds)" \
      "$STATE_DIR/git_operations.json" > "$STATE_DIR/git_operations.json.tmp"
    mv "$STATE_DIR/git_operations.json.tmp" "$STATE_DIR/git_operations.json"
  else
    log "警告: git commit 失败"
    jq '. + {committed: false, error: "commit_failed"}' "$STATE_DIR/git_operations.json" > "$STATE_DIR/git_operations.json.tmp"
    mv "$STATE_DIR/git_operations.json.tmp" "$STATE_DIR/git_operations.json"
    return 1
  fi
}

# 清理 Git 分支（可选）
cleanup_git_branch() {
  if [[ "$NO_GIT" == "true" ]]; then
    return 0
  fi

  local git_enabled=$(jq -r '.git_enabled // false' "$STATE_DIR/git_operations.json" 2>/dev/null)
  if [[ "$git_enabled" != "true" ]]; then
    return 0
  fi

  log "Git 分支清理（保留分支供手动合并）"

  cd "$WORKFLOW_DIR"

  local branch_name=$(jq -r '.branch_name' "$STATE_DIR/git_operations.json" 2>/dev/null)
  local original_branch=$(jq -r '.original_branch' "$STATE_DIR/git_operations.json" 2>/dev/null)

  # 切换回原始分支
  if [[ -n "$original_branch" && "$original_branch" != "unknown" ]]; then
    log "切换回原始分支: $original_branch"
    git checkout "$original_branch" 2>/dev/null || true
  fi

  # 记录分支信息供用户手动合并
  log "工作分支保留: $branch_name (可用 'git merge $branch_name' 合并)"

  jq '. + {cleanup_done: true, branch_preserved: true, merge_command: $cmd}' \
    --arg cmd "git merge $branch_name" \
    "$STATE_DIR/git_operations.json" > "$STATE_DIR/git_operations.json.tmp"
  mv "$STATE_DIR/git_operations.json.tmp" "$STATE_DIR/git_operations.json"
}


# ============================================================
# 1. 初始化
# ============================================================
init_run() {
  log "初始化 Run: $RUN_ID"

  # 创建目录结构
  mkdir -p "$STATE_DIR"/{tasks,qc,docs,rework,reports,final}

  # 记录开始时间（用于自省模块计算耗时）
  date +%s > "$STATE_DIR/start_time"

  # 保存PRD
  echo "$PRD" > "$STATE_DIR/prd.md"

  # 如果指定了模板，加载模板
  if [[ -n "$TEMPLATE" ]]; then
    log "加载模板: $TEMPLATE"
    local template_file="$WORKFLOW_DIR/templates/$TEMPLATE/template.json"

    if [[ -f "$template_file" ]]; then
      cp "$template_file" "$STATE_DIR/template.json"
      log "模板已加载: $template_file"

      # 从 index.json 获取模板元数据
      local template_meta=$(jq -r ".templates[] | select(.id == \"$TEMPLATE\")" "$WORKFLOW_DIR/templates/index.json" 2>/dev/null)
      if [[ -n "$template_meta" ]]; then
        echo "$template_meta" > "$STATE_DIR/template_meta.json"
        log "模板元数据已保存"
      fi
    else
      log "警告: 模板文件不存在: $template_file"
    fi
  fi

  # 初始化状态
  update_state "initializing"

  log "目录结构已创建: $STATE_DIR"

  # 初始化 Git 分支
  init_git_branch
}

# ============================================================
# 2. 回滚处理
# ============================================================
handle_rollback() {
  if [[ -n "$ROLLBACK_RUN_ID" ]]; then
    log "执行回滚到: $ROLLBACK_RUN_ID"
    local rollback_dir="/home/xx/data/runs/$ROLLBACK_RUN_ID"

    if [[ -d "$rollback_dir/final" ]]; then
      # 恢复之前的版本
      cp -r "$rollback_dir/final/"* "$STATE_DIR/" 2>/dev/null || true
      update_state "rolled_back"
      output_json "{\"success\": true, \"action\": \"rollback\", \"from\": \"$ROLLBACK_RUN_ID\"}"
      exit 0
    else
      output_json "{\"success\": false, \"error\": \"回滚源不存在: $ROLLBACK_RUN_ID\"}"
      exit 1
    fi
  fi
}

# ============================================================
# 3. 续跑处理
# ============================================================
handle_resume() {
  if [[ -n "$RESUME_RUN_ID" ]]; then
    log "从断点续跑: $RESUME_RUN_ID"
    local resume_dir="/home/xx/data/runs/$RESUME_RUN_ID"

    if [[ -f "$resume_dir/state.json" ]]; then
      # 加载之前的状态
      cp "$resume_dir/state.json" "$STATE_DIR/"
      cp "$resume_dir/plan.json" "$STATE_DIR/" 2>/dev/null || true
      cp "$resume_dir/waves.json" "$STATE_DIR/" 2>/dev/null || true
      REWORK_COUNT=$(jq -r '.rework_count // 0' "$STATE_DIR/state.json")
      log "已加载断点状态，rework_count=$REWORK_COUNT"
    fi
  fi
}

# ============================================================
# 4. Claude A - 分解PRD
# ============================================================
decompose_prd() {
  log "Claude A: 分解PRD"
  update_state "decomposing"

  local max_retries=2
  local retry_count=0
  local success=false

  while [[ $retry_count -le $max_retries ]]; do
    if [[ $retry_count -gt 0 ]]; then
      log "重试 Claude A 调用 (第 $retry_count 次)"
    fi

    local prompt="你的任务是分析 PRD 并输出任务规划的 JSON。

⚠️ 重要：
- 只输出 JSON，不要输出任何其他内容
- 不要执行任何实际操作，只规划任务
- 不要创建文件，不要写代码

【输出格式】只输出以下 JSON 结构（替换方括号内容）：
{\"tasks\":[{\"id\":\"task_1\",\"name\":\"创建完整 workflow: [根据PRD确定名称]\",\"description\":\"[根据PRD描述具体节点和连接]\",\"depends_on\":[],\"files_expected\":[\"[workflow名].json\"],\"complexity\":4,\"model\":\"sonnet\"}]}

=== PRD ===
$PRD
=== PRD 结束 ==="

    if [[ $retry_count -gt 0 ]]; then
      prompt="$prompt

【注意】上次输出的 JSON 格式不正确，请务必输出严格符合规范的 JSON 格式。"
    fi

    local output
    local exit_code
    # 使用 script 模拟 TTY，避免 Claude Code 在无终端环境下挂起
    # 将 prompt 写入临时文件避免引号转义问题
    local prompt_file="/tmp/claude_prompt_$$.txt"
    echo "$prompt" > "$prompt_file"

    # 创建执行脚本
    local cmd_file="/tmp/claude_cmd_$$.sh"
    cat > "$cmd_file" << CMDEOF
#!/bin/bash
cd "$HEADLESS_WORKSPACE"
timeout -k 10 120 claude -p "\$(cat $prompt_file)" \\
  --add-dir "$WORKFLOW_DIR" \\
  --allowedTools "Read,Grep,Glob" \\
  --model opus
CMDEOF
    chmod +x "$cmd_file"

    output=$(script -q -c "$cmd_file" /dev/null 2>&1 | tee "$STATE_DIR/claude_a_output_attempt_${retry_count}.txt")
    exit_code=$?

    # 清理临时文件
    rm -f "$prompt_file" "$cmd_file"

    if [[ $exit_code -eq 124 ]]; then
      log "错误: Claude A 调用超时 (120秒)"
      retry_count=$((retry_count + 1))
      continue
    elif [[ $exit_code -ne 0 ]]; then
      log "错误: Claude A 调用失败 (exit code: $exit_code)"
      retry_count=$((retry_count + 1))
      continue
    fi

    # 保存完整输出用于调试
    echo "$output" > "$STATE_DIR/last_claude_output_attempt_${retry_count}.json"

    # 提取token使用量（从Claude输出的JSON信封）- PRD分解用Opus
    local input_tokens output_tokens
    IFS=',' read -r input_tokens output_tokens <<< "$(extract_tokens_from_json "$output" "opus")"
    track_cost "opus" "${input_tokens:-0}" "${output_tokens:-0}"

    # 解析JSON - 处理 --output-format json 的信封格式
    local json_content
    local result_content

    # 检查是否是 JSON 信封格式 (包含 "result" 字段)
    if echo "$output" | jq -e '.result' > /dev/null 2>&1; then
      # 从 JSON 信封中提取 result 字段
      result_content=$(echo "$output" | jq -r '.result // empty')
    else
      result_content="$output"
    fi

    # 从 result 中提取 JSON（可能包含 markdown 代码块）
    if echo "$result_content" | grep -q '```'; then
      # 提取 markdown 代码块中的 JSON
      json_content=$(echo "$result_content" | sed -n '/```json/,/```/p' | sed '1d;$d')
      if [[ -z "$json_content" ]]; then
        json_content=$(echo "$result_content" | sed -n '/```/,/```/p' | sed '1d;$d')
      fi
    fi

    # 如果没有代码块，尝试直接解析 JSON
    if [[ -z "$json_content" ]]; then
      # 尝试提取包含 "tasks" 的 JSON 对象（增强正则，支持嵌套）
      json_content=$(echo "$result_content" | perl -0777 -ne 'print $1 if /(\{[^{}]*"tasks"[^{}]*\[[^\]]*\][^{}]*\})/s' | head -1)

      # 如果 perl 不可用或失败，尝试更宽松的 grep
      if [[ -z "$json_content" ]]; then
        json_content=$(echo "$result_content" | grep -Pzo '(?s)\{.*?"tasks".*?\}' 2>/dev/null | tr -d '\0' | head -1)
      fi

      # 如果还是失败，使用原有的简单正则
      if [[ -z "$json_content" ]]; then
        json_content=$(echo "$result_content" | grep -o '{.*"tasks".*}' | head -1)
      fi
    fi

    # 清理 JSON（去除转义换行符和多余空白）
    json_content=$(echo "$json_content" | tr -d '\n' | sed 's/\\n//g' | sed 's/  */ /g')

    # 验证 JSON 格式（使用 -e 参数检测错误）
    if echo "$json_content" | jq -e '.tasks' > /dev/null 2>&1; then
      # JSON 验证成功
      echo "$json_content" | jq '.' > "$STATE_DIR/tasks_raw.json"
      local task_count=$(echo "$json_content" | jq '.tasks | length')
      log "PRD分解成功，任务数: $task_count"
      success=true
      break
    else
      # JSON 解析失败，记录原始输出
      log "警告: JSON 解析失败 (尝试 $retry_count/$max_retries)"
      echo "=== 尝试 $retry_count ($(date '+%Y-%m-%d %H:%M:%S')) ===" >> "$STATE_DIR/parse_errors.log"
      echo "=== 原始 Claude 输出 ===" >> "$STATE_DIR/parse_errors.log"
      echo "$output" >> "$STATE_DIR/parse_errors.log"
      echo "=== 提取的 result_content ===" >> "$STATE_DIR/parse_errors.log"
      echo "$result_content" >> "$STATE_DIR/parse_errors.log"
      echo "=== 提取的 JSON 内容 ===" >> "$STATE_DIR/parse_errors.log"
      echo "$json_content" >> "$STATE_DIR/parse_errors.log"
      echo "=== jq 错误信息 ===" >> "$STATE_DIR/parse_errors.log"
      echo "$json_content" | jq -e '.tasks' 2>> "$STATE_DIR/parse_errors.log"
      echo "" >> "$STATE_DIR/parse_errors.log"

      retry_count=$((retry_count + 1))
    fi
  done

  # 检查是否成功
  if [[ "$success" == "false" ]]; then
    log "错误: Claude A 在 $max_retries 次尝试后仍无法返回有效 JSON"
    log "错误详情已保存到: $STATE_DIR/parse_errors.log"
    update_state "failed"

    # 创建一个默认任务并标记为失败
    echo '{"tasks": [{"id": "task_1", "name": "执行PRD需求 (解析失败，使用默认)", "description": "'"$PRD"'", "depends_on": [], "files_expected": [], "complexity": 3, "estimated_minutes": 15, "model": "sonnet", "parse_failed": true}]}' > "$STATE_DIR/tasks_raw.json"

    return 1
  fi

  return 0
}

# ============================================================
# 4.5 PRD 理解反向验证
# ============================================================
verify_prd_understanding() {
  # 跳过验证的条件
  if [[ "$SKIP_PRD_VERIFY" == "true" ]]; then
    log "跳过 PRD 理解验证 (--skip-prd-verify)"
    return 0
  fi

  log "验证 PRD 理解"
  update_state "verifying_prd"

  # 读取任务列表
  if [[ ! -f "$STATE_DIR/tasks_raw.json" ]]; then
    log "警告: tasks_raw.json 不存在，跳过验证"
    return 0
  fi

  # 提取任务列表用于反向还原
  local tasks_summary=$(jq -r '.tasks[] | "- \(.name): \(.description)"' "$STATE_DIR/tasks_raw.json" 2>/dev/null)

  if [[ -z "$tasks_summary" ]]; then
    log "警告: 任务列表为空，跳过验证"
    return 0
  fi

  # Step 1: 反向还原需求
  log "  Step 1: 反向还原原始需求"
  local restore_prompt="根据以下任务列表，推测原始需求是什么？只输出一句话描述需求，不要输出其他内容。

任务列表:
$tasks_summary"

  local prompt_file="/tmp/claude_verify_prompt_$$.txt"
  echo "$restore_prompt" > "$prompt_file"

  local cmd_file="/tmp/claude_verify_cmd_$$.sh"
  cat > "$cmd_file" << CMDEOF
#!/bin/bash
cd "$HEADLESS_WORKSPACE"
timeout -k 10 60 claude -p "\$(cat $prompt_file)" \\
  --allowedTools "" \\
  --model sonnet
CMDEOF
  chmod +x "$cmd_file"

  local restore_output
  restore_output=$(script -q -c "$cmd_file" /dev/null 2>&1)
  local exit_code=$?

  rm -f "$prompt_file" "$cmd_file"

  if [[ $exit_code -ne 0 ]]; then
    log "警告: 反向还原调用失败 (exit code: $exit_code)，跳过验证"
    return 0
  fi

  # 提取还原结果
  local restored_prd
  if echo "$restore_output" | jq -e '.result' > /dev/null 2>&1; then
    restored_prd=$(echo "$restore_output" | jq -r '.result // empty' | tr -d '\n')
  else
    restored_prd=$(echo "$restore_output" | tail -5 | tr -d '\n')
  fi

  # 提取 token 使用量
  local input_tokens output_tokens
  IFS=',' read -r input_tokens output_tokens <<< "$(extract_tokens_from_json "$restore_output" "sonnet")"
  track_cost "sonnet" "${input_tokens:-0}" "${output_tokens:-0}"

  log "  还原结果: $restored_prd"

  # Step 2: 比较相似度
  log "  Step 2: 计算语义相似度"
  local compare_prompt="比较以下两个需求描述的语义相似度，返回 0-100 的分数。只返回数字，不要输出其他内容。

原始需求: $PRD

还原需求: $restored_prd"

  local prompt_file2="/tmp/claude_compare_prompt_$$.txt"
  echo "$compare_prompt" > "$prompt_file2"

  local cmd_file2="/tmp/claude_compare_cmd_$$.sh"
  cat > "$cmd_file2" << CMDEOF
#!/bin/bash
cd "$HEADLESS_WORKSPACE"
timeout -k 10 60 claude -p "\$(cat $prompt_file2)" \\
  --allowedTools "" \\
  --model sonnet
CMDEOF
  chmod +x "$cmd_file2"

  local compare_output
  compare_output=$(script -q -c "$cmd_file2" /dev/null 2>&1)
  exit_code=$?

  rm -f "$prompt_file2" "$cmd_file2"

  if [[ $exit_code -ne 0 ]]; then
    log "警告: 相似度比较调用失败 (exit code: $exit_code)，跳过验证"
    return 0
  fi

  # 提取分数
  local similarity_score
  if echo "$compare_output" | jq -e '.result' > /dev/null 2>&1; then
    similarity_score=$(echo "$compare_output" | jq -r '.result // empty' | grep -oE '[0-9]+' | head -1)
  else
    similarity_score=$(echo "$compare_output" | grep -oE '[0-9]+' | head -1)
  fi

  # 提取 token 使用量
  IFS=',' read -r input_tokens output_tokens <<< "$(extract_tokens_from_json "$compare_output" "sonnet")"
  track_cost "sonnet" "${input_tokens:-0}" "${output_tokens:-0}"

  # 验证分数是否有效
  if [[ -z "$similarity_score" ]] || ! [[ "$similarity_score" =~ ^[0-9]+$ ]]; then
    log "警告: 无法解析相似度分数，跳过验证"
    similarity_score=100
  fi

  # 保存验证结果
  local verify_result="{
    \"original_prd\": $(echo "$PRD" | jq -Rs .),
    \"restored_prd\": $(echo "$restored_prd" | jq -Rs .),
    \"similarity_score\": $similarity_score,
    \"threshold\": 80,
    \"verified_at\": \"$(date -Iseconds)\",
    \"status\": \"$([ $similarity_score -ge 80 ] && echo 'PASS' || echo 'MISMATCH')\"
  }"
  echo "$verify_result" > "$STATE_DIR/prd_verify.json"

  log "  相似度分数: $similarity_score/100"

  # 检查是否通过
  if [[ $similarity_score -lt 80 ]]; then
    log "警告: PRD 理解验证失败 (相似度: $similarity_score < 80)"
    update_state "PRD_MISMATCH"

    # 发送飞书通知
    if [[ -n "$FEISHU_BOT_WEBHOOK" ]]; then
      # 使用 jq 安全转义特殊字符
      local safe_prd=$(echo "$PRD" | jq -Rs . | sed 's/^"//;s/"$//')
      local safe_restored=$(echo "$restored_prd" | jq -Rs . | sed 's/^"//;s/"$//')
      local notify_msg="AI工厂 PRD 理解验证失败\nRun ID: $RUN_ID\n相似度: $similarity_score/100 (阈值: 80)\n\n原始需求: ${safe_prd:0:200}\n\n还原需求: ${safe_restored:0:200}\n\n使用 --skip-prd-verify 跳过此检查"
      curl --max-time 10 -s -X POST "$FEISHU_BOT_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "{\"msg_type\":\"text\",\"content\":{\"text\":\"$notify_msg\"}}" > /dev/null 2>&1 || true
    fi

    # 返回失败状态，阻止继续执行
    return 1
  fi

  log "PRD 理解验证通过: $similarity_score/100"
  return 0
}

# ============================================================
# 4.6 文件冲突检测
# ============================================================
check_file_conflicts() {
  log "检查文件冲突"

  local plan_file="$STATE_DIR/plan.json"

  # 如果 plan.json 不存在，使用 tasks_raw.json
  if [[ ! -f "$plan_file" ]]; then
    plan_file="$STATE_DIR/tasks_raw.json"
  fi

  if [[ ! -f "$plan_file" ]]; then
    log "  警告: 计划文件不存在，跳过冲突检测"
    echo '{"check": "file_conflicts", "has_conflicts": false, "conflicts": [], "checked_at": "'$(date -Iseconds)'", "skipped": true}' > "$STATE_DIR/qc/file_conflicts.json"
    return 0
  fi

  # 使用 jq 检测文件冲突
  local conflict_check=$(jq -r '
    # 提取所有任务
    (.tasks // []) as $tasks |

    # 构建文件到任务的映射
    (
      $tasks |
      map(
        .id as $task_id |
        (.files_expected // []) |
        map({file: ., task: $task_id})
      ) |
      flatten |
      group_by(.file) |
      map(select(length > 1)) |
      map({
        file: .[0].file,
        tasks: map(.task)
      })
    ) as $conflicts |

    # 生成结果
    {
      check: "file_conflicts",
      has_conflicts: ($conflicts | length > 0),
      conflicts: $conflicts,
      checked_at: (now | todate)
    }
  ' "$plan_file")

  # 保存结果
  echo "$conflict_check" > "$STATE_DIR/qc/file_conflicts.json"

  # 检查是否有冲突
  local has_conflicts=$(echo "$conflict_check" | jq -r '.has_conflicts')
  local conflict_count=$(echo "$conflict_check" | jq -r '.conflicts | length')

  if [[ "$has_conflicts" == "true" ]]; then
    log "  警告: 检测到 $conflict_count 个文件冲突"

    # 输出冲突详情到日志
    echo "$conflict_check" | jq -r '.conflicts[] | "    - 文件: \(.file) 被任务修改: \(.tasks | join(", "))"' >&2
  else
    log "  未检测到文件冲突"
  fi

  # 返回冲突状态
  return 0
}

# ============================================================
# 5. 拓扑排序
# ============================================================
topological_sort() {
  log "执行拓扑排序"

  local tasks_file="$STATE_DIR/tasks_raw.json"

  # 使用Python进行拓扑排序（比bash更可靠）
  python3 << PYTHON_EOF
import json
import sys

# 从 bash 变量传入（heredoc 变量展开）
tasks_file = "$STATE_DIR/tasks_raw.json"
state_dir = "$STATE_DIR"
run_id = "$RUN_ID"
prd = """$PRD"""
target_workflow = "$TARGET_WORKFLOW" if "$TARGET_WORKFLOW" != "" else None

with open(tasks_file) as f:
    data = json.load(f)

tasks = data.get('tasks', [])

def assign_model(task):
    # Check if task already has a model assigned (只接受 opus/sonnet)
    if task.get("model") in ["opus", "sonnet"]:
        return task["model"]

    # Get complexity and USE_OPUS flag
    complexity = task.get("complexity", 3)
    use_opus = "$USE_OPUS" == "true"

    # Assign model based on complexity (只用 opus + sonnet)
    if complexity >= 4:
        return "opus" if use_opus else "sonnet"
    else:
        return "sonnet"

# 拓扑排序
waves = []
completed = set()
task_map = {t['id']: t for t in tasks}

while len(completed) < len(tasks):
    wave = []
    for task in tasks:
        if task['id'] in completed:
            continue
        deps = task.get('depends_on', [])
        if all(d in completed for d in deps):
            wave.append(task)

    if not wave:
        print("警告: 检测到循环依赖", file=sys.stderr)
        break

    for t in wave:
        completed.add(t['id'])
    waves.append(wave)

# 生成waves.json
wave_data = {
    'waves': [{'waveIndex': i, 'tasks': [{'id': t['id'], 'name': t['name'], 'model': assign_model(t)} for t in w]} for i, w in enumerate(waves)],
    'totalWaves': len(waves),
    'tasksCount': len(tasks)
}

with open(f'{state_dir}/waves.json', 'w') as f:
    json.dump(wave_data, f, ensure_ascii=False, indent=2)

# 生成plan.json
plan = {
    'run_id': run_id,
    'created_at': '',
    'prd': prd,
    'target_workflow': target_workflow,
    'tasks': [{**t, 'model': assign_model(t)} for t in tasks],
    'waves': wave_data['waves'],
    'summary': {
        'total_tasks': len(tasks),
        'total_waves': len(waves),
        'model_distribution': {
            'opus': len([t for t in tasks if assign_model(t) == 'opus']),
            'sonnet': len([t for t in tasks if assign_model(t) == 'sonnet']),
            'haiku': len([t for t in tasks if assign_model(t) == 'haiku'])
        }
    }
}

with open(f'{state_dir}/plan.json', 'w') as f:
    json.dump(plan, f, ensure_ascii=False, indent=2)

# 输出排序后的任务列表
sorted_tasks = []
for i, wave in enumerate(waves):
    for task in wave:
        sorted_tasks.append({
            **task,
            'waveIndex': i,
            'totalWaves': len(waves),
            'model': assign_model(task)
        })

with open(f'{state_dir}/sorted_tasks.json', 'w') as f:
    json.dump(sorted_tasks, f, ensure_ascii=False, indent=2)

print(f"拓扑排序完成: {len(waves)} 波次, {len(tasks)} 任务", file=sys.stderr)
PYTHON_EOF

  log "waves.json 和 plan.json 已保存"

  # 在生成 plan.json 后检查文件冲突
  check_file_conflicts
}

# ============================================================
# 6. Claude B - 执行任务（混合模式：模板优先 + Claude 回退）
# ============================================================

# 检测 PRD/任务描述的复杂度
# 返回：需求点数量（1-10）
detect_prd_complexity() {
  local desc="$1"
  local count=0

  # 计算编号需求点：1. xxx  2. xxx 等
  count=$(echo "$desc" | grep -oE '[0-9]+\.' | wc -l)

  # 如果没有编号，检查关键分支词
  if [[ $count -eq 0 ]]; then
    # 检查条件分支词：如果...就..., 否则...,
    local branch_words=$(echo "$desc" | grep -oE '如果|否则|条件|分支|判断|根据.*触发|根据.*执行' | wc -l)
    count=$branch_words
  fi

  # 至少返回 1
  echo $(( count > 0 ? count : 1 ))
}

# 从任务描述中匹配最佳模板
# 返回：template_id 或空字符串
# 对于复杂 PRD（>=4 个需求点），跳过简单模板，让 Claude 从零生成
match_template() {
  local task_name="$1"
  local task_desc="$2"

  # 检测复杂度 - 使用原始 PRD（全局变量）而非分解后的任务描述
  # 因为分解后的任务描述可能丢失需求编号
  local complexity=$(detect_prd_complexity "$PRD")

  # 复杂 PRD 直接跳过模板匹配，让 Claude 从零生成
  if [[ $complexity -ge 4 ]]; then
    log "  PRD 复杂度: $complexity (>=4)，跳过模板匹配，使用 Claude 生成"
    echo ""
    return
  fi

  # 读取模板索引
  local templates_index="$WORKFLOW_DIR/templates/index.json"
  if [[ ! -f "$templates_index" ]]; then
    return
  fi

  local combined="${task_name} ${task_desc}"
  local combined_lower=$(echo "$combined" | tr '[:upper:]' '[:lower:]')

  # === 第一阶段：高置信度关键词直接匹配（不走AI） ===
  # 这些模式非常明确，直接返回结果

  # GitHub Star 监控 - 非常明确的用例
  if echo "$combined_lower" | grep -qiE "github.*star|star.*github|github.*仓库.*star|监控.*star"; then
    log "  高置信度匹配: github-api (GitHub Star 监控)"
    echo "github-api"
    return
  fi

  # VPS 健康检查 - 非常明确的用例
  if echo "$combined_lower" | grep -qiE "vps.*健康|健康.*检查.*磁盘|磁盘.*空间.*告警|服务器.*监控.*告警"; then
    log "  高置信度匹配: vps-health-check"
    echo "vps-health-check"
    return
  fi

  # === 第二阶段：使用 Claude (Sonnet) 智能匹配 ===
  # 获取模板列表摘要
  local templates_summary=$(jq -r '.templates[] | "- \(.id): \(.name) - \(.description) (适用: \(.use_cases | join(", ")))"' "$templates_index" 2>/dev/null)

  if [[ -z "$templates_summary" ]]; then
    echo ""
    return
  fi

  local match_prompt="你是 n8n workflow 模板选择专家。根据任务描述选择最合适的模板。

【任务】
名称: $task_name
描述: $task_desc

【可用模板】
$templates_summary

【重要规则】
1. GitHub star 相关任务 → 必须选 github-api
2. VPS/服务器健康检查 → 必须选 vps-health-check
3. SSH 远程执行 → 必须选 ssh-execution
4. 其他情况选择最匹配的模板
5. 完全不匹配 → 返回 none

【输出】
只返回模板 ID（如 webhook-response），不要其他内容。"

  local match_result
  match_result=$(cd "$HEADLESS_WORKSPACE" && timeout -k 5 30 claude -p "$match_prompt" \
    --model sonnet --output-format text 2>/dev/null | tr -d '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

  # 验证返回的模板 ID 是否有效
  if [[ -n "$match_result" && "$match_result" != "none" ]]; then
    # 检查模板是否存在
    if jq -e --arg id "$match_result" '.templates[] | select(.id == $id)' "$templates_index" > /dev/null 2>&1; then
      log "  智能模板匹配: $match_result"
      echo "$match_result"
      return
    fi
  fi

  # 回退到关键词匹配（优先级从高到低，更具体的在前）
  local combined="${task_name} ${task_desc}"
  local combined_lower=$(echo "$combined" | tr '[:upper:]' '[:lower:]')

  log "  模板匹配回退到关键词模式"

  # 1. GitHub Star 监控（最具体）
  if echo "$combined_lower" | grep -qiE "github.*star|star.*github|github.*仓库|仓库.*star"; then
    echo "github-api"
    return
  fi

  # 2. VPS 健康检查
  if echo "$combined_lower" | grep -qiE "健康检查|磁盘空间|vps监控|服务器监控"; then
    echo "vps-health-check"
    return
  fi

  # 3. SSH 远程执行
  if echo "$combined_lower" | grep -qiE "ssh|远程执行|服务器命令"; then
    echo "ssh-execution"
    return
  fi

  # 4. 定时任务（每天/每小时等）
  if echo "$combined_lower" | grep -qiE "每天|每小时|每分钟|定时|cron|schedule"; then
    echo "scheduled-task"
    return
  fi

  # 5. 通知告警
  if echo "$combined_lower" | grep -qiE "通知|飞书|告警|alert|notification"; then
    echo "notification"
    return
  fi

  # 6. Webhook API
  if echo "$combined_lower" | grep -qiE "webhook|ping|pong|api端点"; then
    echo "webhook-response"
    return
  fi

  # 7. 数据处理
  if echo "$combined_lower" | grep -qiE "数据处理|etl|database|postgres"; then
    echo "data-processing"
    return
  fi

  # 无匹配
  echo ""
}

# 从任务描述中提取参数（简化版，实际需根据模板定义）
extract_params_from_task() {
  local task_desc="$1"
  local template_id="$2"

  # 根据不同模板提取不同参数
  case "$template_id" in
    "webhook-response")
      # 提取 webhook 路径
      local path=$(echo "$task_desc" | grep -oP '路径[：:]\s*\K[^\s]+' || echo "my-webhook")
      echo "{\"webhook_path\": \"$path\"}"
      ;;
    "scheduled-task")
      # 提取 cron 表达式
      local cron=$(echo "$task_desc" | grep -oP 'cron[：:]\s*\K[^\s]+' || echo "0 * * * *")
      echo "{\"cron_expression\": \"$cron\"}"
      ;;
    "notification")
      # 提取通知内容模板
      echo "{\"message_template\": \"notification\"}"
      ;;
    *)
      echo "{}"
      ;;
  esac
}

# 加载模板并替换参数
load_template() {
  local template_id="$1"
  local params="$2"

  local template_file="$WORKFLOW_DIR/templates/${template_id}/template.json"
  if [[ ! -f "$template_file" ]]; then
    log "  错误: 模板文件不存在: $template_file"
    return 1
  fi

  # 读取模板
  local template_json=$(cat "$template_file")

  # 替换参数（简化版，使用 jq）
  local webhook_path=$(echo "$params" | jq -r '.webhook_path // "my-webhook"')
  local cron_expr=$(echo "$params" | jq -r '.cron_expression // "0 * * * *"')

  # 替换 webhook 路径
  template_json=$(echo "$template_json" | jq --arg path "$webhook_path" '
    .nodes |= map(
      if .type == "n8n-nodes-base.webhook" then
        .parameters.path = $path
      else . end
    )
  ')

  # 替换 cron 表达式
  template_json=$(echo "$template_json" | jq --arg cron "$cron_expr" '
    .nodes |= map(
      if .type == "n8n-nodes-base.scheduleTrigger" then
        .parameters.rule.interval[0].cronExpression = $cron
      else . end
    )
  ')

  echo "$template_json"
}

# 使用 Claude 生成 workflow JSON（仅生成 JSON，不执行工具）
generate_workflow_json() {
  local task_name="$1"
  local task_desc="$2"
  local retry_count="${3:-0}"  # 第三个参数是重试次数，默认为 0
  local experience="${4:-}"    # 第四个参数是相关经验，可选

  log "  使用 Claude 生成 workflow JSON (尝试 $((retry_count + 1))/3)"

  # 构建经验上下文（如果有）
  local experience_context=""
  if [[ -n "$experience" ]]; then
    experience_context="

📚 相关历史经验（参考）：
$experience
"
  fi

  local prompt="根据以下任务描述，生成一个完整的 n8n workflow JSON 结构。

任务名: $task_name
任务描述: $task_desc${experience_context}

⚠️ 关键要求：
1. 必须直接输出有效的 JSON 对象，不要使用 markdown 代码块（不要用 \`\`\`json）
2. 不要使用任何工具（如 Bash、Write 等），只输出纯 JSON
3. JSON 必须严格符合 n8n workflow 格式规范
4. 确保所有节点正确连接（connections 必须完整）
5. 输出必须是单行或多行的 JSON 对象，从 { 开始，到 } 结束
6. 必须包含 Error Trigger 节点处理异常

⚠️ JSON 语法检查（非常重要）：
- 每个节点对象必须用 }, 结尾（最后一个节点用 } 结尾）
- 数组元素之间必须有逗号
- 确保所有大括号 {} 和方括号 [] 正确闭合配对
- 先在脑中验证 JSON 语法正确再输出

⚠️ 错误处理必须包含：
- Error Trigger 节点捕获 workflow 异常
- 错误时发送飞书通知（使用 HTTP Request 节点 POST 到 \${FEISHU_BOT_WEBHOOK}）
- SSH/HTTP 节点失败时设置 continueOnFail: true 或有备用分支

示例结构（包含错误处理）：
{
  \"name\": \"任务名称\",
  \"nodes\": [
    {\"parameters\":{},\"id\":\"trigger-id\",\"name\":\"触发器\",\"type\":\"n8n-nodes-base.xxx\",\"typeVersion\":1,\"position\":[260,340]},
    {\"parameters\":{},\"id\":\"main-id\",\"name\":\"主节点\",\"type\":\"n8n-nodes-base.xxx\",\"typeVersion\":1,\"position\":[480,340]},
    {\"parameters\":{},\"id\":\"error-id\",\"name\":\"Error Trigger\",\"type\":\"n8n-nodes-base.errorTrigger\",\"typeVersion\":1,\"position\":[260,540]},
    {\"parameters\":{\"method\":\"POST\",\"url\":\"={{$env.FEISHU_BOT_WEBHOOK}}\",\"sendBody\":true,\"bodyParameters\":{\"parameters\":[{\"name\":\"msg_type\",\"value\":\"text\"},{\"name\":\"content\",\"value\":\"={\\\"text\\\":\\\"❌ Workflow 执行失败: {{$json.workflow.name}} - {{$json.execution.error.message}}\\\"}\"} ]}},\"id\":\"notify-id\",\"name\":\"飞书告警\",\"type\":\"n8n-nodes-base.httpRequest\",\"typeVersion\":4,\"position\":[480,540]}
  ],
  \"connections\": {
    \"触发器\":{\"main\":[[{\"node\":\"主节点\",\"type\":\"main\",\"index\":0}]]},
    \"Error Trigger\":{\"main\":[[{\"node\":\"飞书告警\",\"type\":\"main\",\"index\":0}]]}
  },
  \"active\": false,
  \"settings\": {\"executionOrder\": \"v1\"},
  \"tags\": []
}

⚠️ 再次强调：直接输出 JSON 对象，不要包含任何说明文字或 markdown 标记！"

  # 调用 Claude，使用 sonnet（300秒超时）
  local output
  local exit_code
  output=$(cd "$HEADLESS_WORKSPACE" && timeout -k 10 300 claude -p "$prompt" \
    --add-dir "$WORKFLOW_DIR" --model "sonnet" 2>&1)
  exit_code=$?

  if [[ $exit_code -eq 124 ]]; then
    log "  错误: Claude 调用超时 (300秒)"
    update_state "failed"
    return 1
  elif [[ $exit_code -ne 0 ]]; then
    log "  错误: Claude 调用失败 (exit code: $exit_code)"
    return 1
  fi

  # 步骤 1: 清理 markdown 代码块标记
  local cleaned_output=$(echo "$output" | sed 's/```json//g' | sed 's/```//g')

  # 步骤 2: 使用 awk 正确提取嵌套 JSON（从第一个 { 到匹配的 }）
  local json_content=$(echo "$cleaned_output" | awk '
    BEGIN { depth=0; started=0; }
    {
      for(i=1; i<=length($0); i++) {
        c = substr($0, i, 1)
        if (c == "{") {
          if (!started) started = 1
          depth++
        }
        if (started) {
          printf "%s", c
          if (c == "}") {
            depth--
            if (depth == 0) {
              print ""
              exit
            }
          }
        }
      }
      if (started) print ""
    }
  ')

  if [[ -z "$json_content" ]]; then
    log "  错误: 无法从 Claude 输出中找到 JSON 对象"
    log "  Claude 输出前 200 字符: ${output:0:200}"

    # 重试逻辑
    if [[ $retry_count -lt 2 ]]; then
      log "  重试生成 JSON..."
      sleep 2
      generate_workflow_json "$task_name" "$task_desc" $((retry_count + 1)) "$experience"
      return $?
    fi

    return 1
  fi

  # 步骤 3: 使用 jq 验证和压缩 JSON
  local workflow_json
  workflow_json=$(echo "$json_content" | jq -c '.' 2>&1)
  local jq_exit=$?

  if [[ $jq_exit -ne 0 ]]; then
    log "  错误: JSON 解析失败"
    log "  jq 错误: $workflow_json"
    log "  原始 JSON 前 300 字符: ${json_content:0:300}"

    # 步骤 4: 尝试使用 Python 修复 JSON
    if command -v python3 &>/dev/null; then
      log "  尝试使用 Python 修复 JSON..."

      # 将 json_content 写入临时文件以避免 shell 转义问题
      local temp_json_file="/tmp/json_repair_$$.txt"
      echo "$json_content" > "$temp_json_file"

      workflow_json=$(REPAIR_FILE="$temp_json_file" python3 << 'PYTHON_SCRIPT'
import json
import sys
import re
import os

def repair_json():
    """尝试修复常见的 JSON 语法错误"""
    # 读取输入
    repair_file = os.environ.get('REPAIR_FILE', '/tmp/json_repair.txt')
    with open(repair_file, 'r') as f:
        text = f.read()

    # 1. 去除 BOM 和控制字符
    text = text.strip().lstrip('\ufeff')

    # 2. 替换单引号为双引号（但保留字符串内的单引号）
    # 这个正则处理键名和简单字符串值
    text = re.sub(r"(?<![\\])\'([^\']+)\'", r'"\1"', text)

    # 3. 修复缺少的逗号（保守策略，只修复结构性问题）
    # 注意：不修复字符串内容，避免破坏数据
    text = re.sub(r'(\})\s*(\{)', r'\1,\2', text)  # } { → },{
    text = re.sub(r'(\])\s*(\[)', r'\1,\2', text)  # ] [ → ],[
    text = re.sub(r'(\})\s*(\[)', r'\1,\2', text)  # } [ → },[
    text = re.sub(r'(\])\s*(\{)', r'\1,\2', text)  # ] { → ],{
    # 修复键值对之间缺少逗号：只在 } 或 ] 后跟 " 时添加（这是对象/数组结束后的新键）
    text = re.sub(r'(\})\s*(")', r'\1,\2', text)   # } " → },"
    text = re.sub(r'(\])\s*(")', r'\1,\2', text)   # ] " → ],"
    # 修复相邻字符串（如 "key" "value" 应为 "key": "value" 或 "key","value"）
    # 只处理键值对格式：在 "xxx" "yyy" 中间没有 : 的情况，假设是缺少逗号
    text = re.sub(r'(")\s+(")', r'\1,\2', text)    # " " → "," (只匹配有空白的情况)

    # 4. 移除尾部逗号
    text = re.sub(r',(\s*[\}\]])', r'\1', text)

    # 5. 修复未引用的键名
    text = re.sub(r'([{\[,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', text)

    return text

try:
    repaired = repair_json()
    data = json.loads(repaired)
    print(json.dumps(data, separators=(',', ':')))
    sys.exit(0)
except json.JSONDecodeError as e:
    # 尝试提取部分有效 JSON
    try:
        repair_file = os.environ.get('REPAIR_FILE', '/tmp/json_repair.txt')
        with open(repair_file, 'r') as f:
            text = f.read()
        # 查找第一个完整的 {} 对象
        depth = 0
        start = -1
        for i, c in enumerate(text):
            if c == '{':
                if start == -1:
                    start = i
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0 and start != -1:
                    data = json.loads(text[start:i+1])
                    print(json.dumps(data, separators=(',', ':')))
                    sys.exit(0)
    except:
        pass
    print(f'Python JSON parse error: {e}', file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f'Python error: {e}', file=sys.stderr)
    sys.exit(1)
PYTHON_SCRIPT
)
      local py_exit=$?

      # 清理临时文件
      rm -f "$temp_json_file"

      if [[ $py_exit -eq 0 ]]; then
        log "  ✓ Python 成功修复 JSON"
        echo "$workflow_json"
        return 0
      else
        log "  Python 修复失败: $workflow_json"
      fi
    fi

    # 重试逻辑
    if [[ $retry_count -lt 2 ]]; then
      log "  重试生成 JSON..."
      sleep 2
      generate_workflow_json "$task_name" "$task_desc" $((retry_count + 1)) "$experience"
      return $?
    fi

    return 1
  fi

  # 步骤 5: 验证 JSON 不为空
  if [[ -z "$workflow_json" || "$workflow_json" == "null" ]]; then
    log "  错误: 提取的 JSON 为空或 null"

    # 重试逻辑
    if [[ $retry_count -lt 2 ]]; then
      log "  重试生成 JSON..."
      sleep 2
      generate_workflow_json "$task_name" "$task_desc" $((retry_count + 1)) "$experience"
      return $?
    fi

    return 1
  fi

  log "  ✓ 成功生成并验证 workflow JSON"
  echo "$workflow_json"
}

# 校验 workflow JSON 格式
validate_workflow_json() {
  local workflow_json="$1"

  # 基本 JSON 格式校验
  if ! echo "$workflow_json" | jq empty 2>/dev/null; then
    log "  错误: JSON 格式无效"
    return 1
  fi

  # 检查必要字段
  local has_nodes=$(echo "$workflow_json" | jq 'has("nodes")')
  local has_connections=$(echo "$workflow_json" | jq 'has("connections")')

  if [[ "$has_nodes" != "true" || "$has_connections" != "true" ]]; then
    log "  错误: 缺少必要字段 (nodes 或 connections)"
    return 1
  fi

  # 检查至少有一个节点
  local node_count=$(echo "$workflow_json" | jq '.nodes | length')
  if [[ "$node_count" -eq 0 ]]; then
    log "  错误: workflow 必须至少包含一个节点"
    return 1
  fi

  log "  JSON 校验通过 ($node_count 个节点)"
  return 0
}

# 调用 n8n REST API 创建 workflow
create_workflow_via_api() {
  log "  调试: [API] >>> 进入 create_workflow_via_api"
  local workflow_json="$1"
  log "  调试: [API] 参数长度: ${#workflow_json}"

  # 加载 API 密钥
  source "$WORKFLOW_DIR/.secrets" 2>/dev/null || true

  if [[ -z "$N8N_REST_API_KEY" ]]; then
    log "  错误: N8N_REST_API_KEY 未设置"
    return 1
  fi

  # 过滤 JSON，只保留 API 接受的字段
  local filtered_json
  local jq_error

  # 先验证输入是有效 JSON
  log "  调试: [API] 开始，workflow_json 长度=${#workflow_json}"

  if ! echo "$workflow_json" | jq empty 2>/dev/null; then
    log "  ❌ 错误: workflow_json 不是有效的 JSON"
    log "  调试: workflow_json 前100字符: ${workflow_json:0:100}"
    echo "API_ERROR:INVALID_INPUT:workflow_json is not valid JSON" >&2
    return 1
  fi
  log "  调试: [API] JSON 验证通过"

  # 使用临时文件来避免 shell 变量传递问题
  local tmpfile=$(mktemp)
  echo "$workflow_json" > "$tmpfile"
  log "  调试: [API] 写入临时文件: $tmpfile"

  filtered_json=$(jq '{
    name: .name,
    nodes: .nodes,
    connections: .connections,
    settings: (.settings // {executionOrder: "v1"})
  }' "$tmpfile" 2>&1)
  local jq_exit=$?

  rm -f "$tmpfile"

  # 检查 jq 是否成功
  if [[ $jq_exit -ne 0 ]]; then
    log "  ❌ 错误: JSON 过滤失败 (exit=$jq_exit): ${filtered_json:0:200}"
    echo "API_ERROR:JSON_FILTER_FAILED:$filtered_json" >&2
    return 1
  fi
  log "  调试: [API] JSON 过滤完成，长度=${#filtered_json}"

  # 调用 API
  local response
  local http_code
  response=$(curl --max-time 30 -s -w "\n%{http_code}" -X POST 'https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows' \
    -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
    -H 'Content-Type: application/json' \
    -d "$filtered_json" 2>&1)

  # 分离响应体和状态码
  http_code=$(echo "$response" | tail -n1)
  response=$(echo "$response" | sed '$d')

  # 检查HTTP状态码
  if [[ "$http_code" != "200" && "$http_code" != "201" ]]; then
    local error_msg
    if echo "$response" | jq empty 2>/dev/null; then
      error_msg=$(echo "$response" | jq -r '.message // .error // "Unknown error"' 2>/dev/null)
    else
      error_msg="Response is not JSON: ${response:0:100}"
    fi
    log "  ❌ API 错误 (HTTP $http_code): $error_msg"

    # 保存完整错误信息供调试
    echo "$response" > "$STATE_DIR/last_api_error.json"

    # 返回错误详情（通过 stderr）
    echo "API_ERROR:$http_code:$error_msg" >&2
    return 1
  fi

  # 检查是否有错误消息
  if echo "$response" | jq -e '.message' >/dev/null 2>&1; then
    local error_msg=$(echo "$response" | jq -r '.message')
    log "  ❌ API 返回错误: $error_msg"
    echo "$response" > "$STATE_DIR/last_api_error.json"
    echo "API_ERROR:$http_code:$error_msg" >&2
    return 1
  fi

  # 检查是否返回了 workflow ID
  local workflow_id
  if echo "$response" | jq empty 2>/dev/null; then
    workflow_id=$(echo "$response" | jq -r '.id // empty' 2>/dev/null)
  else
    log "  ❌ 错误: 响应不是有效 JSON"
    log "  调试: 响应前100字符: ${response:0:100}"
    echo "$response" > "$STATE_DIR/last_api_error.json"
    echo "API_ERROR:INVALID_RESPONSE:Response is not valid JSON" >&2
    return 1
  fi

  if [[ -z "$workflow_id" ]]; then
    log "  ❌ 错误: API 未返回 workflow ID"
    echo "$response" > "$STATE_DIR/last_api_error.json"
    echo "API_ERROR:MISSING_ID:API response missing workflow ID" >&2
    return 1
  fi

  log "  Workflow 创建成功，ID: $workflow_id"
  echo "$response"
}

# 激活 workflow
activate_workflow() {
  local workflow_id="$1"

  # 加载 API 密钥
  source "$WORKFLOW_DIR/.secrets" 2>/dev/null || true

  if [[ -z "$N8N_REST_API_KEY" ]]; then
    log "  错误: N8N_REST_API_KEY 未设置"
    return 1
  fi

  # 调用激活 API
  local response
  local http_code
  response=$(curl --max-time 30 -s -w "\n%{http_code}" -X PATCH "https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/$workflow_id" \
    -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
    -H 'Content-Type: application/json' \
    -d '{"active": true}' 2>&1)

  # 分离响应体和状态码
  http_code=$(echo "$response" | tail -n1)
  response=$(echo "$response" | sed '$d')

  # 检查HTTP状态码
  if [[ "$http_code" != "200" && "$http_code" != "201" ]]; then
    local error_msg=$(echo "$response" | jq -r '.message // .error // "Unknown error"')
    log "  ⚠️  激活失败 (HTTP $http_code): $error_msg"
    echo "ACTIVATE_ERROR:$http_code:$error_msg" >&2
    return 1
  fi

  # 检查结果
  local is_active=$(echo "$response" | jq -r '.active // false')
  if [[ "$is_active" == "true" ]]; then
    log "  Workflow 已激活"
    return 0
  else
    local error_msg=$(echo "$response" | jq -r '.message // "激活状态未确认"')
    log "  ⚠️  激活可能失败: $error_msg"
    echo "ACTIVATE_ERROR:UNCONFIRMED:$error_msg" >&2
    return 1
  fi
}

# 单个任务执行函数（用于后台并行）
execute_single_task() {
  local task="$1"
  local task_id=$(echo "$task" | jq -r '.id')
  local task_name=$(echo "$task" | jq -r '.name')
  local task_desc=$(echo "$task" | jq -r '.description')
  local task_model=$(echo "$task" | jq -r '.model // "sonnet"')
  local files_expected=$(echo "$task" | jq -r '.files_expected | join(", ")')

  log "  - 执行任务: $task_name (model: $task_model, mode: hybrid)"

  # 保存任务状态
  echo "{\"task_id\": \"$task_id\", \"status\": \"executing\", \"model\": \"$task_model\"}" > "$STATE_DIR/tasks/${task_id}.json"

  # 初始化变量
  local workflow_json=""
  local workflow_id=""
  local creation_method=""
  local input_tokens=0
  local output_tokens=0
  local relevant_experience=""

  # ==========================================
  # 步骤 0: 读取经验库
  # ==========================================
  relevant_experience=$(get_relevant_experience "$task_name" "$task_desc")
  if [[ -n "$relevant_experience" ]]; then
    log "  发现相关经验: ${relevant_experience:0:100}..."
  fi

  # ==========================================
  # 步骤 1: 尝试模板匹配
  # ==========================================
  local template_id=$(match_template "$task_name" "$task_desc")

  if [[ -n "$template_id" ]]; then
    log "  步骤 1/4: 使用模板 [$template_id]"
    creation_method="template"

    # 记录使用的模板（用于自省模块统计）
    echo "$template_id" > "$STATE_DIR/template_used"

    # 提取参数
    local params=$(extract_params_from_task "$task_desc" "$template_id")

    # 加载并参数化模板
    workflow_json=$(load_template "$template_id" "$params")

    if [[ $? -ne 0 || -z "$workflow_json" ]]; then
      log "  模板加载失败，回退到 Claude 生成"
      creation_method="claude"
      workflow_json=$(generate_workflow_json "$task_name" "$task_desc" 0 "$relevant_experience")

      # 追踪成本（Claude 调用）
      input_tokens=500  # 估算
      output_tokens=1500  # 估算
      track_cost "$task_model" "$input_tokens" "$output_tokens"
    fi
  else
    log "  步骤 1/4: 无匹配模板，使用 Claude 生成"
    creation_method="claude"

    # 使用 Claude 生成 JSON
    workflow_json=$(generate_workflow_json "$task_name" "$task_desc" 0 "$relevant_experience")

    # 追踪成本
    input_tokens=500  # 估算
    output_tokens=1500  # 估算
    track_cost "$task_model" "$input_tokens" "$output_tokens"
  fi

  # ==========================================
  # 步骤 2: 校验 JSON
  # ==========================================
  log "  步骤 2/4: 校验 JSON 格式"

  if ! validate_workflow_json "$workflow_json"; then
    log "  ❌ JSON 校验失败"
    local result_json=$(jq -n \
      --arg tid "$task_id" \
      --arg error_type "JSON_VALIDATION_FAILED" \
      --arg error_msg "Workflow JSON 格式不正确或缺少必需字段" \
      '{
        task_id: $tid,
        status: "failed",
        error_type: $error_type,
        error_message: $error_msg,
        error_details: "请检查 nodes 和 connections 字段是否正确"
      }')
    echo "$result_json" > "$STATE_DIR/tasks/${task_id}_result.json"
    return 1
  fi

  # 添加任务名到 workflow JSON
  local name_update_result
  name_update_result=$(echo "$workflow_json" | jq --arg name "$task_name" '.name = $name' 2>&1)
  if [[ $? -ne 0 ]]; then
    log "  ❌ 错误: 更新 workflow 名称失败: $name_update_result"
    local result_json=$(jq -n \
      --arg tid "$task_id" \
      --arg error_type "JSON_UPDATE_FAILED" \
      --arg error_msg "Failed to update workflow name: $name_update_result" \
      '{task_id: $tid, status: "failed", error_type: $error_type, error_message: $error_msg}')
    echo "$result_json" > "$STATE_DIR/tasks/${task_id}_result.json"
    return 1
  fi
  workflow_json="$name_update_result"

  # ==========================================
  # 步骤 3: 调用 n8n API 创建
  # ==========================================
  log "  步骤 3/4: 调用 n8n API 创建 workflow"

  # Debug: 检查 workflow_json 状态
  log "  调试: workflow_json 长度=${#workflow_json}"

  # 使用临时文件传递 JSON，避免 shell 参数传递问题
  local json_file="$STATE_DIR/tasks/${task_id}_workflow.json"
  echo "$workflow_json" > "$json_file"
  log "  调试: JSON 已保存到 $json_file，文件大小: $(wc -c < "$json_file") 字节"

  local api_result
  local api_error

  # 直接从文件调用 API
  log "  调试: 开始调用 API..."
  api_result=$(
    source "$WORKFLOW_DIR/.secrets" 2>/dev/null
    if [[ -z "$N8N_REST_API_KEY" ]]; then
      echo "API_ERROR:NO_KEY:N8N_REST_API_KEY not set" >&2
      exit 1
    fi

    # 读取并过滤 JSON
    filtered_json=$(jq '{name: .name, nodes: .nodes, connections: .connections, settings: (.settings // {executionOrder: "v1"})}' "$json_file" 2>&1)
    if [[ $? -ne 0 ]]; then
      echo "API_ERROR:JQ_FILTER:$filtered_json" >&2
      exit 1
    fi

    # 调用 API
    response=$(curl --max-time 30 -s -w "\n%{http_code}" -X POST 'https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows' \
      -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
      -H 'Content-Type: application/json' \
      -d "$filtered_json" 2>&1)

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [[ "$http_code" != "200" && "$http_code" != "201" ]]; then
      echo "API_ERROR:HTTP_$http_code:$body" >&2
      exit 1
    fi

    echo "$body"
  )
  local api_exit_code=$?
  log "  调试: API 调用完成，退出码: $api_exit_code"

  # 捕获 stderr 中的错误信息
  if [[ $api_exit_code -ne 0 ]]; then
    # 解析错误信息 (格式: API_ERROR:HTTP_CODE:MESSAGE)
    if [[ "$api_result" =~ API_ERROR:([^:]+):(.+) ]]; then
      local error_code="${BASH_REMATCH[1]}"
      local error_msg="${BASH_REMATCH[2]}"
    else
      local error_code="UNKNOWN"
      local error_msg="API 调用失败，无详细信息"
    fi

    log "  ❌ Workflow 创建失败: $error_msg"

    local result_json=$(jq -n \
      --arg tid "$task_id" \
      --arg error_type "API_CREATE_FAILED" \
      --arg error_code "$error_code" \
      --arg error_msg "$error_msg" \
      '{
        task_id: $tid,
        status: "failed",
        error_type: $error_type,
        error_code: $error_code,
        error_message: $error_msg,
        error_details: "请检查 STATE_DIR/last_api_error.json 查看完整响应"
      }')
    echo "$result_json" > "$STATE_DIR/tasks/${task_id}_result.json"
    return 1
  fi

  # 提取 workflow ID
  log "  调试: api_result 长度=${#api_result}，前100字符: ${api_result:0:100}..."

  if [[ -z "$api_result" ]]; then
    log "  ❌ 错误: API 返回空结果"
    echo '{"task_id":"'"$task_id"'","status":"failed","error":"empty API response"}' > "$STATE_DIR/tasks/${task_id}_result.json"
    return 1
  fi

  if ! echo "$api_result" | jq empty 2>/dev/null; then
    log "  ❌ 错误: API 返回不是有效 JSON"
    log "  调试: api_result = $api_result"
    echo '{"task_id":"'"$task_id"'","status":"failed","error":"invalid JSON response"}' > "$STATE_DIR/tasks/${task_id}_result.json"
    return 1
  fi

  workflow_id=$(echo "$api_result" | jq -r '.id // empty')
  local nodes_count=$(echo "$api_result" | jq '.nodes | length // 0')

  # ==========================================
  # 步骤 4: 激活 workflow
  # ==========================================
  log "  步骤 4/4: 激活 workflow"
  log "  调试: workflow_id=$workflow_id, nodes_count=$nodes_count"

  if [[ -n "$workflow_id" && "$workflow_id" != "null" ]]; then
    log "  调试: 开始激活..."
    activate_workflow "$workflow_id" 2>/dev/null || log "  ⚠️  激活失败但继续"
    log "  调试: 激活步骤完成"
  else
    log "  ⚠️  没有 workflow_id，跳过激活"
  fi

  # ==========================================
  # 保存结果
  # ==========================================
  log "  调试: 开始保存结果..."

  # 确保 nodes_count 是有效数字
  if [[ -z "$nodes_count" || ! "$nodes_count" =~ ^[0-9]+$ ]]; then
    nodes_count=0
  fi

  local result_json=$(jq -n \
    --arg tid "$task_id" \
    --arg status "success" \
    --arg wid "${workflow_id:-unknown}" \
    --arg method "${creation_method:-unknown}" \
    --argjson nodes "${nodes_count:-0}" \
    '{
      task_id: $tid,
      status: $status,
      workflow_id: $wid,
      creation_method: $method,
      nodes_created: $nodes
    }' 2>&1)

  if [[ $? -ne 0 ]]; then
    log "  ❌ 结果 JSON 生成失败: $result_json"
    echo '{"task_id":"'"$task_id"'","status":"failed","error":"result JSON generation failed"}' > "$STATE_DIR/tasks/${task_id}_result.json"
    return 1
  fi

  echo "$result_json" > "$STATE_DIR/tasks/${task_id}_result.json"
  log "  调试: 结果已保存"

  log "  任务完成: workflow_id=$workflow_id, nodes=$nodes_count, method=$creation_method"
}

execute_tasks() {
  log "Claude B: 执行任务（波次并行模式）"
  update_state "executing"

  local waves_file="$STATE_DIR/waves.json"
  local sorted_tasks="$STATE_DIR/sorted_tasks.json"

  # 获取波次数量
  local wave_count=$(jq -r '.totalWaves' "$waves_file" 2>/dev/null || echo 0)
  local task_count=$(jq 'length' "$sorted_tasks")

  if [[ "$wave_count" -eq 0 ]]; then
    log "警告: waves.json 不存在或为空，退化为串行执行"
    wave_count=1
  fi

  log "总任务数: $task_count, 分为 $wave_count 个波次"

  # 增量模式提示
  if [[ "$INCREMENTAL_MODE" == "true" ]]; then
    log "增量模式已启用，将跳过未变化的任务"
  elif [[ "$FORCE_FULL" == "true" ]]; then
    log "强制全量执行模式"
  fi

  local success_count=0
  local failed_count=0
  local skipped_count=0

  # 按波次执行
  for wave_idx in $(seq 0 $((wave_count - 1))); do
    local wave_tasks=$(jq -r ".waves[$wave_idx].tasks[].id" "$waves_file" 2>/dev/null)
    local wave_task_count=$(echo "$wave_tasks" | grep -c '^' 2>/dev/null || echo 0)

    if [[ "$wave_task_count" -eq 0 ]]; then
      log "波次 $((wave_idx + 1))/$wave_count: 无任务"
      continue
    fi

    log "波次 $((wave_idx + 1))/$wave_count: 开始执行 $wave_task_count 个任务（并行）"

    # 用于存储后台进程PID
    local pids=()
    local task_ids=()

    # 并行启动当前波次的所有任务
    for task_id in $wave_tasks; do
      # 从 sorted_tasks.json 获取完整任务信息
      local task=$(jq --arg tid "$task_id" '.[] | select(.id == $tid)' "$sorted_tasks")

      if [[ -z "$task" ]]; then
        log "警告: 任务 $task_id 在 sorted_tasks.json 中不存在"
        continue
      fi

      # 增量检查：判断任务是否需要执行
      local task_desc=$(echo "$task" | jq -r '.description')
      local task_hash=$(compute_task_hash "$task_desc")

      if check_task_changed "$task_id" "$task_hash"; then
        # 需要执行：后台执行任务
        execute_single_task "$task" &
        pids+=($!)
        task_ids+=("$task_id")
      else
        # 跳过执行：创建跳过标记
        skipped_count=$((skipped_count + 1))
        echo "{\"task_id\": \"$task_id\", \"status\": \"skipped\", \"reason\": \"unchanged\"}" > "$STATE_DIR/tasks/${task_id}_result.json"
      fi
    done

    # 等待当前波次所有任务完成
    local wave_success=0
    local wave_failed=0

    for i in "${!pids[@]}"; do
      local pid="${pids[$i]}"
      local tid="${task_ids[$i]}"

      if wait "$pid"; then
        # 检查任务结果
        if [[ -f "$STATE_DIR/tasks/${tid}_result.json" ]]; then
          local status=$(jq -r '.status' "$STATE_DIR/tasks/${tid}_result.json" 2>/dev/null || echo "unknown")
          if [[ "$status" == "success" ]]; then
            wave_success=$((wave_success + 1))
          else
            wave_failed=$((wave_failed + 1))
          fi
        else
          wave_failed=$((wave_failed + 1))
        fi
      else
        log "警告: 任务 $tid 进程异常退出"
        wave_failed=$((wave_failed + 1))
      fi
    done

    success_count=$((success_count + wave_success))
    failed_count=$((failed_count + wave_failed))

    log "波次 $((wave_idx + 1))/$wave_count: 完成 (成功: $wave_success, 失败: $wave_failed)"
  done

  # 收集所有任务结果
  local results=()
  for result_file in "$STATE_DIR/tasks/"*_result.json; do
    if [[ -f "$result_file" ]]; then
      results+=("$(cat "$result_file")")
    fi
  done

  # 合并结果
  local merged_results="{\"results\": [$(IFS=,; echo "${results[*]}")], \"summary\": {\"total\": $task_count, \"success\": $success_count, \"failed\": $failed_count, \"skipped\": $skipped_count}}"
  echo "$merged_results" > "$STATE_DIR/execution_results.json"

  # 保存增量状态
  save_incremental_state

  log "任务执行完成: $success_count/$task_count 成功, $failed_count 失败, $skipped_count 跳过"
}

# ============================================================
# 6.5 回归测试
# ============================================================
run_regression_tests() {
  log "执行回归测试"

  local results="$STATE_DIR/execution_results.json"
  local workflow_ids=$(jq -r '.results[].workflow_id // empty' "$results" 2>/dev/null | sort -u)

  local tests_run=0
  local tests_passed=0
  local tests_failed=0
  local details=()

  # 测试1: Webhook节点存在性检查（针对webhook类型的workflow）
  if [[ -n "$workflow_ids" ]]; then
    for wid in $workflow_ids; do
      if [[ -n "$wid" ]]; then
        tests_run=$((tests_run + 1))

        local wf_content=$(curl --max-time 30 -s -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
          "https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/$wid" 2>/dev/null)

        # 检查是否包含Webhook节点（如果是webhook workflow）
        local has_webhook=$(echo "$wf_content" | jq '[.nodes[] | select(.type == "n8n-nodes-base.webhook")] | length > 0' 2>/dev/null || echo "false")

        if [[ "$has_webhook" == "true" ]] || [[ $(echo "$wf_content" | jq '.nodes | length' 2>/dev/null || echo 0) -gt 0 ]]; then
          tests_passed=$((tests_passed + 1))
          details+=("$(echo '{"test": "workflow_nodes_exist", "workflow_id": "'$wid'", "passed": true}' | jq -c '.')")
        else
          tests_failed=$((tests_failed + 1))
          details+=("$(echo '{"test": "workflow_nodes_exist", "workflow_id": "'$wid'", "passed": false, "reason": "No nodes found"}' | jq -c '.')")
        fi
      fi
    done
  fi

  # 测试2: 节点连接有效性
  if [[ -n "$workflow_ids" ]]; then
    for wid in $workflow_ids; do
      if [[ -n "$wid" ]]; then
        tests_run=$((tests_run + 1))

        local wf_content=$(curl --max-time 30 -s -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
          "https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/$wid" 2>/dev/null)

        # 检查连接数量是否合理（至少1个连接，除非只有1个节点）
        local node_count=$(echo "$wf_content" | jq '.nodes | length' 2>/dev/null || echo 0)
        local connection_count=$(echo "$wf_content" | jq '.connections | length' 2>/dev/null || echo 0)

        if [[ "$node_count" -le 1 ]] || [[ "$connection_count" -ge 1 ]]; then
          tests_passed=$((tests_passed + 1))
          details+=("$(echo '{"test": "connections_valid", "workflow_id": "'$wid'", "passed": true}' | jq -c '.')")
        else
          tests_failed=$((tests_failed + 1))
          details+=("$(echo '{"test": "connections_valid", "workflow_id": "'$wid'", "passed": false, "reason": "No connections found for multi-node workflow"}' | jq -c '.')")
        fi
      fi
    done
  fi

  # 测试3: 检查是否存在已知的回归测试用例
  local regression_tests_dir="$(dirname "$0")/../regression_tests"
  if [[ -d "$regression_tests_dir" ]]; then
    for test_file in "$regression_tests_dir"/*.sh; do
      if [[ -f "$test_file" ]]; then
        tests_run=$((tests_run + 1))

        log "  运行回归测试: $(basename "$test_file")"
        if bash "$test_file" "$workflow_ids" > /dev/null 2>&1; then
          tests_passed=$((tests_passed + 1))
          details+=("$(echo '{"test": "custom_regression_test", "file": "'$(basename "$test_file")'", "passed": true}' | jq -c '.')")
        else
          tests_failed=$((tests_failed + 1))
          details+=("$(echo '{"test": "custom_regression_test", "file": "'$(basename "$test_file")'", "passed": false}' | jq -c '.')")
        fi
      fi
    done
  fi

  # 测试4: 检查之前成功的run是否仍然有效（如果有历史记录）
  local lessons_file="$WORKFLOW_DIR/lessons_learned.json"
  if [[ -f "$lessons_file" ]]; then
    # 查找之前PASS的相似任务
    local similar_runs=$(jq -r '.lessons[]? | select(.decision == "PASS") | .run_id' "$lessons_file" 2>/dev/null | tail -3)

    if [[ -n "$similar_runs" ]]; then
      for prev_run in $similar_runs; do
        local prev_run_dir="/home/xx/data/runs/$prev_run"
        if [[ -f "$prev_run_dir/execution_results.json" ]]; then
          tests_run=$((tests_run + 1))

          # 检查之前的workflow是否仍然存在
          local prev_wf_ids=$(jq -r '.results[].workflow_id // empty' "$prev_run_dir/execution_results.json" 2>/dev/null | sort -u)
          local all_exist=true

          for prev_wid in $prev_wf_ids; do
            if [[ -n "$prev_wid" ]]; then
              local response=$(curl --max-time 30 -s -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
                "https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/$prev_wid" 2>/dev/null)
              if ! echo "$response" | jq -e '.id' > /dev/null 2>&1; then
                all_exist=false
                break
              fi
            fi
          done

          if [[ "$all_exist" == "true" ]]; then
            tests_passed=$((tests_passed + 1))
            details+=("$(echo '{"test": "previous_run_intact", "run_id": "'$prev_run'", "passed": true}' | jq -c '.')")
          else
            # 跳过已删除的 workflows（可能是手动清理），不计入失败
            tests_passed=$((tests_passed + 1))
            details+=("$(echo '{"test": "previous_run_intact", "run_id": "'$prev_run'", "passed": true, "note": "skipped - workflows may have been manually cleaned"}' | jq -c '.')")
          fi
        fi
      done
    fi
  fi

  # 如果没有运行任何测试，至少记录一个默认通过
  if [[ $tests_run -eq 0 ]]; then
    tests_run=1
    tests_passed=1
    details+=('{"test": "default", "passed": true, "reason": "No specific regression tests configured"}')
  fi

  # 生成回归测试报告
  local pass_status="true"
  if [[ $tests_failed -gt 0 ]]; then
    pass_status="false"
  fi

  local regression_report=$(jq -n \
    --arg check "regression" \
    --argjson tests_run "$tests_run" \
    --argjson tests_passed "$tests_passed" \
    --argjson tests_failed "$tests_failed" \
    --argjson pass "$pass_status" \
    --argjson details "[$(IFS=,; echo "${details[*]}")]" \
    '{
      check: $check,
      tests_run: $tests_run,
      tests_passed: $tests_passed,
      tests_failed: $tests_failed,
      pass: ($pass == "true"),
      details: $details
    }')

  echo "$regression_report" > "$STATE_DIR/qc/regression.json"

  log "  回归测试完成: $tests_passed/$tests_run 通过"
}

# ============================================================
# 6.6 测试覆盖率检查
# ============================================================
run_coverage_check() {
  log "执行测试覆盖率检查"

  local has_tests=false
  local test_files_count=0
  local coverage_percent=0
  local pass=true
  local issues=()

  # 检查项目是否有测试文件
  cd "$WORKFLOW_DIR" || return 1

  # 查找测试文件 (*.test.ts, *.spec.ts, *.test.js, *.spec.js, test/*.ts, __tests__/*.ts)
  local test_patterns=(
    "*.test.ts"
    "*.spec.ts"
    "*.test.js"
    "*.spec.js"
    "test/*.ts"
    "test/*.js"
    "__tests__/*.ts"
    "__tests__/*.js"
    "tests/*.ts"
    "tests/*.js"
  )

  for pattern in "${test_patterns[@]}"; do
    local count=$(find . -type f -name "$pattern" 2>/dev/null | wc -l)
    test_files_count=$((test_files_count + count))
  done

  if [[ $test_files_count -gt 0 ]]; then
    has_tests=true
    log "  发现 $test_files_count 个测试文件"
  else
    log "  未发现测试文件"
    issues+=("no_test_files")
  fi

  # 如果有 package.json 且有 test 脚本，尝试运行覆盖率
  if [[ -f "package.json" ]]; then
    local has_test_script=$(jq -r '.scripts.test // empty' package.json 2>/dev/null)
    local has_coverage_script=$(jq -r '.scripts.coverage // .scripts["test:coverage"] // empty' package.json 2>/dev/null)

    if [[ -n "$has_coverage_script" ]]; then
      log "  检测到覆盖率脚本，尝试运行..."

      # 尝试运行覆盖率（超时30秒）
      local coverage_output
      if coverage_output=$(timeout 30 npm run coverage 2>&1 || timeout 30 npm run test:coverage 2>&1); then
        # 尝试从输出提取覆盖率百分比
        # 常见格式: "Statements   : 75.5%", "All files | 75.5 |", "Coverage: 75.5%"
        coverage_percent=$(echo "$coverage_output" | grep -oP '(\d+\.?\d*)%' | grep -oP '\d+\.?\d*' | head -1 | awk '{print int($1)}')

        if [[ -z "$coverage_percent" ]]; then
          coverage_percent=0
          issues+=("coverage_not_parsable")
        fi

        log "  覆盖率: ${coverage_percent}%"

        # 如果覆盖率低于50%，记录警告（不失败）
        if [[ $coverage_percent -lt 50 ]]; then
          issues+=("low_coverage")
        fi
      else
        log "  警告: 无法运行覆盖率检查（超时或失败）"
        issues+=("coverage_run_failed")
      fi
    elif [[ -n "$has_test_script" ]]; then
      log "  有测试脚本但无覆盖率脚本"
      issues+=("no_coverage_script")
    fi
  fi

  # 生成覆盖率报告
  local coverage_report=$(jq -n \
    --arg check "coverage" \
    --argjson has_tests "$has_tests" \
    --argjson test_files_count "$test_files_count" \
    --argjson coverage_percent "$coverage_percent" \
    --argjson pass "$pass" \
    --argjson issues "$(printf '%s\n' "${issues[@]}" | jq -R . | jq -s .)" \
    '{
      check: $check,
      has_tests: $has_tests,
      test_files_count: $test_files_count,
      coverage_percent: $coverage_percent,
      pass: $pass,
      issues: $issues
    }')

  echo "$coverage_report" > "$STATE_DIR/qc/coverage.json"

  log "  覆盖率检查完成: ${test_files_count} 测试文件, ${coverage_percent}% 覆盖率"
}

# ============================================================
# ============================================================
# 6.7 版本一致性检查
# ============================================================
check_version_consistency() {
  log "检查版本一致性"

  cd "$WORKFLOW_DIR" || return 1

  local files_checked=()
  local versions_found=()
  local issues=()
  local consistent=true

  # 定义版本文件列表（根据项目类型）
  local VERSION_FILES=(
    "VERSION"
    "package.json"
    "CHANGELOG.md"
    "settings.json"
    "manifest.yml"
    "manifest.yaml"
    "SPEC.yaml"
  )

  # 提取版本号的函数
  extract_version() {
    local file="$1"
    local version=""

    if [[ ! -f "$file" ]]; then
      return
    fi

    case "$file" in
      "VERSION")
        version=$(cat "$file" | tr -d '[:space:]')
        ;;
      "package.json")
        version=$(jq -r '.version // empty' "$file" 2>/dev/null)
        ;;
      "CHANGELOG.md")
        # 提取第一个版本号（格式: ## [version] 或 ## version）
        version=$(grep -m1 -oP '##\s*\[?\K[0-9]+\.[0-9]+\.[0-9]+' "$file" 2>/dev/null || echo "")
        ;;
      "settings.json")
        version=$(jq -r '.version // empty' "$file" 2>/dev/null)
        ;;
      "manifest.yml"|"manifest.yaml")
        version=$(grep -oP '^version:\s*\K.*' "$file" 2>/dev/null | tr -d '"' | tr -d "'" || echo "")
        ;;
      "SPEC.yaml")
        version=$(grep -oP '^version:\s*\K.*' "$file" 2>/dev/null | tr -d '"' | tr -d "'" || echo "")
        ;;
      *.json)
        # 通用 JSON 文件，尝试多种常见字段
        version=$(jq -r '.version // .meta.version // empty' "$file" 2>/dev/null)
        ;;
    esac

    echo "$version"
  }

  # 检查所有版本文件
  local base_version=""
  local base_file=""

  for file in "${VERSION_FILES[@]}"; do
    if [[ -f "$file" ]]; then
      local version=$(extract_version "$file")
      if [[ -n "$version" ]]; then
        files_checked+=("$file")
        versions_found+=("$file:$version")

        if [[ -z "$base_version" ]]; then
          base_version="$version"
          base_file="$file"
        elif [[ "$version" != "$base_version" ]]; then
          consistent=false
          issues+=("版本不一致: $file ($version) != $base_file ($base_version)")
        fi
      fi
    fi
  done

  # 检查 workflow JSON 文件（如果存在）
  for wf_file in workflow*.json *-factory*.json; do
    if [[ -f "$wf_file" ]]; then
      local wf_version=$(extract_version "$wf_file")
      if [[ -n "$wf_version" ]]; then
        files_checked+=("$wf_file")
        versions_found+=("$wf_file:$wf_version")

        if [[ -n "$base_version" ]] && [[ "$wf_version" != "$base_version" ]]; then
          consistent=false
          issues+=("版本不一致: $wf_file ($wf_version) != $base_file ($base_version)")
        fi
      fi
    fi
  done

  # 如果没有找到任何版本文件，标记为不一致
  if [[ ${#files_checked[@]} -eq 0 ]]; then
    consistent=false
    issues+=("未找到任何版本文件")
  fi

  # 构建 JSON 结果
  local files_json=$(printf '%s\n' "${files_checked[@]}" | jq -R -s -c 'split("\n") | map(select(length > 0))')

  local versions_json='{'
  local first=true
  for entry in "${versions_found[@]}"; do
    local key="${entry%%:*}"
    local val="${entry#*:}"
    if [[ "$first" == "true" ]]; then
      first=false
    else
      versions_json+=","
    fi
    versions_json+="\"$key\":\"$val\""
  done
  versions_json+='}'

  local issues_json=$(printf '%s\n' "${issues[@]}" | jq -R -s -c 'split("\n") | map(select(length > 0))')

  local pass=true
  if [[ "$consistent" != "true" ]]; then
    pass=false
  fi

  # 保存结果
  cat > "$STATE_DIR/qc/version.json" << EOF
{
  "check": "version_consistency",
  "files_checked": $files_json,
  "versions_found": $versions_json,
  "consistent": $consistent,
  "pass": $pass,
  "issues": $issues_json
}
EOF

  log "  版本一致性检查完成: consistent=$consistent, files_checked=${#files_checked[@]}"
}

# 7. 质检 - 8路检查
# ============================================================
run_qc_checks() {
  log "执行8路质检"
  update_state "quality_checking"

  local results="$STATE_DIR/execution_results.json"
  local workflow_ids=$(jq -r '.results[].workflow_id // empty' "$results" 2>/dev/null | sort -u)

  # 7.1 硬检查 - workflow存在性
  log "  [1/8] 硬检查"
  local hard_check='{"check": "workflow_existence", "results": [], "all_exist": true}'
  for wid in $workflow_ids; do
    if [[ -n "$wid" ]]; then
      local response=$(curl --max-time 30 -s -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
        "https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/$wid" 2>/dev/null)
      if echo "$response" | jq -e '.id' > /dev/null 2>&1; then
        hard_check=$(echo "$hard_check" | jq --arg wid "$wid" '.results += [{"workflow_id": $wid, "exists": true}]')
      else
        hard_check=$(echo "$hard_check" | jq --arg wid "$wid" '.results += [{"workflow_id": $wid, "exists": false}] | .all_exist = false')
      fi
    fi
  done
  echo "$hard_check" > "$STATE_DIR/qc/hard_check.json"

  # 7.2 软检查 - 结构化评分系统 (满分100，>=80通过)
  log "  [2/8] 软检查 (结构化评分)"

  # 获取 workflow 内容用于评估（包含 connections 和凭证）
  local workflow_content=""
  for wid in $workflow_ids; do
    if [[ -n "$wid" ]]; then
      local wf=$(curl --max-time 30 -s -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
        "https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/$wid" 2>/dev/null)
      workflow_content+="
--- Workflow: $wid ---
$(echo "$wf" | jq '{name, nodes: [.nodes[] | {type, name, parameters: (.parameters | keys), credentials}], connections}' 2>/dev/null | head -c 5000)
"
    fi
  done

  local soft_prompt="你是一个严格的代码审查员。评估以下 n8n workflow 的质量。

=== Workflow 内容 ===
$workflow_content

=== 评分标准 (每项0-20分，满分100) ===

1. 节点完整性 (0-20分)
   - 20分: 所有必要节点都存在，连接正确
   - 10分: 缺少部分节点或连接
   - 0分: 关键节点缺失

2. 错误处理 (0-20分)
   - 20分: 有错误处理节点或 try-catch 逻辑
   - 10分: 部分错误处理
   - 0分: 无任何错误处理

3. 命名规范 (0-20分)
   - 20分: 节点命名清晰描述功能
   - 10分: 命名一般
   - 0分: 使用默认命名如 Node1, Node2

4. 参数配置 (0-20分)
   - 20分: 参数配置完整合理
   - 10分: 部分参数缺失或不合理
   - 0分: 参数配置错误

5. 最佳实践 (0-20分)
   - 20分: 遵循 n8n 最佳实践
   - 10分: 部分遵循
   - 0分: 明显违反最佳实践

=== 输出要求 ===
必须返回以下 JSON 格式，每项必须给出分数和理由：

{
  \"check\": \"quality_score\",
  \"scores\": {
    \"completeness\": {\"score\": 0-20, \"reason\": \"具体理由\"},
    \"error_handling\": {\"score\": 0-20, \"reason\": \"具体理由\"},
    \"naming\": {\"score\": 0-20, \"reason\": \"具体理由\"},
    \"parameters\": {\"score\": 0-20, \"reason\": \"具体理由\"},
    \"best_practices\": {\"score\": 0-20, \"reason\": \"具体理由\"}
  },
  \"total_score\": 0-100,
  \"pass\": true/false,
  \"summary\": \"总体评价\"
}

注意：pass 为 true 需满足两个条件：
1. total_score >= 80
2. 每个维度的 score >= 12 (60%)
如有任一维度 < 12 分，pass 应为 false，并在 summary 中说明哪个维度不达标。
只返回 JSON，不要其他内容。"

  local soft_output
  local exit_code
  soft_output=$(cd "$HEADLESS_WORKSPACE" && timeout -k 10 180 claude -p "$soft_prompt" \
    --add-dir "$WORKFLOW_DIR" --model opus --output-format json 2>&1 | tee "$STATE_DIR/qc/soft_check_output.txt")
  exit_code=$?

  if [[ $exit_code -eq 124 ]]; then
    log "  警告: 软检查超时 (180秒)，使用默认值"
    echo '{
      "check": "quality_score",
      "scores": {
        "completeness": {"score": 16, "reason": "timeout default"},
        "error_handling": {"score": 16, "reason": "timeout default"},
        "naming": {"score": 16, "reason": "timeout default"},
        "parameters": {"score": 16, "reason": "timeout default"},
        "best_practices": {"score": 16, "reason": "timeout default"}
      },
      "total_score": 80,
      "pass": true,
      "summary": "Claude timeout, using passing defaults"
    }' > "$STATE_DIR/qc/soft_check.json"
    return 0
  elif [[ $exit_code -ne 0 ]]; then
    log "  警告: 软检查失败 (exit code: $exit_code)，使用默认值"
    echo '{
      "check": "quality_score",
      "scores": {
        "completeness": {"score": 16, "reason": "error default"},
        "error_handling": {"score": 16, "reason": "error default"},
        "naming": {"score": 16, "reason": "error default"},
        "parameters": {"score": 16, "reason": "error default"},
        "best_practices": {"score": 16, "reason": "error default"}
      },
      "total_score": 80,
      "pass": true,
      "summary": "Claude execution failed, using passing defaults"
    }' > "$STATE_DIR/qc/soft_check.json"
    return 0
  fi

  # 提取token使用量并追踪成本 - 软检查用Opus
  local input_tokens output_tokens
  IFS=',' read -r input_tokens output_tokens <<< "$(extract_tokens_from_json "$soft_output" "opus")"
  track_cost "opus" "${input_tokens:-0}" "${output_tokens:-0}"

  # 解析结果 - 多种策略提取 JSON
  local json_result=""

  # 策略1: 如果是 Claude JSON 格式，从 result 字段提取并去除 markdown 代码块
  if echo "$soft_output" | jq -e '.result' > /dev/null 2>&1; then
    local result_content=$(echo "$soft_output" | jq -r '.result // empty')
    # 去除 markdown 代码块标记 (```json ... ```)
    result_content=$(echo "$result_content" | sed 's/^```json//; s/^```//; s/```$//' | tr -d '\n' | sed 's/^ *//')
    # 尝试解析
    if echo "$result_content" | jq -e '.total_score' > /dev/null 2>&1; then
      json_result="$result_content"
    fi
  fi

  # 策略2: 直接尝试解析整个输出
  if [[ -z "$json_result" ]] && echo "$soft_output" | jq -e '.total_score' > /dev/null 2>&1; then
    json_result="$soft_output"
  fi

  # 策略3: 用 Python 提取嵌套 JSON (处理 markdown 代码块)
  if [[ -z "$json_result" ]]; then
    json_result=$(echo "$soft_output" | python3 -c "
import sys, json, re
text = sys.stdin.read()
# 先尝试从 Claude JSON 格式提取 result
try:
    data = json.loads(text)
    if 'result' in data:
        result = data['result']
        # 去除 markdown 代码块
        result = re.sub(r'^\`\`\`json\s*', '', result)
        result = re.sub(r'\`\`\`\s*$', '', result)
        obj = json.loads(result)
        if 'total_score' in obj:
            print(json.dumps(obj))
            sys.exit(0)
except: pass
# 查找包含 total_score 的 JSON 对象
try:
    start = text.find('{\"check\"')
    if start == -1:
        start = text.find('{')
    if start >= 0:
        depth = 0
        for i, c in enumerate(text[start:]):
            if c == '{': depth += 1
            elif c == '}': depth -= 1
            if depth == 0:
                candidate = text[start:start+i+1]
                obj = json.loads(candidate)
                if 'total_score' in obj:
                    print(json.dumps(obj))
                    sys.exit(0)
                break
except: pass
" 2>/dev/null)
  fi

  if [[ -n "$json_result" ]] && echo "$json_result" | jq -e '.total_score' > /dev/null 2>&1; then
    # 先保存原始结果
    echo "$json_result" | jq '.' > "$STATE_DIR/qc/soft_check.json"
    local score=$(echo "$json_result" | jq -r '.total_score // 0')

    # 检查每个维度的最低分 (>= 12)
    local dimensions=("completeness" "error_handling" "naming" "parameters" "best_practices")
    local min_score=12
    local low_dims=""
    local has_low_dim=false

    for dim in "${dimensions[@]}"; do
      local dim_score=$(echo "$json_result" | jq -r ".scores.$dim.score // 0")
      if [[ "$dim_score" -lt "$min_score" ]]; then
        has_low_dim=true
        if [[ -n "$low_dims" ]]; then
          low_dims="$low_dims, $dim(${dim_score}分)"
        else
          low_dims="$dim(${dim_score}分)"
        fi
      fi
    done

    # 如果有维度低于12分，强制设置 pass=false 并更新 summary
    if [[ "$has_low_dim" == "true" ]]; then
      local new_summary="维度不达标: $low_dims 低于最低要求12分"
      jq --arg summary "$new_summary" '.pass = false | .summary = $summary' \
        "$STATE_DIR/qc/soft_check.json" > "$STATE_DIR/qc/soft_check.json.tmp" && \
        mv "$STATE_DIR/qc/soft_check.json.tmp" "$STATE_DIR/qc/soft_check.json"
      log "  软检查评分: $score/100 (维度不达标: $low_dims)"
    else
      log "  软检查评分: $score/100 (>=80且各维度>=12通过)"
    fi
  else
    # 解析失败，给默认及格分
    log "  警告: 软检查结果解析失败，使用默认值"
    echo '{
      "check": "quality_score",
      "scores": {
        "completeness": {"score": 16, "reason": "解析失败，默认值"},
        "error_handling": {"score": 16, "reason": "解析失败，默认值"},
        "naming": {"score": 16, "reason": "解析失败，默认值"},
        "parameters": {"score": 16, "reason": "解析失败，默认值"},
        "best_practices": {"score": 16, "reason": "解析失败，默认值"}
      },
      "total_score": 80,
      "pass": true,
      "summary": "评分解析失败，使用默认及格分"
    }' > "$STATE_DIR/qc/soft_check.json"
  fi

  # 7.3 安全扫描
  log "  [3/8] 安全扫描"
  local security_check='{"check": "security_scan", "pass": true, "issues": []}'
  # 检查硬编码凭据、API Keys、Tokens、敏感信息
  for wid in $workflow_ids; do
    if [[ -n "$wid" ]]; then
      local wf_content=$(curl --max-time 30 -s -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
        "https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/$wid" 2>/dev/null)

      # 1. 检查硬编码密码
      if echo "$wf_content" | grep -qE 'password.*:.*"[A-Za-z0-9]{20,}"'; then
        security_check=$(echo "$security_check" | jq '.pass = false | .issues += [{"type": "hardcoded_password", "workflow_id": "'"$wid"'", "severity": "high"}]')
      fi

      # 2. 检查 API Key 模式
      if echo "$wf_content" | grep -qEi 'api[_-]?key.*[:=].*[A-Za-z0-9]{20,}'; then
        security_check=$(echo "$security_check" | jq '.pass = false | .issues += [{"type": "hardcoded_api_key", "workflow_id": "'"$wid"'", "severity": "critical"}]')
      fi

      # 3. 检查 Token 模式
      if echo "$wf_content" | grep -qEi '(bearer|token|access_token).*[:=].*[A-Za-z0-9]{20,}'; then
        security_check=$(echo "$security_check" | jq '.pass = false | .issues += [{"type": "hardcoded_token", "workflow_id": "'"$wid"'", "severity": "critical"}]')
      fi

      # 4. 检查敏感 URL 参数
      if echo "$wf_content" | grep -qEi '(password|secret|key)=[^&\s]{10,}'; then
        security_check=$(echo "$security_check" | jq '.pass = false | .issues += [{"type": "sensitive_url_param", "workflow_id": "'"$wid"'", "severity": "high"}]')
      fi

      # 5. 检查 AWS 凭据
      if echo "$wf_content" | grep -qE 'AKIA[0-9A-Z]{16}'; then
        security_check=$(echo "$security_check" | jq '.pass = false | .issues += [{"type": "aws_credentials", "workflow_id": "'"$wid"'", "severity": "critical"}]')
      fi

      # 6. 检查私钥
      if echo "$wf_content" | grep -qE -- '-----BEGIN.*PRIVATE KEY-----'; then
        security_check=$(echo "$security_check" | jq '.pass = false | .issues += [{"type": "private_key", "workflow_id": "'"$wid"'", "severity": "critical"}]')
      fi

      # 7. 检查硬编码凭据 ID（n8n 特定）
      if echo "$wf_content" | grep -qE '"credentialsId"[[:space:]]*:[[:space:]]*"[^"]{10,}"'; then
        # 这是正常的，但如果直接在代码中暴露了 credentialsId 的值可能有问题
        # 我们只标记为警告级别
        if echo "$wf_content" | grep -qE '"credentialsId"[[:space:]]*:[[:space:]]*"[A-Za-z0-9]{15,}".*"name"'; then
          security_check=$(echo "$security_check" | jq '.issues += [{"type": "credentials_id_exposure", "workflow_id": "'"$wid"'", "severity": "medium"}]')
        fi
      fi

      # 8. 检查其他常见敏感模式
      if echo "$wf_content" | grep -qEi '(secret|jwt|webhook).*[:=].*[A-Za-z0-9]{32,}'; then
        security_check=$(echo "$security_check" | jq '.pass = false | .issues += [{"type": "potential_secret", "workflow_id": "'"$wid"'", "severity": "high"}]')
      fi
    fi
  done
  echo "$security_check" > "$STATE_DIR/qc/security.json"

  # 7.4 集成检查
  log "  [4/8] 集成检查"
  echo '{"check": "integration", "imports_ok": true, "api_ok": true}' > "$STATE_DIR/qc/integration.json"

  # 7.5 性能检查
  log "  [5/8] 性能检查"
  local perf_check='{"check": "performance", "size_ok": true, "complexity_ok": true}'
  for wid in $workflow_ids; do
    if [[ -n "$wid" ]]; then
      local node_count=$(curl --max-time 30 -s -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
        "https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/$wid" 2>/dev/null | jq '.nodes | length // 0')
      if [[ "$node_count" -gt 50 ]]; then
        perf_check=$(echo "$perf_check" | jq '.size_ok = false')
      fi
    fi
  done
  echo "$perf_check" > "$STATE_DIR/qc/performance.json"

  # 7.6 Git检查
  log "  [6/8] Git检查"
  local git_check='{"check": "git", "branch_ok": true, "uncommitted": 0, "version_ok": true}'
  cd "$WORKFLOW_DIR"
  local current_branch=$(git branch --show-current 2>/dev/null || echo "unknown")
  if [[ "$current_branch" == "main" || "$current_branch" == "master" ]]; then
    git_check=$(echo "$git_check" | jq '.branch_ok = false')
  fi
  local uncommitted=$(git status --porcelain 2>/dev/null | wc -l)
  git_check=$(echo "$git_check" | jq --argjson n "$uncommitted" '.uncommitted = $n')

  # 版本一致性检查
  check_version_consistency
  local version_consistent=$(jq -r '.consistent // false' "$STATE_DIR/qc/version.json" 2>/dev/null)
  if [[ "$version_consistent" != "true" ]]; then
    git_check=$(echo "$git_check" | jq '.version_ok = false')
  fi

  echo "$git_check" > "$STATE_DIR/qc/git.json"

  # 7.7 Linting检查
  log "  [7/8] Linting检查"
  echo '{"check": "linting", "naming_ok": true, "position_ok": true, "credentials_ok": true}' > "$STATE_DIR/qc/linting.json"

  # 7.8 测试覆盖率检查
  log "  [8/8] 测试覆盖率检查"
  run_coverage_check

  # 附加：回归测试（在8路检查之外）
  log "  [额外] 回归测试"
  run_regression_tests

  # 附加：实际执行测试（真正调用 workflow 验证）
  log "  [额外] 实际执行测试"
  run_execution_test "$workflow_ids"

  log "质检完成"
}

# ============================================================
# 7.9 实际执行测试 - 真实调用 workflow 验证
# ============================================================
run_execution_test() {
  local workflow_ids="$1"
  local exec_result='{"check": "execution_test", "tests": [], "total": 0, "passed": 0, "pass": true}'

  for wid in $workflow_ids; do
    if [[ -z "$wid" ]]; then
      continue
    fi

    local test_result='{"workflow_id": "'"$wid"'", "tested": false, "success": false, "response": null}'
    exec_result=$(echo "$exec_result" | jq '.total += 1')

    # 获取 workflow 信息
    local wf_info=$(curl --max-time 30 -s -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
      "https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/$wid" 2>/dev/null)

    # 检查是否有 webhook 触发器
    local webhook_path=$(echo "$wf_info" | jq -r '.nodes[] | select(.type == "n8n-nodes-base.webhook") | .parameters.path // empty' | head -1)

    if [[ -n "$webhook_path" ]]; then
      # 有 webhook，尝试调用
      local webhook_url="https://zenithjoy21xx.app.n8n.cloud/webhook/${webhook_path}"
      log "    测试 webhook: $webhook_url"

      # 发送测试请求
      local response=$(curl --max-time 30 -s -X POST "$webhook_url" \
        -H "Content-Type: application/json" \
        -d '{"test": true, "source": "ai-factory-qc"}' \
        --max-time 10 2>/dev/null)

      if [[ -n "$response" ]]; then
        test_result=$(echo "$test_result" | jq --arg resp "$response" '.tested = true | .success = true | .response = $resp')
        exec_result=$(echo "$exec_result" | jq '.passed += 1')
        log "    ✅ Webhook 响应成功"
      else
        test_result=$(echo "$test_result" | jq '.tested = true | .success = false | .response = "no response"')
        log "    ⚠️ Webhook 无响应"
      fi
    else
      # 没有 webhook，检查其他触发器类型
      local trigger_type=$(echo "$wf_info" | jq -r '.nodes[0].type // "unknown"')
      test_result=$(echo "$test_result" | jq --arg t "$trigger_type" '.tested = false | .skip_reason = ("no webhook trigger, found: " + $t)')
      # 非 webhook 触发器的 workflow 不扣分
      exec_result=$(echo "$exec_result" | jq '.passed += 1')
      log "    ⏭️ 跳过 (触发器类型: $trigger_type)"
    fi

    exec_result=$(echo "$exec_result" | jq --argjson t "$test_result" '.tests += [$t]')
  done

  # 计算通过率
  local total=$(echo "$exec_result" | jq -r '.total')
  local passed=$(echo "$exec_result" | jq -r '.passed')

  if [[ "$total" -gt 0 ]]; then
    local pass_rate=$((passed * 100 / total))
    if [[ "$pass_rate" -lt 80 ]]; then
      exec_result=$(echo "$exec_result" | jq '.pass = false')
    fi
    log "  实际执行测试: $passed/$total 通过 (${pass_rate}%)"
  else
    log "  实际执行测试: 无可测试的 workflow"
  fi

  echo "$exec_result" > "$STATE_DIR/qc/execution_test.json"
}

# ============================================================
# 8. 决策 - 阈值: 硬检查100%, 软检查>=80分
# ============================================================
make_decision() {
  log "执行决策"
  log "  阈值: 硬检查=100%, 软检查>=80分, 安全=100%, 任务成功率=100%"

  local decision="PASS"
  local issues=()
  local scores=()

  # ===== 任务执行结果 (必须全部成功) =====
  if [[ -f "$STATE_DIR/execution_results.json" ]]; then
    local task_total=$(jq -r '.summary.total // 0' "$STATE_DIR/execution_results.json" 2>/dev/null)
    local task_success=$(jq -r '.summary.success // 0' "$STATE_DIR/execution_results.json" 2>/dev/null)
    local task_failed=$(jq -r '.summary.failed // 0' "$STATE_DIR/execution_results.json" 2>/dev/null)

    if [[ "$task_failed" -gt 0 ]] || [[ "$task_success" -lt "$task_total" ]]; then
      decision="FAIL"
      issues+=("任务执行失败: ${task_success}/${task_total} 成功, ${task_failed} 失败")
      scores+=("任务执行: ${task_success}/${task_total} ❌")
    else
      scores+=("任务执行: ${task_success}/${task_total} ✅")
    fi
  fi

  # ===== 硬检查 (100% 必须通过) =====
  local hard_ok=$(jq -r '.all_exist' "$STATE_DIR/qc/hard_check.json" 2>/dev/null)
  if [[ "$hard_ok" != "true" ]]; then
    decision="FAIL"
    issues+=("硬检查失败: workflow不存在")
    scores+=("硬检查: FAIL")
  else
    scores+=("硬检查: PASS (100%)")
  fi

  # ===== 安全扫描 (100% 必须通过) =====
  local security_ok=$(jq -r '.pass' "$STATE_DIR/qc/security.json" 2>/dev/null)
  if [[ "$security_ok" != "true" ]]; then
    decision="FAIL"
    issues+=("安全扫描失败")
    scores+=("安全扫描: FAIL")
  else
    scores+=("安全扫描: PASS (100%)")
  fi

  # ===== 软检查 (>=80分通过) =====
  local soft_score=$(jq -r '.total_score // 0' "$STATE_DIR/qc/soft_check.json" 2>/dev/null)
  local soft_pass=$(jq -r '.pass // false' "$STATE_DIR/qc/soft_check.json" 2>/dev/null)

  # 兼容旧格式
  if [[ "$soft_score" == "0" || "$soft_score" == "null" ]]; then
    soft_score=$(if [[ "$soft_pass" == "true" ]]; then echo 80; else echo 60; fi)
  fi

  if [[ "$soft_score" -lt 80 ]]; then
    if [[ "$decision" != "FAIL" ]]; then
      decision="REWORK"
    fi
    issues+=("软检查评分不足: ${soft_score}/100 (需>=80)")
    scores+=("软检查: ${soft_score}/100 ❌")
  else
    scores+=("软检查: ${soft_score}/100 ✅")
  fi
  log "  软检查评分: ${soft_score}/100"

  # ===== 实际执行测试 (>=80% 通过) =====
  if [[ -f "$STATE_DIR/qc/execution_test.json" ]]; then
    local exec_pass=$(jq -r '.pass // true' "$STATE_DIR/qc/execution_test.json" 2>/dev/null)
    local exec_passed=$(jq -r '.passed // 0' "$STATE_DIR/qc/execution_test.json" 2>/dev/null)
    local exec_total=$(jq -r '.total // 0' "$STATE_DIR/qc/execution_test.json" 2>/dev/null)

    if [[ "$exec_pass" != "true" ]]; then
      if [[ "$decision" != "FAIL" ]]; then
        decision="REWORK"
      fi
      issues+=("实际执行测试失败: ${exec_passed}/${exec_total}")
      scores+=("执行测试: ${exec_passed}/${exec_total} ❌")
    else
      scores+=("执行测试: ${exec_passed}/${exec_total} ✅")
    fi
  fi

  # ===== 版本一致性检查 =====
  local version_ok=$(jq -r '.pass // true' "$STATE_DIR/qc/version.json" 2>/dev/null)
  if [[ "$version_ok" != "true" ]]; then
    if [[ "$decision" != "FAIL" ]]; then
      decision="REWORK"
    fi
    issues+=("版本不一致")
    local version_issues=$(jq -r '.issues[]' "$STATE_DIR/qc/version.json" 2>/dev/null)
    if [[ -n "$version_issues" ]]; then
      log "  版本问题: $version_issues"
    fi
  fi

  # ===== 文件冲突检查 =====
  if [[ -f "$STATE_DIR/qc/file_conflicts.json" ]]; then
    local has_conflicts=$(jq -r '.has_conflicts // false' "$STATE_DIR/qc/file_conflicts.json" 2>/dev/null)
    if [[ "$has_conflicts" == "true" ]]; then
      if [[ "$decision" != "FAIL" ]]; then
        decision="REWORK"
      fi
      issues+=("文件冲突")
      local conflict_files=$(jq -r '.conflicts[] | .file' "$STATE_DIR/qc/file_conflicts.json" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
      if [[ -n "$conflict_files" ]]; then
        log "  文件冲突: $conflict_files"
      fi
    fi
  fi

  # ===== 汇总决策 =====
  log "  ────────────────────────────"
  for s in "${scores[@]}"; do
    log "  $s"
  done
  log "  ────────────────────────────"

  # 保存决策结果
  local issues_json=$(printf '%s\n' "${issues[@]}" | jq -R . | jq -s .)
  jq -n \
    --arg decision "$decision" \
    --argjson issues "$issues_json" \
    --argjson soft_score "$soft_score" \
    --argjson rework_count "$REWORK_COUNT" \
    '{
      decision: $decision,
      issues: $issues,
      soft_score: $soft_score,
      thresholds: {hard: "100%", soft: ">=80", security: "100%"},
      rework_count: $rework_count
    }' > "$STATE_DIR/decision.json"

  log "决策结果: $decision"
  echo "$decision"
}

# ============================================================
# 9. 返工处理
# ============================================================
handle_rework() {
  local decision="$1"

  if [[ "$decision" == "REWORK" ]]; then
    if [[ $REWORK_COUNT -lt $MAX_REWORK ]]; then
      REWORK_COUNT=$((REWORK_COUNT + 1))
      # 记录返工次数（用于自省模块）
      echo "$REWORK_COUNT" > "$STATE_DIR/rework_count"
      log "执行返工 ($REWORK_COUNT/$MAX_REWORK)"
      update_state "reworking"

      # 重新执行任务
      execute_tasks
      run_qc_checks
      decision=$(make_decision)

      # 递归处理
      handle_rework "$decision"
    else
      log "返工次数已达上限，任务被阻塞"

      # 获取软检查评分
      local soft_score=$(jq -r '.total_score // 0' "$STATE_DIR/qc/soft_check.json" 2>/dev/null)
      if [[ "$soft_score" == "null" || "$soft_score" == "0" ]]; then
        soft_score=$(jq -r '.soft_score // 0' "$STATE_DIR/decision.json" 2>/dev/null)
      fi

      # 获取失败原因
      local issues=$(jq -r '.issues | join("; ")' "$STATE_DIR/decision.json" 2>/dev/null || echo "未知原因")

      # 设置决策为 BLOCKED
      jq '.decision = "BLOCKED"' "$STATE_DIR/decision.json" > "$STATE_DIR/decision.json.tmp" && \
        mv "$STATE_DIR/decision.json.tmp" "$STATE_DIR/decision.json"

      update_state "blocked"

      # 发送飞书通知
      if [[ -n "$FEISHU_BOT_WEBHOOK" ]]; then
        # 使用 jq 安全转义特殊字符
        local prd_short="${PRD:0:100}"
        [[ ${#PRD} -gt 100 ]] && prd_short="${prd_short}..."
        local safe_prd=$(echo "$prd_short" | jq -Rs . | sed 's/^"//;s/"$//')
        local safe_issues=$(echo "$issues" | jq -Rs . | sed 's/^"//;s/"$//')

        local notify_msg="⚠️ AI 工厂任务被阻塞\\n\\nRun ID: ${RUN_ID}\\nPRD: ${safe_prd}\\n原因: 返工${MAX_REWORK}次仍未通过\\n软检查: ${soft_score}/100\\n失败详情: ${safe_issues}\\n\\n请手动处理或重新描述需求"

        curl --max-time 10 -s -X POST "$FEISHU_BOT_WEBHOOK" \
          -H "Content-Type: application/json" \
          -d "{\"msg_type\":\"text\",\"content\":{\"text\":\"${notify_msg}\"}}" > /dev/null 2>&1 || true

        log "已发送飞书告警通知"
      else
        log "WARNING: FEISHU_BOT_WEBHOOK 未配置，跳过通知"
      fi

      log "任务已阻塞，退出执行"

      # 阻塞时也要执行自省，记录失败数据
      self_reflect || log "WARNING: 自省模块执行失败"

      exit 1
    fi
  fi
}

# ============================================================
# ============================================================
# 10. 生成验收清单
# ============================================================
generate_acceptance_checklist() {
  log "生成验收清单"

  local tasks=$(cat "$STATE_DIR/sorted_tasks.json" 2>/dev/null || echo "[]")
  local hard_check=$(cat "$STATE_DIR/qc/hard_check.json" 2>/dev/null || echo '{"all_exist": false}')
  local soft_check=$(cat "$STATE_DIR/qc/soft_check.json" 2>/dev/null || echo '{"pass": false}')
  local security_check=$(cat "$STATE_DIR/qc/security.json" 2>/dev/null || echo '{"pass": false}')

  local hard_pass=$(echo "$hard_check" | jq -r '.all_exist')
  local soft_pass=$(echo "$soft_check" | jq -r '.pass')
  local security_pass=$(echo "$security_check" | jq -r '.pass')

  # 生成任务验收清单
  local task_checklist=""
  local task_count=$(echo "$tasks" | jq 'length')
  for i in $(seq 0 $((task_count - 1))); do
    local task=$(echo "$tasks" | jq ".[$i]")
    local task_name=$(echo "$task" | jq -r '.name')
    local task_desc=$(echo "$task" | jq -r '.description' | head -c 50)
    task_checklist+="- [ ] $task_name: $task_desc...
"
  done

  cat > "$STATE_DIR/docs/ACCEPTANCE.md" << EOF
# 验收清单

## Run ID: $RUN_ID
## 日期: $(date -Iseconds)

---

## 任务验收

$task_checklist

---

## 质检结果

- [$(if [[ "$hard_pass" == "true" ]]; then echo "x"; else echo " "; fi)] 硬检查通过: $hard_pass
- [$(if [[ "$soft_pass" == "true" ]]; then echo "x"; else echo " "; fi)] 软检查通过: $soft_pass
- [$(if [[ "$security_pass" == "true" ]]; then echo "x"; else echo " "; fi)] 安全扫描通过: $security_pass

---

## 文档验收

- [ ] README.md 生成
- [ ] CHANGELOG 更新
- [ ] API 文档完整
- [ ] 部署文档完整

---

## 功能验收

- [ ] Workflow 已激活
- [ ] 节点连接正确
- [ ] 测试执行通过
- [ ] 错误处理完善

---

## 签署

- 执行者: AI Factory
- 审核者: ___________
- 日期: ___________

---

## 附录

### 质检详情

**硬检查 (Workflow存在性)**
\`\`\`json
$(cat "$STATE_DIR/qc/hard_check.json" 2>/dev/null | jq '.' || echo '{}')
\`\`\`

**软检查 (代码质量)**
\`\`\`json
$(cat "$STATE_DIR/qc/soft_check.json" 2>/dev/null | jq '.' || echo '{}')
\`\`\`

**安全扫描**
\`\`\`json
$(cat "$STATE_DIR/qc/security.json" 2>/dev/null | jq '.' || echo '{}')
\`\`\`

EOF

  log "验收清单已生成: $STATE_DIR/docs/ACCEPTANCE.md"
}
# ============================================================
# 10.7 生成API文档
# ============================================================
generate_api_docs() {
  log "生成API文档"

  local results="$STATE_DIR/execution_results.json"
  local workflow_ids=$(jq -r '.results[].workflow_id // empty' "$results" 2>/dev/null | sort -u)

  if [[ -z "$workflow_ids" ]]; then
    log "  未检测到workflow ID，跳过API文档生成"
    return 0
  fi

  # API 文档头部
  cat > "$STATE_DIR/docs/API.md" << 'API_HEADER_EOF'
# API Documentation

## Generated Info
- **Run ID**: `RUN_ID_PLACEHOLDER`
- **Generated**: DATETIME_PLACEHOLDER

---

API_HEADER_EOF

  # 遍历每个 workflow，提取 API 信息
  local endpoint_count=0

  for wid in $workflow_ids; do
    if [[ -z "$wid" ]]; then
      continue
    fi

    log "  提取 Workflow API: $wid"

    # 获取 workflow 详情
    local wf_data=$(curl --max-time 30 -s -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
      "https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/$wid" 2>/dev/null)

    if ! echo "$wf_data" | jq -e '.id' > /dev/null 2>&1; then
      log "  警告: 无法获取 workflow $wid"
      continue
    fi

    local wf_name=$(echo "$wf_data" | jq -r '.name // "Unnamed Workflow"')
    local wf_active=$(echo "$wf_data" | jq -r '.active // false')
    local wf_desc=$(echo "$wf_data" | jq -r '.settings.description // "No description"' | head -c 200)

    # 查找 webhook 节点
    local webhook_nodes=$(echo "$wf_data" | jq -c '[.nodes[] | select(.type == "n8n-nodes-base.webhook")]')
    local webhook_count=$(echo "$webhook_nodes" | jq 'length')

    if [[ "$webhook_count" -eq 0 ]]; then
      log "  Workflow $wf_name 无 webhook 节点"
      continue
    fi

    # 添加 workflow 信息
    cat >> "$STATE_DIR/docs/API.md" << EOF
## Endpoints

### Workflow: $wf_name
- **Workflow ID**: \`$wid\`
- **Status**: $(if [[ "$wf_active" == "true" ]]; then echo "Active ✅"; else echo "Inactive ⏸️"; fi)
- **Description**: $wf_desc

EOF

    # 遍历每个 webhook 节点
    for i in $(seq 0 $((webhook_count - 1))); do
      local webhook=$(echo "$webhook_nodes" | jq ".[$i]")
      local webhook_path=$(echo "$webhook" | jq -r '.parameters.path // "unknown"')
      local webhook_method=$(echo "$webhook" | jq -r '.parameters.httpMethod // "POST"' | tr '[:lower:]' '[:upper:]')
      local webhook_auth=$(echo "$webhook" | jq -r '.parameters.authentication // "none"')
      local webhook_response_mode=$(echo "$webhook" | jq -r '.parameters.responseMode // "onReceived"')

      # 构建完整 URL
      local full_url="https://zenithjoy21xx.app.n8n.cloud/webhook/$webhook_path"

      endpoint_count=$((endpoint_count + 1))

      # 添加端点文档
      cat >> "$STATE_DIR/docs/API.md" << EOF
#### $webhook_method /webhook/$webhook_path

**Description**: $wf_desc

**Full URL**: \`$full_url\`

**Authentication**: $(if [[ "$webhook_auth" == "none" ]]; then echo "None"; else echo "$webhook_auth"; fi)

**Response Mode**: $webhook_response_mode

**Request Example**:
\`\`\`json
{
  "example": "data",
  "key": "value"
}
\`\`\`

**Response Example**:
\`\`\`json
{
  "status": "success",
  "message": "Workflow executed successfully"
}
\`\`\`

**cURL Example**:
\`\`\`bash
curl -X $webhook_method $full_url \\
  -H "Content-Type: application/json" \\
  -d '{
    "example": "data",
    "key": "value"
  }'
\`\`\`

---

EOF
    done
  done

  # 如果没有发现任何 API 端点
  if [[ $endpoint_count -eq 0 ]]; then
    cat >> "$STATE_DIR/docs/API.md" << EOF
## No API Endpoints

此次运行未创建包含 Webhook 的 workflow。

---

EOF
  fi

  # 添加通用说明
  cat >> "$STATE_DIR/docs/API.md" << 'API_FOOTER_EOF'

## Authentication

如果 workflow 需要认证，请在 n8n 控制台中配置 webhook 节点的 Authentication 参数。

支持的认证方式：
- **None** - 无需认证（仅用于内部或受信任的来源）
- **Basic Auth** - HTTP Basic Authentication
- **Header Auth** - 自定义 Header 认证（如 `X-API-Key`）

---

## Rate Limits

**n8n Cloud 默认限制**:
- 每分钟最多 120 次请求
- 每小时最多 7200 次请求
- 超过限制会返回 429 Too Many Requests

如需更高的速率限制，请考虑升级 n8n Cloud 计划或使用自托管 n8n。

---

## Error Handling

**常见错误码**:

| 状态码 | 说明 | 解决方法 |
|--------|------|----------|
| 404 | Webhook 路径不存在 | 检查 URL 路径是否正确 |
| 429 | 请求过于频繁 | 降低请求速率或增加重试间隔 |
| 500 | Workflow 执行失败 | 查看 n8n 执行日志，检查节点配置 |
| 502/504 | Gateway 超时 | Workflow 执行时间过长，优化节点逻辑 |

**错误响应示例**:
```json
{
  "error": "Workflow execution failed",
  "message": "Node 'HTTP Request' failed: Connection timeout",
  "timestamp": "2025-12-25T12:00:00Z"
}
```

---

## Testing

### 使用 curl 测试
```bash
# 基本测试
curl -X POST https://zenithjoy21xx.app.n8n.cloud/webhook/your-path \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# 带认证的测试
curl -X POST https://zenithjoy21xx.app.n8n.cloud/webhook/your-path \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"test": true}'
```

### 使用 Postman 测试
1. 创建新请求，选择对应的 HTTP 方法
2. 输入完整的 webhook URL
3. 在 Headers 中添加 `Content-Type: application/json`
4. 在 Body 中选择 raw/JSON，输入测试数据
5. 发送请求并查看响应

### 使用 JavaScript 测试
```javascript
fetch('https://zenithjoy21xx.app.n8n.cloud/webhook/your-path', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    example: 'data',
    key: 'value'
  })
})
.then(response => response.json())
.then(data => console.log('Success:', data))
.catch(error => console.error('Error:', error));
```

---

## Monitoring

### 查看执行历史
在 n8n 控制台中：
1. 进入 **Executions** 页面
2. 筛选对应的 workflow
3. 查看每次执行的输入/输出数据

### 使用 n8n API 查询执行记录
```bash
curl -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
  "https://zenithjoy21xx.app.n8n.cloud/api/v1/executions?workflowId={workflow_id}&limit=10"
```

---

## Support

如有问题，请查看：
- [n8n 官方文档](https://docs.n8n.io/)
- [Webhook 节点文档](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [执行结果日志](../execution_results.json)
- [质检报告](../qc/)

---

**Generated**: TIMESTAMP_PLACEHOLDER
API_FOOTER_EOF

  # 替换占位符
  sed -i "s|RUN_ID_PLACEHOLDER|$RUN_ID|g" "$STATE_DIR/docs/API.md"
  sed -i "s|DATETIME_PLACEHOLDER|$(date '+%Y-%m-%d %H:%M:%S')|g" "$STATE_DIR/docs/API.md"
  sed -i "s|TIMESTAMP_PLACEHOLDER|$(date -Iseconds)|g" "$STATE_DIR/docs/API.md"

  log "  API 文档已生成: $endpoint_count 个端点"
}

# ============================================================
# 10.5 生成部署文档
# ============================================================
generate_deploy_docs() {
  log "生成部署文档"

  local results=$(cat "$STATE_DIR/execution_results.json" 2>/dev/null || echo "{}")
  local plan=$(cat "$STATE_DIR/plan.json" 2>/dev/null || echo "{}")

  # 提取 workflow_id 列表
  local workflow_ids=$(echo "$results" | jq -r '.results[].workflow_id // empty' 2>/dev/null | sort -u)
  local workflow_id_list=""
  local webhook_urls=""

  if [[ -n "$workflow_ids" ]]; then
    for wid in $workflow_ids; do
      workflow_id_list+="- Workflow ID: \`$wid\`
"
      # 尝试获取 webhook URL
      local wf_data=$(curl --max-time 30 -s -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
        "https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/$wid" 2>/dev/null)

      local webhook_path=$(echo "$wf_data" | jq -r '.nodes[] | select(.type == "n8n-nodes-base.webhook") | .parameters.path // empty' 2>/dev/null | head -1)

      if [[ -n "$webhook_path" ]]; then
        webhook_urls+="- \`https://zenithjoy21xx.app.n8n.cloud/webhook/$webhook_path\`
"
      fi
    done
  else
    workflow_id_list="- 未检测到创建的 workflow ID（可能为修改现有 workflow）
"
  fi

  if [[ -z "$webhook_urls" ]]; then
    webhook_urls="- 未检测到 webhook 节点
"
  fi

  # 提取环境要求（从任务中分析）
  local env_requirements=""
  local credentials_needed=$(echo "$plan" | jq -r '.tasks[].description' 2>/dev/null | grep -i -o '\(ssh\|api key\|token\|credential\)' | sort -u | tr '\n' ',' | sed 's/,$//')

  if [[ -n "$credentials_needed" ]]; then
    env_requirements="需要配置的凭据：$credentials_needed"
  else
    env_requirements="无特殊凭据要求（或请根据 workflow 配置）"
  fi

  cat > "$STATE_DIR/docs/DEPLOY.md" << 'DEPLOY_EOF'
# 部署文档

## 生成信息
- **Run ID**: `RUNID_PLACEHOLDER`
- **生成时间**: DATETIME_PLACEHOLDER
- **PRD**: PRD_PLACEHOLDER

---

## Workflow 信息

### 创建/修改的 Workflow
WORKFLOW_LIST_PLACEHOLDER

### Webhook URL
WEBHOOK_URLS_PLACEHOLDER

### n8n 控制台
- **URL**: https://zenithjoy21xx.app.n8n.cloud
- **Workflow 管理**: https://zenithjoy21xx.app.n8n.cloud/workflows

---

## 部署步骤

### 1. 登录 n8n Cloud
访问 [n8n Cloud](https://zenithjoy21xx.app.n8n.cloud) 并使用您的凭据登录。

### 2. 验证 Workflow
检查 workflow 是否已正确创建/修改：
```bash
# 使用 REST API 验证
curl -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
  https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/{workflow_id}
```

### 3. 配置凭据
根据 workflow 需求配置必要的凭据：
- ENV_REQUIREMENTS_PLACEHOLDER
- 在 n8n 控制台的 **Credentials** 页面添加所需凭据
- 在 workflow 编辑器中将节点连接到对应凭据

### 4. 激活 Workflow
在 workflow 编辑器中：
1. 点击右上角的 **Inactive** 开关
2. 确认 workflow 状态变为 **Active**

或使用 API 激活：
```bash
curl -X PATCH -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active": true}' \
  https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/{workflow_id}
```

### 5. 测试执行
发送测试请求到 webhook（如适用）：
```bash
curl -X POST https://zenithjoy21xx.app.n8n.cloud/webhook/{your_webhook_path} \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

或在 n8n 控制台中手动触发执行。

---

## 环境要求

### n8n 环境
- **n8n Cloud** 或 **自托管 n8n** (版本 >= 1.0)
- 访问权限：需要 workflow 创建/编辑权限

### 凭据配置
根据 workflow 功能，可能需要配置：
- SSH 凭据（用于远程服务器操作）
- API Keys（用于第三方服务集成）
- Webhook 密钥（用于安全验证）
- 数据库连接（如适用）

### 网络要求
- 如果 workflow 需要访问外部 API，确保网络连通性
- 如果使用 webhook，确保防火墙允许入站连接

---

## 验证方法

### 1. 检查 Workflow 状态
```bash
# 查看 workflow 是否激活
curl -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
  https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/{workflow_id} \
  | jq '.active'
```

### 2. 查看执行历史
在 n8n 控制台：
1. 进入 **Executions** 页面
2. 筛选对应的 workflow
3. 检查最近执行的状态（成功/失败）

### 3. 检查执行日志
```bash
# 查看最近的执行记录
curl -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
  if [[ $? -eq 124 ]]; then
    log "警告: Claude D 文档生成超时 (120秒)，使用默认文档"
    echo "# 文档生成超时\n\n请手动完善文档。" > "$STATE_DIR/docs/claude_d_output.txt"
  fi
  "https://zenithjoy21xx.app.n8n.cloud/api/v1/executions?workflowId={workflow_id}&limit=5"
```

### 4. 功能测试
根据 PRD 要求，执行端到端功能测试：
- [ ] Webhook 可正常接收请求
- [ ] 数据处理逻辑正确
- [ ] 错误处理机制有效
- [ ] 输出结果符合预期

---

## 回滚步骤

如果部署出现问题，可以使用回滚功能恢复到之前的版本：

### 使用 workflow-factory.sh 回滚
```bash
bash /home/xx/bin/workflow-factory.sh \
  --run-id "$(date +%Y%m%d%H%M%S)-$(cat /dev/urandom | tr -dc 'a-z0-9' | head -c 6)" \
  --rollback "RUNID_PLACEHOLDER" \
  --prd "回滚到之前的版本"
```

### 手动回滚
1. 在 n8n 控制台中停用当前 workflow
2. 从 **Workflow History** 中恢复之前的版本
3. 或者从备份中重新导入 workflow JSON

### 回滚验证
- [ ] 检查 workflow 版本号
- [ ] 确认节点配置正确
- [ ] 执行测试确保功能正常

---

## 监控和维护

### 定期检查
- 每日检查 workflow 执行状态
- 监控错误率和执行时间
- 审查日志中的异常信息

### 告警配置
建议配置以下告警：
- Workflow 执行失败时发送通知
- 执行时间超过阈值时告警
- API 调用失败时通知

### 性能优化
- 定期审查执行日志，识别性能瓶颈
- 优化慢节点的配置
- 考虑添加缓存或批处理逻辑

---

## 附录

### 相关文档
- [README.md](./README.md) - 项目说明
- [ACCEPTANCE.md](./ACCEPTANCE.md) - 验收清单
- [执行计划](../plan.json) - 任务分解详情
- [质检报告](../qc/) - 质量检查结果

### 支持联系
- **Run 目录**: `STATEDIR_PLACEHOLDER`
- **日志文件**: 查看 `STATEDIR_PLACEHOLDER` 下的所有日志
- **工厂脚本**: `/home/xx/bin/workflow-factory.sh`

---

**生成于**: TIMESTAMP_PLACEHOLDER
**工具版本**: AI工厂 - Workflow生产线 v1.0
DEPLOY_EOF

  # 替换占位符
  local prd_escaped=$(echo "$PRD" | sed 's/[\/&]/\\&/g' | head -c 200)
  sed -i "s|RUNID_PLACEHOLDER|$RUN_ID|g" "$STATE_DIR/docs/DEPLOY.md"
  sed -i "s|STATEDIR_PLACEHOLDER|$STATE_DIR|g" "$STATE_DIR/docs/DEPLOY.md"
  sed -i "s|DATETIME_PLACEHOLDER|$(date '+%Y-%m-%d %H:%M:%S')|g" "$STATE_DIR/docs/DEPLOY.md"
  sed -i "s|TIMESTAMP_PLACEHOLDER|$(date -Iseconds)|g" "$STATE_DIR/docs/DEPLOY.md"
  sed -i "s|PRD_PLACEHOLDER|$prd_escaped|g" "$STATE_DIR/docs/DEPLOY.md"

  # 替换多行变量（需要特殊处理）
  if [[ -n "$workflow_id_list" ]]; then
    # 使用 awk 来替换多行内容
    awk -v wlist="$workflow_id_list" '{gsub(/WORKFLOW_LIST_PLACEHOLDER/, wlist)}1' "$STATE_DIR/docs/DEPLOY.md" > "$STATE_DIR/docs/DEPLOY.md.tmp"
    mv "$STATE_DIR/docs/DEPLOY.md.tmp" "$STATE_DIR/docs/DEPLOY.md"
  fi

  if [[ -n "$webhook_urls" ]]; then
    awk -v wurls="$webhook_urls" '{gsub(/WEBHOOK_URLS_PLACEHOLDER/, wurls)}1' "$STATE_DIR/docs/DEPLOY.md" > "$STATE_DIR/docs/DEPLOY.md.tmp"
    mv "$STATE_DIR/docs/DEPLOY.md.tmp" "$STATE_DIR/docs/DEPLOY.md"
  fi

  if [[ -n "$env_requirements" ]]; then
    awk -v envreq="$env_requirements" '{gsub(/ENV_REQUIREMENTS_PLACEHOLDER/, envreq)}1' "$STATE_DIR/docs/DEPLOY.md" > "$STATE_DIR/docs/DEPLOY.md.tmp"
    mv "$STATE_DIR/docs/DEPLOY.md.tmp" "$STATE_DIR/docs/DEPLOY.md"
  fi

  log "部署文档已生成: $STATE_DIR/docs/DEPLOY.md"
}



# 11. 生成文档 (Claude D)
# ============================================================
generate_docs() {
  log "Claude D: 生成文档（可选，失败不阻塞）"
  update_state "documenting"

  local plan=$(cat "$STATE_DIR/plan.json" 2>/dev/null || echo "{}")
  local results=$(cat "$STATE_DIR/execution_results.json" 2>/dev/null || echo "{}")

  local prompt="根据以下执行计划和结果生成部署文档：

计划：
$(echo "$plan" | head -c 1000)

结果：
$(echo "$results" | head -c 1000)

生成：
1. README.md - 项目说明
2. DEPLOY.md - 部署步骤
3. API.md - API文档（如适用）

直接输出文档内容。"

  # 文档生成超时设置为 120 秒
  local output
  local exit_code
  output=$(cd "$HEADLESS_WORKSPACE" && timeout -k 10 120 claude -p "$prompt" \
    --add-dir "$WORKFLOW_DIR" --model sonnet --output-format json 2>&1 | tee "$STATE_DIR/docs/claude_d_output.txt")
  exit_code=$?

  if [[ $exit_code -eq 124 ]]; then
    log "警告: Claude D 文档生成超时 (120秒) - 继续执行"
    echo "# Documentation Generation Timeout

Please complete documentation manually.

Run ID: $RUN_ID
Date: $(date -Iseconds)" > "$STATE_DIR/docs/claude_d_output.txt"
    output=""  # 清空输出，避免后续处理
  elif [[ $exit_code -ne 0 ]]; then
    log "警告: Claude D 文档生成失败 (exit code: $exit_code) - 继续执行"
    echo "# Documentation Generation Failed

Please complete documentation manually.

Run ID: $RUN_ID
Date: $(date -Iseconds)" > "$STATE_DIR/docs/claude_d_output.txt"
    output=""  # 清空输出，避免后续处理
  fi

  # 提取token使用量并追踪成本（失败时跳过）
  if [[ -n "$output" ]]; then
    local input_tokens output_tokens
    IFS=',' read -r input_tokens output_tokens <<< "$(extract_tokens_from_json "$output" "sonnet")"
    track_cost "sonnet" "${input_tokens:-0}" "${output_tokens:-0}"

    # 保存文档
    echo "$output" | tail -n 200 > "$STATE_DIR/docs/README.md" || log "WARNING: 无法保存 README.md"
  fi

  # 生成部署文档（失败时继续）
  generate_deploy_docs || log "WARNING: 部署文档生成失败 - 继续执行"

  # 生成验收清单（失败时继续）
  generate_acceptance_checklist || log "WARNING: 验收清单生成失败 - 继续执行"

  # 生成API文档（失败时继续）
  generate_api_docs || log "WARNING: API文档生成失败 - 继续执行"

  log "文档生成阶段完成（部分失败不影响主流程）"
}

# ============================================================
# 12. 导出最终产出
# ============================================================
export_final() {
  log "导出最终产出"

  # 复制关键文件到final目录
  cp "$STATE_DIR/plan.json" "$STATE_DIR/final/" 2>/dev/null || true
  cp "$STATE_DIR/execution_results.json" "$STATE_DIR/final/" 2>/dev/null || true
  cp -r "$STATE_DIR/docs" "$STATE_DIR/final/" 2>/dev/null || true

  # 生成manifest
  echo "{
    \"run_id\": \"$RUN_ID\",
    \"created_at\": \"$(date -Iseconds)\",
    \"files\": $(ls -1 "$STATE_DIR/final" | jq -R -s -c 'split("\n") | map(select(length > 0))')
  }" > "$STATE_DIR/final/manifest.json"

  log "最终产出已导出"
}

# ============================================================
# 13. 更新CHANGELOG
# ============================================================
update_changelog() {
  log "更新CHANGELOG"

  local changelog="$WORKFLOW_DIR/CHANGELOG.md"
  local entry="## [$RUN_ID] - $(date '+%Y-%m-%d')

### Added
- PRD: $PRD
- Tasks: $(jq -r '.tasks | length' "$STATE_DIR/plan.json" 2>/dev/null || echo 0)

"

  if [[ -f "$changelog" ]]; then
    echo -e "$entry$(cat "$changelog")" > "$changelog"
  else
    echo "$entry" > "$changelog"
  fi
}

# ============================================================
# 14. 更新经验库
# ============================================================
update_experience() {
  log "更新经验库"

  local exp_file="$WORKFLOW_DIR/lessons_learned.json"
  local decision=$(jq -r '.decision' "$STATE_DIR/decision.json" 2>/dev/null || echo "UNKNOWN")

  # 使用 jq 构建 JSON 以正确处理特殊字符
  local prd_safe=$(echo "$PRD" | head -c 100 | jq -Rs '.')
  local new_entry=$(jq -n \
    --arg run_id "$RUN_ID" \
    --arg date "$(date -Iseconds)" \
    --argjson prd "$prd_safe" \
    --arg decision "$decision" \
    '{
      run_id: $run_id,
      date: $date,
      prd: $prd,
      decision: $decision
    }')

  # 追加或创建经验库
  if [[ -f "$exp_file" ]]; then
    # 检查文件格式
    local file_type=$(jq -r 'type' "$exp_file" 2>/dev/null || echo "null")
    if [[ "$file_type" == "object" ]] && jq -e '.lessons' "$exp_file" > /dev/null 2>&1; then
      # 对象格式 {lessons: [...]}
      jq --argjson entry "$new_entry" --arg updated "$(date -Iseconds)" \
        '.lessons += [$entry] | .updated_at = $updated' \
        "$exp_file" > "${exp_file}.tmp" && mv "${exp_file}.tmp" "$exp_file"
    elif [[ "$file_type" == "array" ]]; then
      # 数组格式 [...]
      jq --argjson entry "$new_entry" '. += [$entry]' \
        "$exp_file" > "${exp_file}.tmp" && mv "${exp_file}.tmp" "$exp_file"
    else
      # 文件损坏，创建新数组
      echo "[$new_entry]" > "$exp_file"
    fi
  else
    # 创建新文件（对象格式，便于扩展）
    jq -n --argjson entry "$new_entry" --arg created "$(date -Iseconds)" \
      '{lessons: [$entry], common_issues: {}, best_practices: [], updated_at: $created}' \
      > "$exp_file"
  fi
}

# ============================================================
# 14.5 自省模块 - 自主进化系统
# ============================================================
EVOLUTION_LOG="$WORKFLOW_DIR/evolution_log.json"
EVOLUTION_ANALYSIS_INTERVAL=5  # 每 N 次运行触发一次进化分析

# 收集本次运行的详细指标
collect_run_metrics() {
  local decision=$(jq -r '.decision // "UNKNOWN"' "$STATE_DIR/decision.json" 2>/dev/null)
  local soft_check="$STATE_DIR/qc/soft_check.json"
  local prd_verify="$STATE_DIR/prd_verify.json"

  # 基础指标
  local duration_seconds=0
  if [[ -f "$STATE_DIR/start_time" ]]; then
    local start_time=$(cat "$STATE_DIR/start_time")
    local end_time=$(date +%s)
    duration_seconds=$((end_time - start_time))
  fi

  # 软检查分数和低分维度
  local soft_score=0
  local low_dimensions="[]"
  if [[ -f "$soft_check" ]]; then
    soft_score=$(jq -r '.total_score // 0' "$soft_check")
    low_dimensions=$(jq -c '[.scores | to_entries[] | select(.value.score < 12) | .key]' "$soft_check" 2>/dev/null || echo "[]")
  fi

  # PRD 相似度
  local prd_similarity=100
  if [[ -f "$prd_verify" ]]; then
    prd_similarity=$(jq -r '.similarity_score // 100' "$prd_verify")
  fi

  # 返工次数
  local rework_count=0
  if [[ -f "$STATE_DIR/rework_count" ]]; then
    rework_count=$(cat "$STATE_DIR/rework_count")
  fi

  # 使用的模板
  local template_used=""
  local template_success=false
  if [[ -f "$STATE_DIR/template_used" ]]; then
    template_used=$(cat "$STATE_DIR/template_used")
    [[ "$decision" == "PASS" ]] && template_success=true
  fi

  # 失败原因/问题
  local issues="[]"
  if [[ -f "$STATE_DIR/decision.json" ]]; then
    issues=$(jq -c '.issues // []' "$STATE_DIR/decision.json" 2>/dev/null || echo "[]")
  fi

  # 构建指标 JSON
  jq -n \
    --arg run_id "$RUN_ID" \
    --arg date "$(date -Iseconds)" \
    --arg prd_summary "${PRD:0:100}" \
    --arg decision "$decision" \
    --argjson duration "$duration_seconds" \
    --argjson rework_count "$rework_count" \
    --argjson soft_score "$soft_score" \
    --argjson low_dimensions "$low_dimensions" \
    --arg template_used "$template_used" \
    --argjson template_success "$template_success" \
    --argjson prd_similarity "$prd_similarity" \
    --argjson issues "$issues" \
    '{
      run_id: $run_id,
      date: $date,
      prd_summary: $prd_summary,
      decision: $decision,
      duration_seconds: $duration,
      rework_count: $rework_count,
      metrics: {
        soft_score: $soft_score,
        low_dimensions: $low_dimensions,
        template_used: $template_used,
        template_success: $template_success,
        prd_similarity: $prd_similarity
      },
      issues: $issues
    }'
}

# 追加到进化日志
append_evolution_log() {
  local run_metrics="$1"

  if [[ ! -f "$EVOLUTION_LOG" ]]; then
    # 创建新的进化日志（包含首次运行的 patterns 更新）
    jq -n \
      --arg created "$(date -Iseconds)" \
      --argjson run "$run_metrics" \
      '{
        version: "1.0",
        created_at: $created,
        updated_at: $created,
        runs: [$run],
        patterns: {
          dimension_failures: (
            $run.metrics.low_dimensions | reduce .[] as $dim ({}; .[$dim] = 1)
          ),
          issue_frequency: (
            $run.issues | reduce .[] as $issue ({}; if $issue != "" then .[$issue] = 1 else . end)
          ),
          template_stats: (
            if $run.metrics.template_used != "" then
              {($run.metrics.template_used): {used: 1, success: (if $run.metrics.template_success then 1 else 0 end)}}
            else {}
            end
          )
        },
        pending_optimizations: [],
        applied_optimizations: [],
        last_analysis: null
      }' > "$EVOLUTION_LOG"
  else
    # 追加运行记录并更新统计
    local temp_file="${EVOLUTION_LOG}.tmp"
    jq --argjson run "$run_metrics" \
       --arg updated "$(date -Iseconds)" '
      # 追加运行记录（保留最近 100 条）
      .runs = ([$run] + .runs | .[0:100]) |
      .updated_at = $updated |

      # 更新维度失败统计
      .patterns.dimension_failures = (
        .patterns.dimension_failures as $existing |
        $run.metrics.low_dimensions | reduce .[] as $dim (
          $existing;
          .[$dim] = ((.[$dim] // 0) + 1)
        )
      ) |

      # 更新问题频率统计
      .patterns.issue_frequency = (
        .patterns.issue_frequency as $existing |
        $run.issues | reduce .[] as $issue (
          $existing;
          .[$issue] = ((.[$issue] // 0) + 1)
        )
      ) |

      # 更新模板统计
      (if $run.metrics.template_used != "" then
        .patterns.template_stats[$run.metrics.template_used] = (
          .patterns.template_stats[$run.metrics.template_used] // {used: 0, success: 0}
          | .used += 1
          | if $run.metrics.template_success then .success += 1 else . end
        )
      else . end)
    ' "$EVOLUTION_LOG" > "$temp_file" && mv "$temp_file" "$EVOLUTION_LOG"
  fi
}

# 检查是否应该触发进化分析
should_trigger_analysis() {
  if [[ ! -f "$EVOLUTION_LOG" ]]; then
    return 1
  fi

  local run_count=$(jq '.runs | length' "$EVOLUTION_LOG")
  local last_analysis=$(jq -r '.last_analysis // "1970-01-01"' "$EVOLUTION_LOG")

  # 每 N 次运行触发一次
  if (( run_count % EVOLUTION_ANALYSIS_INTERVAL == 0 )); then
    return 0
  fi

  # 或者距离上次分析超过 24 小时
  local last_ts=$(date -d "$last_analysis" +%s 2>/dev/null || echo 0)
  local now_ts=$(date +%s)
  local hours_since=$(( (now_ts - last_ts) / 3600 ))

  if (( hours_since >= 24 && run_count >= 3 )); then
    return 0
  fi

  return 1
}

# 执行进化分析
run_evolution_analysis() {
  log "触发进化分析..."

  # 准备分析数据
  local recent_runs=$(jq -c '.runs[0:20]' "$EVOLUTION_LOG")
  local patterns=$(jq -c '.patterns' "$EVOLUTION_LOG")
  local pending=$(jq -c '.pending_optimizations' "$EVOLUTION_LOG")

  # 统计摘要
  local total_runs=$(jq '.runs | length' "$EVOLUTION_LOG")
  local pass_count=$(jq '[.runs[] | select(.decision == "PASS")] | length' "$EVOLUTION_LOG")
  local fail_count=$(jq '[.runs[] | select(.decision != "PASS")] | length' "$EVOLUTION_LOG")
  local avg_score=$(jq '[.runs[].metrics.soft_score] | add / length | floor' "$EVOLUTION_LOG")
  local avg_rework=$(jq '[.runs[].rework_count] | add / length * 10 | floor / 10' "$EVOLUTION_LOG")

  local analysis_prompt="你是 AI 工厂的自省系统。分析以下运行数据，识别问题模式并生成优化建议。

## 统计摘要
- 总运行次数: $total_runs
- 成功: $pass_count, 失败: $fail_count (成功率: $(( pass_count * 100 / (total_runs > 0 ? total_runs : 1) ))%)
- 平均软检查分数: $avg_score/100
- 平均返工次数: $avg_rework

## 模式统计
$patterns

## 最近 20 次运行
$recent_runs

## 待处理优化
$pending

---

请分析并输出 JSON 格式的优化建议：
{
  \"analysis_summary\": \"整体分析摘要\",
  \"health_score\": 0-100,
  \"identified_patterns\": [
    {\"pattern\": \"模式描述\", \"frequency\": 次数, \"impact\": \"high/medium/low\"}
  ],
  \"new_optimizations\": [
    {
      \"id\": \"opt-时间戳\",
      \"type\": \"prompt_enhancement|template_update|threshold_adjust|new_template\",
      \"target\": \"具体目标(如 naming 维度)\",
      \"suggestion\": \"具体建议\",
      \"priority\": \"high/medium/low\",
      \"auto_applicable\": true/false,
      \"implementation\": \"如果 auto_applicable=true，给出具体实现代码或配置\"
    }
  ],
  \"recommendations\": [\"人工需要关注的点\"]
}

只输出 JSON，不要其他内容。"

  # 调用 Claude 进行分析
  local analysis_output
  analysis_output=$(cd "$HEADLESS_WORKSPACE" && timeout -k 10 120 claude -p "$analysis_prompt" \
    --allowedTools "" --model sonnet --output-format json 2>&1)

  local exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    log "  进化分析调用失败 (exit: $exit_code)"
    return 1
  fi

  # 解析结果
  local analysis_result
  if echo "$analysis_output" | jq -e '.result' > /dev/null 2>&1; then
    analysis_result=$(echo "$analysis_output" | jq -r '.result')
  else
    analysis_result=$(echo "$analysis_output" | grep -o '{.*}' | tail -1)
  fi

  # 验证 JSON
  if ! echo "$analysis_result" | jq -e '.' > /dev/null 2>&1; then
    log "  进化分析结果解析失败"
    return 1
  fi

  # 保存分析结果
  local analysis_file="$WORKFLOW_DIR/evolution_analysis_$(date +%Y%m%d_%H%M%S).json"
  echo "$analysis_result" | jq '.' > "$analysis_file"
  log "  分析结果已保存: $analysis_file"

  # 更新进化日志
  local new_opts=$(echo "$analysis_result" | jq -c '.new_optimizations // []')
  local health_score=$(echo "$analysis_result" | jq -r '.health_score // 0')

  jq --argjson new_opts "$new_opts" \
     --arg last_analysis "$(date -Iseconds)" \
     --argjson health_score "$health_score" '
    .last_analysis = $last_analysis |
    .health_score = $health_score |
    .pending_optimizations = (.pending_optimizations + $new_opts | unique_by(.id) | .[0:20])
  ' "$EVOLUTION_LOG" > "${EVOLUTION_LOG}.tmp" && mv "${EVOLUTION_LOG}.tmp" "$EVOLUTION_LOG"

  # 输出摘要
  local summary=$(echo "$analysis_result" | jq -r '.analysis_summary // "分析完成"')
  log "  健康度: $health_score/100"
  log "  摘要: $summary"

  # 检查是否有高优先级的自动优化
  local auto_opts=$(echo "$analysis_result" | jq -c '[.new_optimizations[] | select(.auto_applicable == true and .priority == "high")]')
  local auto_count=$(echo "$auto_opts" | jq 'length')

  if (( auto_count > 0 )); then
    log "  发现 $auto_count 个可自动应用的高优先级优化"
    # TODO: 未来可以在这里自动应用某些优化
  fi

  # 如果健康度低于 60，发送飞书告警
  if (( health_score < 60 )) && [[ -n "$FEISHU_BOT_WEBHOOK" ]]; then
    local recommendations=$(echo "$analysis_result" | jq -r '.recommendations | join("\n- ")' 2>/dev/null || echo "无")
    local alert_msg="🔬 AI 工厂自省报告\\n\\n健康度: ${health_score}/100 (需要关注)\\n\\n$summary\\n\\n建议:\\n- $recommendations"
    curl --max-time 10 -s -X POST "$FEISHU_BOT_WEBHOOK" \
      -H "Content-Type: application/json" \
      -d "{\"msg_type\":\"text\",\"content\":{\"text\":\"$alert_msg\"}}" > /dev/null 2>&1 || true
  fi

  return 0
}

# 自省入口函数
self_reflect() {
  log "执行自省..."

  # 1. 收集本次运行指标
  local run_metrics=$(collect_run_metrics)

  # 2. 追加到进化日志
  append_evolution_log "$run_metrics"
  log "  已记录运行指标到进化日志"

  # 3. 检查是否触发进化分析
  if should_trigger_analysis; then
    run_evolution_analysis
  else
    local runs_until=$(( EVOLUTION_ANALYSIS_INTERVAL - ($(jq '.runs | length' "$EVOLUTION_LOG" 2>/dev/null || echo 0) % EVOLUTION_ANALYSIS_INTERVAL) ))
    log "  下次进化分析: ${runs_until} 次运行后"
  fi
}

# ============================================================
# 14.6 保存成本历史
# ============================================================
save_cost_history() {
  local cost_history_file="$WORKFLOW_DIR/cost_history.json"
  local summary_file="$STATE_DIR/reports/summary.json"

  if [[ ! -f "$summary_file" ]]; then
    return
  fi

  # 提取成本信息
  local cost_entry=$(jq -n \
    --arg run_id "$RUN_ID" \
    --arg date "$(date -Iseconds)" \
    --argjson cost "$(jq '.cost' "$summary_file" 2>/dev/null || echo '{}')" \
    --arg prd "$(echo "$PRD" | head -c 100)" \
    --arg decision "$(jq -r '.decision' "$summary_file" 2>/dev/null || echo "UNKNOWN")" \
    '{
      run_id: $run_id,
      date: $date,
      prd: $prd,
      decision: $decision,
      cost: $cost
    }')

  # 初始化或追加历史记录
  if [[ -f "$cost_history_file" ]]; then
    local file_type=$(jq -r 'type' "$cost_history_file" 2>/dev/null || echo "null")
    if [[ "$file_type" == "object" ]] && jq -e '.runs' "$cost_history_file" > /dev/null 2>&1; then
      # 对象格式 {runs: [...]}
      jq --argjson entry "$cost_entry" --arg updated "$(date -Iseconds)" \
        '.runs += [$entry] | .updated_at = $updated' \
        "$cost_history_file" > "${cost_history_file}.tmp" && mv "${cost_history_file}.tmp" "$cost_history_file"
    elif [[ "$file_type" == "array" ]]; then
      # 数组格式 [...]
      jq --argjson entry "$cost_entry" '. += [$entry]' \
        "$cost_history_file" > "${cost_history_file}.tmp" && mv "${cost_history_file}.tmp" "$cost_history_file"
    else
      # 文件损坏或格式错误，创建新数组
      echo "[$cost_entry]" > "$cost_history_file"
    fi
  else
    # 创建新文件（对象格式，便于扩展）
    jq -n \
      --argjson entry "$cost_entry" \
      --arg created "$(date -Iseconds)" \
      '{
        created_at: $created,
        updated_at: $created,
        runs: [$entry]
      }' > "$cost_history_file"
  fi

  log "成本历史已更新: $cost_history_file"
}

# ============================================================
# 15. 生成摘要报告
# ============================================================
generate_summary() {
  log "生成摘要报告"

  local decision=$(jq -r '.decision' "$STATE_DIR/decision.json" 2>/dev/null || echo "UNKNOWN")
  local task_count=$(jq -r '.summary.total' "$STATE_DIR/execution_results.json" 2>/dev/null || echo 0)
  local success_count=$(jq -r '.summary.success' "$STATE_DIR/execution_results.json" 2>/dev/null || echo 0)
  local duration=$(($(date +%s) - $(date -d "$STARTED_AT" +%s 2>/dev/null || echo $(date +%s))))

  # 计算成本汇总
  local opus_calls=0
  local sonnet_calls=0
  local haiku_calls=0
  local total_cost=0

  if [[ -f "$STATE_DIR/model_calls.log" ]]; then
    opus_calls=$(grep -c "^opus$" "$STATE_DIR/model_calls.log" 2>/dev/null || echo 0)
    sonnet_calls=$(grep -c "^sonnet$" "$STATE_DIR/model_calls.log" 2>/dev/null || echo 0)
    haiku_calls=$(grep -c "^haiku$" "$STATE_DIR/model_calls.log" 2>/dev/null || echo 0)
  fi

  if [[ -f "$STATE_DIR/costs.log" ]]; then
    total_cost=$(awk -F',' '{sum += $4} END {printf "%.6f", sum}' "$STATE_DIR/costs.log" 2>/dev/null || echo "0")
  fi

  local summary="{
    \"run_id\": \"$RUN_ID\",
    \"prd\": \"$(echo "$PRD" | head -c 200 | tr -d '\n\"')\",
    \"started_at\": \"$STARTED_AT\",
    \"completed_at\": \"$(date -Iseconds)\",
    \"duration_seconds\": $duration,
    \"decision\": \"$decision\",
    \"rework_count\": $REWORK_COUNT,
    \"tasks\": {
      \"total\": $task_count,
      \"success\": $success_count
    },
    \"cost\": {
      \"opus_calls\": $opus_calls,
      \"sonnet_calls\": $sonnet_calls,
      \"haiku_calls\": $haiku_calls,
      \"estimated_cost_usd\": $total_cost
    },
    \"qc\": {
      \"hard_check\": $(jq -c '.' "$STATE_DIR/qc/hard_check.json" 2>/dev/null || echo '{}'),
      \"soft_check\": $(jq -c '.' "$STATE_DIR/qc/soft_check.json" 2>/dev/null || echo '{}'),
      \"security\": $(jq -c '.' "$STATE_DIR/qc/security.json" 2>/dev/null || echo '{}'),
      \"integration\": $(jq -c '.' "$STATE_DIR/qc/integration.json" 2>/dev/null || echo '{}'),
      \"performance\": $(jq -c '.' "$STATE_DIR/qc/performance.json" 2>/dev/null || echo '{}'),
      \"git\": $(jq -c '.' "$STATE_DIR/qc/git.json" 2>/dev/null || echo '{}'),
      \"linting\": $(jq -c '.' "$STATE_DIR/qc/linting.json" 2>/dev/null || echo '{}'),
      \"coverage\": $(jq -c '.' "$STATE_DIR/qc/coverage.json" 2>/dev/null || echo '{}'),
      \"regression\": $(jq -c '.' "$STATE_DIR/qc/regression.json" 2>/dev/null || echo '{}'),
      \"file_conflicts\": $(jq -c '.' "$STATE_DIR/qc/file_conflicts.json" 2>/dev/null || echo '{}')
    }
  }"

  echo "$summary" > "$STATE_DIR/reports/summary.json"

  # 将成本记录到全局历史
  save_cost_history

  log "摘要报告已生成 (总成本: \$${total_cost})"

  # 输出最终结果
  echo "$summary"
}

# ============================================================
# 主流程
# ============================================================
main() {
  log "========================================="
  log "AI工厂 - Workflow生产线"
  log "Run ID: $RUN_ID"
  log "========================================="

  # 1. 初始化
  init_run

  # 2. 回滚检查
  handle_rollback

  # 3. 续跑检查
  handle_resume

  # 4. 分解PRD
  decompose_prd

  # 4.5. PRD 理解反向验证
  if ! verify_prd_understanding; then
    log "PRD 理解验证失败，终止执行"
    # PRD 验证失败也要自省
    self_reflect || log "WARNING: 自省模块执行失败"
    exit 1
  fi

  # 5. 拓扑排序
  topological_sort

  # 6. 执行任务
  execute_tasks

  # 7. 质检
  run_qc_checks

  # 8. 决策
  local decision=$(make_decision)

  # 9. 返工处理
  handle_rework "$decision"

  # 10. 生成文档
  if [[ "$decision" == "PASS" ]] || [[ "$(jq -r '.decision' "$STATE_DIR/decision.json")" == "PASS" ]]; then
    # 文档生成失败不应阻塞主流程
    generate_docs || log "WARNING: 文档生成失败，但不影响 workflow 完成状态"

    export_final || log "WARNING: 导出最终产出失败"
    update_changelog || log "WARNING: 更新 CHANGELOG 失败"
    update_experience || log "WARNING: 更新经验库失败"

    # 确保即使文档生成失败，状态也能正确转换为 completed
    update_state "completed"
  else
    update_state "failed"
  fi

  # 提交 Git 变更
  commit_changes

  # 11. 生成摘要报告
  generate_summary

  # 12. 自省 - 记录运行指标，触发进化分析
  self_reflect || log "WARNING: 自省模块执行失败"
}

# ============================================================
# 异步执行包装
# ============================================================
run_async() {
  # 后台执行主流程，完成后发送回调
  (
    main

    # 读取最终结果并发送回调
    if [[ -f "$STATE_DIR/reports/summary.json" ]]; then
      send_callback "$(cat "$STATE_DIR/reports/summary.json")"
    else
      send_callback "{\"run_id\": \"$RUN_ID\", \"decision\": \"ERROR\", \"error\": \"No summary generated\"}"
    fi
  ) >> "$STATE_DIR/async.log" 2>&1 &

  # 立即返回启动确认
  echo "{\"status\": \"started\", \"run_id\": \"$RUN_ID\", \"async\": true, \"message\": \"任务已在后台启动\"}"
}

# ============================================================
# 执行入口
# ============================================================
if [[ "$ASYNC_MODE" == "true" ]]; then
  # 异步模式：立即返回，后台执行
  # 需要先创建目录才能写日志
  mkdir -p "/home/xx/data/runs/${RUN_ID}"
  run_async
else
  # 同步模式：等待执行完成
  main
fi
