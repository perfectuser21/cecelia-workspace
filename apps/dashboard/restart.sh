#!/bin/bash
# 重启 API 服务并刷新 nginx DNS 缓存

# 使用脚本所在目录
cd "$(dirname "$0")"

echo "Restarting API..."
docker compose up -d api

echo "Waiting for API to be ready..."
sleep 5

echo "Reloading nginx..."
docker exec nginx-proxy-manager nginx -s reload

echo "Done! API is ready."
