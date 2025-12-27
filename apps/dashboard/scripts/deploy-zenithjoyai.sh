#!/bin/bash
# 自动构建并部署 zenithjoyai.com
# 用法: ./deploy-zenithjoyai.sh

set -e

ZENITHJOY_DIR="/home/xx/dev/zenithjoyai"
CLOUDFLARE_API_TOKEN="hvK21zf9NHw9DQt_p9mV4O7Maug_hXnyZv5qCPf5"
PROJECT_NAME="zenithjoyai"

echo "🔄 开始部署 zenithjoyai.com..."

# 使用 Node 20
source ~/.nvm/nvm.sh
nvm use 20

# 1. 构建网站（使用本地 API）
echo "📦 构建网站..."
cd "$ZENITHJOY_DIR"
BUILD_ENV=local pnpm build

# 2. 使用 wrangler 上传
echo "🚀 上传到 Cloudflare Pages..."
CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" npx wrangler pages deploy dist \
  --project-name="$PROJECT_NAME" \
  --branch=main \
  --commit-dirty=true

echo "✅ 部署完成！"
echo "🌐 网站地址: https://zenithjoyai.com"
