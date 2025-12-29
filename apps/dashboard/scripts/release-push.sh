#!/bin/bash
# 推送版本 Tag 到远程仓库

set -e

VERSION="${1:-1.8.0}"
REPO_DIR="/home/xx/dev/zenithjoy-autopilot"
TAG_NAME="autopilot-core-v${VERSION}"

echo "=========================================="
echo "  推送版本 Tag: ${TAG_NAME}"
echo "=========================================="
echo ""

cd "$REPO_DIR"

# 检查 tag 是否存在
if ! git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
    echo "错误: Tag $TAG_NAME 不存在"
    echo "请先运行: ./scripts/release-summary.sh ${VERSION}"
    exit 1
fi

# 显示 tag 信息
echo "Tag 信息:"
git show "$TAG_NAME" --no-patch
echo ""

# 确认推送
read -p "确认推送到远程仓库? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # 推送 tag
    git push origin "$TAG_NAME"
    
    echo ""
    echo "✅ Tag 已推送到远程仓库"
    echo ""
else
    echo "已取消推送"
    exit 0
fi

echo "=========================================="
echo "  版本发布完成"
echo "=========================================="
echo ""
echo "下一步操作:"
echo "  1. 在 GitHub 创建 Release (可选)"
echo "  2. 更新 Notion 项目状态为 'Released'"
echo "  3. 通知团队成员"
echo ""
