#!/bin/bash
#
# AI Factory v3.0 配置文件
#

# ============================================================
# 目录配置
# ============================================================

# 脚本所在目录（自动检测）
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# AI Factory 模块目录
AI_FACTORY_DIR="$(dirname "$SCRIPTS_DIR")"

# 主仓库目录
PROJECT_DIR="${PROJECT_DIR:-/home/xx/dev/zenithjoy-autopilot}"

# Worktree 根目录
WORKTREES_DIR="${WORKTREES_DIR:-/home/xx/worktrees}"

# 数据目录
DATA_DIR="${DATA_DIR:-/home/xx/data}"
RUNS_DIR="${RUNS_DIR:-$DATA_DIR/runs}"
LOGS_DIR="${LOGS_DIR:-$DATA_DIR/logs}"

# 工作流目录（包含 .secrets）
WORKFLOWS_DIR="${WORKFLOWS_DIR:-$PROJECT_DIR/workflows}"

# ============================================================
# Git 配置
# ============================================================

# 基础分支（用于创建 worktree）
GIT_BASE_BRANCH="${GIT_BASE_BRANCH:-master}"

# 任务分支前缀
GIT_BRANCH_PREFIX="${GIT_BRANCH_PREFIX:-task}"

# ============================================================
# 超时配置
# ============================================================

# Git 操作超时（秒）
GIT_TIMEOUT="${GIT_TIMEOUT:-60}"

# API 请求超时（秒）
API_TIMEOUT="${API_TIMEOUT:-30}"

# ============================================================
# 清理配置
# ============================================================

# 是否在成功后删除 worktree
CLEANUP_ON_SUCCESS="${CLEANUP_ON_SUCCESS:-true}"

# 失败时保留 worktree 用于调试
KEEP_ON_FAILURE="${KEEP_ON_FAILURE:-true}"

# ============================================================
# 执行配置
# ============================================================

# 最大并行任务数
MAX_PARALLEL_TASKS="${MAX_PARALLEL_TASKS:-5}"

# 任务执行超时（秒）
TASK_TIMEOUT="${TASK_TIMEOUT:-1800}"

# 重试次数
MAX_RETRIES="${MAX_RETRIES:-3}"

# 重试延迟（秒）
RETRY_DELAY="${RETRY_DELAY:-5}"

# 执行模式（parallel | sequential | batch）
EXECUTION_MODE="${EXECUTION_MODE:-parallel}"

# 批处理大小（batch 模式时使用）
BATCH_SIZE="${BATCH_SIZE:-10}"

# 批处理间隔（秒）
BATCH_INTERVAL="${BATCH_INTERVAL:-2}"

# 日志级别（DEBUG | INFO | WARN | ERROR）
LOG_LEVEL="${LOG_LEVEL:-INFO}"

# 日志格式（json | text | compact）
LOG_FORMAT="${LOG_FORMAT:-text}"

# 是否记录执行时间
TRACK_EXECUTION_TIME="${TRACK_EXECUTION_TIME:-true}"

# 任务优先级队列（high | normal | low）
TASK_PRIORITY="${TASK_PRIORITY:-normal}"

# 执行前检查（检查依赖、环境等）
PRE_EXEC_CHECK="${PRE_EXEC_CHECK:-true}"

# 执行后验证
POST_EXEC_VALIDATE="${POST_EXEC_VALIDATE:-true}"

# 失败时是否继续执行其他任务
CONTINUE_ON_ERROR="${CONTINUE_ON_ERROR:-false}"

# ============================================================
# 通知配置
# ============================================================

# 是否启用通知
ENABLE_NOTIFICATIONS="${ENABLE_NOTIFICATIONS:-false}"

# 通知方式（webhook | email | slack | discord | telegram | none）
NOTIFICATION_TYPE="${NOTIFICATION_TYPE:-webhook}"

# Webhook URL（如果使用 webhook 通知）
WEBHOOK_URL="${WEBHOOK_URL:-}"

# Slack Webhook URL
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Discord Webhook URL
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"

# Telegram Bot Token
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"

# Telegram Chat ID
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

# Email 配置
EMAIL_TO="${EMAIL_TO:-}"
EMAIL_FROM="${EMAIL_FROM:-noreply@zenithjoy.com}"
EMAIL_SUBJECT_PREFIX="${EMAIL_SUBJECT_PREFIX:-[AI Factory]}"

# 通知事件（success | failure | warning | info | all）
NOTIFY_ON="${NOTIFY_ON:-failure}"

# 通知级别阈值（只通知此级别及以上的事件）
NOTIFY_LEVEL="${NOTIFY_LEVEL:-ERROR}"

# 通知消息格式（simple | detailed | custom）
NOTIFY_FORMAT="${NOTIFY_FORMAT:-simple}"

# 通知重试次数
NOTIFY_RETRIES="${NOTIFY_RETRIES:-3}"

# 通知重试延迟（秒）
NOTIFY_RETRY_DELAY="${NOTIFY_RETRY_DELAY:-10}"

# 批量通知（将多个事件合并发送）
BATCH_NOTIFICATIONS="${BATCH_NOTIFICATIONS:-false}"

# 批量通知间隔（秒）
BATCH_NOTIFY_INTERVAL="${BATCH_NOTIFY_INTERVAL:-60}"

# 通知去重（避免相同消息重复发送）
NOTIFY_DEDUP="${NOTIFY_DEDUP:-true}"

# 通知去重时间窗口（秒）
NOTIFY_DEDUP_WINDOW="${NOTIFY_DEDUP_WINDOW:-300}"

# 静默模式（减少输出）
SILENT_MODE="${SILENT_MODE:-false}"

# 通知附带日志（是否在通知中包含执行日志）
INCLUDE_LOGS="${INCLUDE_LOGS:-false}"

# 通知附带日志行数限制
MAX_LOG_LINES="${MAX_LOG_LINES:-50}"

# ============================================================
# 资源限制配置
# ============================================================

# 最大内存使用（MB）
MAX_MEMORY_MB="${MAX_MEMORY_MB:-2048}"

# 内存警告阈值（MB）
MEMORY_WARN_MB="${MEMORY_WARN_MB:-1536}"

# 内存检查间隔（秒）
MEMORY_CHECK_INTERVAL="${MEMORY_CHECK_INTERVAL:-30}"

# 最大 CPU 使用率（百分比）
MAX_CPU_PERCENT="${MAX_CPU_PERCENT:-80}"

# CPU 警告阈值（百分比）
CPU_WARN_PERCENT="${CPU_WARN_PERCENT:-60}"

# CPU 检查间隔（秒）
CPU_CHECK_INTERVAL="${CPU_CHECK_INTERVAL:-10}"

# 磁盘空间检查阈值（MB）
MIN_DISK_SPACE_MB="${MIN_DISK_SPACE_MB:-1024}"

# 磁盘空间警告阈值（MB）
DISK_WARN_MB="${DISK_WARN_MB:-2048}"

# 磁盘空间检查间隔（秒）
DISK_CHECK_INTERVAL="${DISK_CHECK_INTERVAL:-60}"

# 进程优先级（-20 到 19，默认 0）
PROCESS_PRIORITY="${PROCESS_PRIORITY:-0}"

# 最大打开文件数
MAX_OPEN_FILES="${MAX_OPEN_FILES:-1024}"

# 最大进程数
MAX_PROCESSES="${MAX_PROCESSES:-100}"

# 最大线程数
MAX_THREADS="${MAX_THREADS:-500}"

# 网络带宽限制（KB/s，0 表示不限制）
NETWORK_BANDWIDTH_LIMIT="${NETWORK_BANDWIDTH_LIMIT:-0}"

# IO 限制（MB/s，0 表示不限制）
IO_BANDWIDTH_LIMIT="${IO_BANDWIDTH_LIMIT:-0}"

# 临时文件清理（自动清理临时文件）
AUTO_CLEAN_TEMP="${AUTO_CLEAN_TEMP:-true}"

# 临时文件保留时间（小时）
TEMP_FILE_RETENTION_HOURS="${TEMP_FILE_RETENTION_HOURS:-24}"

# 日志文件最大大小（MB）
MAX_LOG_SIZE_MB="${MAX_LOG_SIZE_MB:-100}"

# 日志文件轮转数量
LOG_ROTATE_COUNT="${LOG_ROTATE_COUNT:-10}"

# 资源监控（是否启用资源监控）
ENABLE_RESOURCE_MONITOR="${ENABLE_RESOURCE_MONITOR:-true}"

# 资源监控报告间隔（秒）
RESOURCE_REPORT_INTERVAL="${RESOURCE_REPORT_INTERVAL:-300}"

# 资源超限处理（warn | throttle | kill）
RESOURCE_LIMIT_ACTION="${RESOURCE_LIMIT_ACTION:-throttle}"

# 资源恢复等待时间（秒）
RESOURCE_RECOVERY_WAIT="${RESOURCE_RECOVERY_WAIT:-60}"

# ============================================================
# 导出变量
# ============================================================

# 目录变量
export SCRIPTS_DIR AI_FACTORY_DIR PROJECT_DIR WORKTREES_DIR DATA_DIR RUNS_DIR LOGS_DIR WORKFLOWS_DIR

# Git 配置
export GIT_BASE_BRANCH GIT_BRANCH_PREFIX GIT_TIMEOUT API_TIMEOUT

# 清理配置
export CLEANUP_ON_SUCCESS KEEP_ON_FAILURE

# 执行配置
export MAX_PARALLEL_TASKS TASK_TIMEOUT MAX_RETRIES RETRY_DELAY EXECUTION_MODE
export BATCH_SIZE BATCH_INTERVAL LOG_LEVEL LOG_FORMAT TRACK_EXECUTION_TIME
export TASK_PRIORITY PRE_EXEC_CHECK POST_EXEC_VALIDATE CONTINUE_ON_ERROR

# 通知配置
export ENABLE_NOTIFICATIONS NOTIFICATION_TYPE WEBHOOK_URL SLACK_WEBHOOK_URL DISCORD_WEBHOOK_URL
export TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID EMAIL_TO EMAIL_FROM EMAIL_SUBJECT_PREFIX
export NOTIFY_ON NOTIFY_LEVEL NOTIFY_FORMAT NOTIFY_RETRIES NOTIFY_RETRY_DELAY
export BATCH_NOTIFICATIONS BATCH_NOTIFY_INTERVAL NOTIFY_DEDUP NOTIFY_DEDUP_WINDOW
export SILENT_MODE INCLUDE_LOGS MAX_LOG_LINES

# 资源限制配置
export MAX_MEMORY_MB MEMORY_WARN_MB MEMORY_CHECK_INTERVAL
export MAX_CPU_PERCENT CPU_WARN_PERCENT CPU_CHECK_INTERVAL
export MIN_DISK_SPACE_MB DISK_WARN_MB DISK_CHECK_INTERVAL
export PROCESS_PRIORITY MAX_OPEN_FILES MAX_PROCESSES MAX_THREADS
export NETWORK_BANDWIDTH_LIMIT IO_BANDWIDTH_LIMIT
export AUTO_CLEAN_TEMP TEMP_FILE_RETENTION_HOURS
export MAX_LOG_SIZE_MB LOG_ROTATE_COUNT
export ENABLE_RESOURCE_MONITOR RESOURCE_REPORT_INTERVAL
export RESOURCE_LIMIT_ACTION RESOURCE_RECOVERY_WAIT
