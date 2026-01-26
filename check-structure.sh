#!/bin/bash
cd /home/xx/dev/cecelia-workspace

echo "=== apps/ 目录内容 ==="
ls -la apps/ 2>&1

echo ""
echo "=== features/ 目录内容 ==="
ls features/ | head -20

echo ""
echo "=== dashboard/ 目录内容 ==="
ls dashboard/ | head -10

echo ""
echo "=== backend/ 目录内容 ==="
ls backend/ | head -10
