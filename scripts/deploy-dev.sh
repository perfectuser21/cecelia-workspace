#!/bin/bash
# 把当前分支部署到 dev 环境 (5212) 进行测试
# Usage: ./deploy-dev.sh

set -e

REPO_DIR="/home/xx/dev/zenithjoy-autopilot"
FRONTEND_DIR="$REPO_DIR/apps/dashboard/frontend"
BRANCH=$(git rev-parse --abbrev-ref HEAD)

cd "$FRONTEND_DIR"

echo "🔨 Building $BRANCH → dev environment (5212)..."

npm run build

rm -rf "$FRONTEND_DIR/dist-dev"
cp -r "$FRONTEND_DIR/dist" "$FRONTEND_DIR/dist-dev"

docker restart zenithjoy-core-dev

echo ""
echo "✅ Done! Test at:"
echo "   • http://localhost:5212"
echo "   • https://dev-autopilot.zenjoymedia.media"
