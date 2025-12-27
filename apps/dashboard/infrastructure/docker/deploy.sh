#!/bin/bash

# 自媒体数据采集平台部署脚本
set -e

echo "🚀 开始部署自媒体数据采集平台..."

# 1. 复制 Nginx 配置
echo "📝 配置 Nginx..."
sudo cp deploy-nginx.conf /etc/nginx/sites-available/social-metrics
sudo ln -sf /etc/nginx/sites-available/social-metrics /etc/nginx/sites-enabled/

# 2. 测试 Nginx 配置
echo "🔍 测试 Nginx 配置..."
sudo nginx -t

# 3. 重启 Nginx
echo "🔄 重启 Nginx..."
sudo systemctl reload nginx

echo "✅ 部署完成！"
echo ""
echo "🌐 访问地址: https://social.zenithjoyai.com"
echo ""
echo "📋 下一步："
echo "1. 在飞书开放平台更新重定向URL为: https://social.zenithjoyai.com/login"
echo "2. 在飞书开放平台更新安全域名为: https://social.zenithjoyai.com"
echo "3. 测试飞书登录"
