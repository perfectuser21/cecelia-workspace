#!/bin/bash
# 运行所有检查

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================"
echo "    ZenithJoy Autopilot 项目检查"
echo "========================================"
echo ""

# 运行结构检查
"$SCRIPT_DIR/check-structure.sh"
echo ""

# 运行隔离性检查
"$SCRIPT_DIR/check-isolation.sh"
echo ""

echo "========================================"
echo "    所有检查完成!"
echo "========================================"
