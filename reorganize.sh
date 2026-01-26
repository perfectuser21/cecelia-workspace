#!/bin/bash
# 扁平化 cecelia-workspace 结构

cd /home/xx/dev/cecelia-workspace

echo "🔄 Step 1: 移动前端到根目录..."
mv apps/cecelia-frontend/frontend ./dashboard

echo "🔄 Step 2: 移动后端到根目录..."
mv apps/cecelia-backend/src ./backend
mv apps/cecelia-backend/package.json backend/
mv apps/cecelia-backend/tsconfig.json backend/ 2>/dev/null || true
mv apps/cecelia-backend/Dockerfile* backend/ 2>/dev/null || true

echo "🔄 Step 3: 合并 Cecelia features 到根目录..."
mv apps/cecelia-backend/features/* features/

echo "🔄 Step 4: 移动其他内容..."
mv apps/cecelia-backend/data ./data-cecelia 2>/dev/null || true
cp -r apps/cecelia-backend/workflows/* workflows/ 2>/dev/null || true
cp -r apps/cecelia-backend/scripts/* scripts/ 2>/dev/null || true

echo "🔄 Step 5: 清理空目录..."
rm -rf apps/cecelia-backend/features
rm -rf apps/cecelia-backend/workflows
rm -rf apps/cecelia-backend/scripts
rm -rf apps/cecelia-frontend
rm -rf apps/cecelia-backend
rmdir apps 2>/dev/null || true

echo "🔄 Step 6: 更新 vite.config.ts..."
cd dashboard
sed -i "s|'../../../cecelia-backend/features'|'../features'|g" vite.config.ts

echo "🔄 Step 7: 更新 docker-compose.yml..."
cd /home/xx/dev/cecelia-workspace
sed -i 's|apps/cecelia-frontend/frontend|dashboard|g' docker-compose.yml
sed -i 's|apps/dashboard/frontend|dashboard|g' docker-compose.yml

echo ""
echo "✅ 重组完成！"
echo ""
echo "📂 新结构："
ls -la | grep -E "^d"

echo ""
echo "📋 验证："
echo "Dashboard: $(ls dashboard/ 2>/dev/null | wc -l) 个文件/目录"
echo "Backend: $(ls backend/ 2>/dev/null | wc -l) 个文件/目录"
echo "Features: $(ls features/ 2>/dev/null | wc -l) 个 feature"
