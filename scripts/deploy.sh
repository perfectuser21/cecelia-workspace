#!/bin/bash
#
# 部署脚本 - 强制分支检查
#
# 用法:
#   ./scripts/deploy.sh main      # 部署到生产 (5211)
#   ./scripts/deploy.sh develop   # 部署到开发 (5212)
#

set -e

TARGET="$1"
CURRENT_BRANCH=$(git branch --show-current)
REPO_DIR="/home/xx/dev/zenithjoy-core"
FRONTEND_DIR="/home/xx/dev/zenithjoy-autopilot/apps/dashboard/frontend"

cd "$REPO_DIR"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

error() { echo -e "${RED}ERROR: $1${NC}" >&2; exit 1; }
info() { echo -e "${GREEN}$1${NC}"; }

# 检查参数
if [[ -z "$TARGET" ]]; then
    echo "用法: $0 <main|develop>"
    echo ""
    echo "  main    - 部署到生产环境 (zenithjoy-core:5211)"
    echo "  develop - 部署到开发环境 (zenithjoy-core-dev:5212)"
    echo ""
    echo "当前分支: $CURRENT_BRANCH"
    exit 1
fi

# ============================================
# 部署到生产 (main -> 5211)
# ============================================
if [[ "$TARGET" == "main" ]]; then
    # 强制检查：必须在 main 分支
    if [[ "$CURRENT_BRANCH" != "main" ]]; then
        error "部署生产必须在 main 分支！当前分支: $CURRENT_BRANCH"
    fi

    info ">>> 部署到生产环境 (main -> 5211)"

    # 拉取最新
    git pull origin main

    # 构建后端
    info ">>> 构建后端..."
    npm run build

    # 构建前端
    info ">>> 构建前端..."
    cd "$FRONTEND_DIR"
    npm run build
    cd "$REPO_DIR"

    # 重建容器（使用镜像内的 dist）
    info ">>> 重建生产容器..."
    docker compose build --no-cache zenithjoy-core
    docker compose up -d zenithjoy-core

    info ">>> 生产环境部署完成"
    info ">>> URL: https://core.zenjoymedia.media"

# ============================================
# 部署到开发 (develop -> 5212)
# ============================================
elif [[ "$TARGET" == "develop" ]]; then
    # 强制检查：必须在 develop 或 cp-*/feature/* 分支
    if [[ "$CURRENT_BRANCH" != "develop" && ! "$CURRENT_BRANCH" =~ ^cp- && ! "$CURRENT_BRANCH" =~ ^feature/ ]]; then
        error "部署开发必须在 develop/cp-*/feature/* 分支！当前分支: $CURRENT_BRANCH"
    fi

    info ">>> 部署到开发环境 ($CURRENT_BRANCH -> 5212)"

    # 构建前端到 dist-dev
    info ">>> 构建前端..."
    cd "$FRONTEND_DIR"
    npm run build
    rm -rf dist-dev
    cp -r dist dist-dev
    cd "$REPO_DIR"

    # 重启开发容器（tsx watch 会自动加载后端代码变更）
    info ">>> 重启开发容器..."
    CONTAINER=$(docker ps --filter "name=zenithjoy-core-dev" --format "{{.Names}}" | head -1)
    if [[ -n "$CONTAINER" ]]; then
        docker restart "$CONTAINER"
    else
        error "找不到开发容器 zenithjoy-core-dev"
    fi

    info ">>> 开发环境部署完成"
    info ">>> URL: https://dev-core.zenjoymedia.media"

else
    error "未知目标: $TARGET (只支持 main 或 develop)"
fi
