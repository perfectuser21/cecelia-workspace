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
# 导出变量
# ============================================================
export SCRIPTS_DIR AI_FACTORY_DIR PROJECT_DIR WORKTREES_DIR DATA_DIR RUNS_DIR LOGS_DIR WORKFLOWS_DIR
export GIT_BASE_BRANCH GIT_BRANCH_PREFIX GIT_TIMEOUT API_TIMEOUT
export CLEANUP_ON_SUCCESS KEEP_ON_FAILURE
