#!/bin/bash
cd /home/xx/dev/cecelia-workspace

echo "🧹 清理残留目录..."

# 删除 apps/cecelia-frontend（frontend 已经移到 dashboard/）
rm -rf apps/cecelia-frontend

# 删除 apps 目录（应该空了）
rmdir apps/ 2>/dev/null && echo "✅ apps/ 已删除" || echo "⚠️  apps/ 不为空，保留"

# 删除临时脚本
rm -f reorganize.sh check-structure.sh cleanup.sh

echo ""
echo "✅ 清理完成！"
echo ""
echo "📂 最终结构："
ls -la | grep "^d" | grep -v "^\."
