#!/bin/bash
# 部署 claude-auto 工具到全局 bin 目录

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_AUTO_DIR="$SCRIPT_DIR/claude-auto"
BIN_DIR="/home/xx/bin"

echo "==================================="
echo "部署 Claude Auto 工具"
echo "==================================="
echo ""

# 检查源文件
if [ ! -d "$CLAUDE_AUTO_DIR" ]; then
  echo "错误：找不到 claude-auto 目录"
  exit 1
fi

# 创建 bin 目录
mkdir -p "$BIN_DIR"

# 部署所有工具
echo ">>> 部署工具到 $BIN_DIR ..."

tools=(
  "claude-auto"
  "claude-auto-setup"
  "claude-auto-status"
  "claude-auto-switch"
  "claude-quota-check"
)

for tool in "${tools[@]}"; do
  if [ -f "$CLAUDE_AUTO_DIR/$tool" ]; then
    cp "$CLAUDE_AUTO_DIR/$tool" "$BIN_DIR/"
    chmod +x "$BIN_DIR/$tool"
    echo "  ✓ $tool"
  else
    echo "  ✗ $tool (文件不存在)"
  fi
done

echo ""
echo "==================================="
echo "✓ 部署完成！"
echo "==================================="
echo ""
echo "使用方法："
echo "  claude-auto-setup    # 初始化双账号"
echo "  claude-auto -p \"任务\"  # 智能执行"
echo "  claude-quota-check   # 查看额度"
echo ""
echo "详细文档: $SCRIPT_DIR/../docs/CLAUDE_AUTO_GUIDE.md"
