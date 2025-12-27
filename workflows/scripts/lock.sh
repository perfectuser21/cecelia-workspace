#!/bin/bash
# lock.sh - 并行锁管理
# 用于防止多个 Claude 实例同时修改同一个 bundle

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCK_DIR="$SCRIPT_DIR/../.locks"
LOCK_TIMEOUT=300  # 5 分钟超时
STALE_THRESHOLD=600  # 10 分钟视为死锁

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[lock]${NC} $1"; }
warn() { echo -e "${YELLOW}[lock]${NC} $1"; }
error() { echo -e "${RED}[lock]${NC} $1"; exit 1; }

# 确保锁目录存在
mkdir -p "$LOCK_DIR"

# ============================================================
# 命令: acquire
# 获取锁，如果被占用则等待
# ============================================================
cmd_acquire() {
  local lock_name="$1"
  local timeout="${2:-$LOCK_TIMEOUT}"

  if [[ -z "$lock_name" ]]; then
    error "用法: lock.sh acquire <lock_name> [timeout_seconds]"
  fi

  local lock_file="$LOCK_DIR/${lock_name}.lock"
  local start_time=$(date +%s)

  while true; do
    # 检查是否存在锁
    if [[ -f "$lock_file" ]]; then
      local lock_pid=$(cat "$lock_file" 2>/dev/null | head -1)
      local lock_time=$(cat "$lock_file" 2>/dev/null | tail -1)
      local now=$(date +%s)

      # 检查锁是否过期（死锁检测）
      if [[ -n "$lock_time" ]]; then
        local age=$((now - lock_time))
        if [[ $age -gt $STALE_THRESHOLD ]]; then
          warn "检测到过期锁 (${age}s old)，强制释放"
          rm -f "$lock_file"
          continue
        fi
      fi

      # 检查持锁进程是否存活
      if [[ -n "$lock_pid" ]] && ! kill -0 "$lock_pid" 2>/dev/null; then
        warn "持锁进程 $lock_pid 已死亡，释放锁"
        rm -f "$lock_file"
        continue
      fi

      # 检查等待超时
      local elapsed=$((now - start_time))
      if [[ $elapsed -gt $timeout ]]; then
        error "等待锁超时 (${timeout}s)，锁被 PID $lock_pid 持有"
      fi

      # 等待重试
      sleep 1
      continue
    fi

    # 尝试获取锁（原子操作）
    (
      set -o noclobber
      echo -e "$$\n$(date +%s)" > "$lock_file"
    ) 2>/dev/null

    if [[ $? -eq 0 ]]; then
      log "获取锁成功: $lock_name (PID: $$)"
      echo "$lock_file"
      return 0
    fi

    # 创建失败，可能有竞争，重试
    sleep 0.1
  done
}

# ============================================================
# 命令: release
# 释放锁
# ============================================================
cmd_release() {
  local lock_name="$1"

  if [[ -z "$lock_name" ]]; then
    error "用法: lock.sh release <lock_name>"
  fi

  local lock_file="$LOCK_DIR/${lock_name}.lock"

  if [[ ! -f "$lock_file" ]]; then
    warn "锁不存在: $lock_name"
    return 0
  fi

  local lock_pid=$(cat "$lock_file" 2>/dev/null | head -1)

  # 只允许持锁进程释放（或强制释放）
  if [[ "$lock_pid" != "$$" && "$2" != "--force" ]]; then
    warn "锁由其他进程持有 (PID: $lock_pid)，使用 --force 强制释放"
    return 1
  fi

  rm -f "$lock_file"
  log "释放锁成功: $lock_name"
  return 0
}

# ============================================================
# 命令: status
# 查看锁状态
# ============================================================
cmd_status() {
  local lock_name="$1"

  if [[ -z "$lock_name" ]]; then
    # 显示所有锁
    echo "=== 当前锁状态 ==="
    if [[ ! -d "$LOCK_DIR" ]] || [[ -z "$(ls -A "$LOCK_DIR" 2>/dev/null)" ]]; then
      echo "  (无活跃锁)"
      return 0
    fi

    for lock_file in "$LOCK_DIR"/*.lock; do
      [[ -f "$lock_file" ]] || continue
      local name=$(basename "$lock_file" .lock)
      local pid=$(cat "$lock_file" 2>/dev/null | head -1)
      local time=$(cat "$lock_file" 2>/dev/null | tail -1)
      local now=$(date +%s)
      local age=$((now - time))
      local status="active"

      if ! kill -0 "$pid" 2>/dev/null; then
        status="stale (process dead)"
      elif [[ $age -gt $STALE_THRESHOLD ]]; then
        status="stale (${age}s old)"
      fi

      echo "  $name: PID=$pid, age=${age}s, status=$status"
    done
    return 0
  fi

  # 显示特定锁
  local lock_file="$LOCK_DIR/${lock_name}.lock"

  if [[ ! -f "$lock_file" ]]; then
    echo "unlocked"
    return 0
  fi

  local pid=$(cat "$lock_file" 2>/dev/null | head -1)
  local time=$(cat "$lock_file" 2>/dev/null | tail -1)
  local now=$(date +%s)
  local age=$((now - time))

  echo "locked by PID $pid (${age}s ago)"
  return 1
}

# ============================================================
# 命令: cleanup
# 清理所有过期锁
# ============================================================
cmd_cleanup() {
  log "清理过期锁..."
  local cleaned=0

  for lock_file in "$LOCK_DIR"/*.lock; do
    [[ -f "$lock_file" ]] || continue
    local name=$(basename "$lock_file" .lock)
    local pid=$(cat "$lock_file" 2>/dev/null | head -1)
    local time=$(cat "$lock_file" 2>/dev/null | tail -1)
    local now=$(date +%s)
    local age=$((now - time))

    if ! kill -0 "$pid" 2>/dev/null || [[ $age -gt $STALE_THRESHOLD ]]; then
      rm -f "$lock_file"
      log "清理: $name (PID=$pid, age=${age}s)"
      ((cleaned++))
    fi
  done

  log "清理完成，共清理 $cleaned 个锁"
}

# ============================================================
# 命令: with
# 在持有锁的情况下执行命令
# ============================================================
cmd_with() {
  local lock_name="$1"
  shift

  if [[ -z "$lock_name" || $# -eq 0 ]]; then
    error "用法: lock.sh with <lock_name> <command...>"
  fi

  # 获取锁
  cmd_acquire "$lock_name" > /dev/null

  # 确保退出时释放锁
  trap "cmd_release '$lock_name' > /dev/null 2>&1" EXIT

  # 执行命令
  "$@"
  local exit_code=$?

  # 释放锁
  cmd_release "$lock_name" > /dev/null
  trap - EXIT

  return $exit_code
}

# ============================================================
# 帮助
# ============================================================
show_help() {
  cat <<EOF
lock.sh - 并行锁管理

用法:
  lock.sh <command> [options]

命令:
  acquire <name> [timeout]   获取锁，等待直到成功或超时
  release <name> [--force]   释放锁
  status [name]              查看锁状态（不指定则显示全部）
  cleanup                    清理所有过期锁
  with <name> <command>      持有锁时执行命令

示例:
  # 获取锁
  lock.sh acquire bundle-nightly-maintenance

  # 释放锁
  lock.sh release bundle-nightly-maintenance

  # 查看所有锁
  lock.sh status

  # 持有锁时执行命令
  lock.sh with bundle-ai-factory ./update-bundle.sh

配置:
  LOCK_TIMEOUT=$LOCK_TIMEOUT (等待超时)
  STALE_THRESHOLD=$STALE_THRESHOLD (死锁检测阈值)
EOF
}

# ============================================================
# 主入口
# ============================================================
main() {
  local command="${1:-help}"
  shift || true

  case "$command" in
    acquire) cmd_acquire "$@" ;;
    release) cmd_release "$@" ;;
    status) cmd_status "$@" ;;
    cleanup) cmd_cleanup "$@" ;;
    with) cmd_with "$@" ;;
    help|--help|-h) show_help ;;
    *) error "未知命令: $command. 使用 --help 查看帮助" ;;
  esac
}

main "$@"
