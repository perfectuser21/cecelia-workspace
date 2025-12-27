#!/bin/bash
# 检查模块隔离性（确保没有跨模块的绝对路径引用）

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ERRORS=0

echo "=== 检查模块隔离性 ==="
echo ""

# 检查是否有旧的绝对路径引用
echo "📍 检查绝对路径引用..."

OLD_PATHS=(
    "/home/xx/dev/zenithjoy_dashboard"
    "/home/xx/dev/n8n-workflows"
)

for path in "${OLD_PATHS[@]}"; do
    matches=$(grep -r "$path" "$ROOT_DIR" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.sh" 2>/dev/null | grep -v ".git" | head -5 || true)
    if [ -n "$matches" ]; then
        echo "❌ 发现旧路径引用: $path"
        echo "$matches"
        ERRORS=$((ERRORS + 1))
    fi
done

if [ $ERRORS -eq 0 ]; then
    echo "✅ 没有发现绝对路径引用"
fi

echo ""
echo "📦 检查 node_modules..."
if [ -d "$ROOT_DIR/apps/dashboard/node_modules" ]; then
    echo "⚠️  apps/dashboard/node_modules 存在 (需要重新安装)"
else
    echo "✅ 无残留 node_modules"
fi

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ 隔离性检查通过!"
    exit 0
else
    echo "❌ 发现 $ERRORS 个问题"
    exit 1
fi
