#!/bin/bash
# 检查 monorepo 目录结构

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ERRORS=0

echo "=== 检查 zenithjoy-autopilot 目录结构 ==="
echo ""

check_dir() {
    if [ -d "$ROOT_DIR/$1" ]; then
        echo "✅ $1"
    else
        echo "❌ $1 (缺失)"
        ERRORS=$((ERRORS + 1))
    fi
}

check_file() {
    if [ -f "$ROOT_DIR/$1" ]; then
        echo "✅ $1"
    else
        echo "❌ $1 (缺失)"
        ERRORS=$((ERRORS + 1))
    fi
}

echo "📁 核心目录:"
check_dir "apps/dashboard"
check_dir "apps/dashboard/frontend"
check_dir "apps/dashboard/core/api"
check_dir "workflows"
check_dir "workflows/exports"
check_dir "instances/zenithjoy"
check_dir "scripts"
check_dir "docs"
check_dir "deploy"

echo ""
echo "📄 关键文件:"
check_file "CLAUDE.md"
check_file "apps/dashboard/docker-compose.yml"
check_file "apps/dashboard/package.json"
check_file "workflows/workflow-factory.sh"

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ 所有检查通过!"
    exit 0
else
    echo "❌ 发现 $ERRORS 个问题"
    exit 1
fi
