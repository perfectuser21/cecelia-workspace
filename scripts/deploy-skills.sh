#!/usr/bin/env bash
# ============================================================================
# deploy-skills.sh - 部署 Skills 到全局目录
# ============================================================================
#
# 将 zenithjoy-core/skills/ 下的 Skills 部署到 ~/.claude/skills/
#
# 用法:
#   bash scripts/deploy-skills.sh [SKILL_NAME]
#
# 示例:
#   bash scripts/deploy-skills.sh          # 部署所有 skills
#   bash scripts/deploy-skills.sh workers  # 只部署 workers skill
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_DIR="$(dirname "$SCRIPT_DIR")"
SKILLS_SRC="$CORE_DIR/skills"
SKILLS_DEST="$HOME/.claude/skills"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "📦 部署 Skills"
echo "   源目录: $SKILLS_SRC"
echo "   目标目录: $SKILLS_DEST"
echo ""

# 确保目标目录存在
mkdir -p "$SKILLS_DEST"

# 获取要部署的 skills
if [[ -n "$1" ]]; then
    SKILLS=("$1")
else
    SKILLS=($(ls -d "$SKILLS_SRC"/*/ 2>/dev/null | xargs -n1 basename))
fi

if [[ ${#SKILLS[@]} -eq 0 ]]; then
    echo "⚠️  没有找到要部署的 skills"
    exit 0
fi

# 部署每个 skill
for skill in "${SKILLS[@]}"; do
    src="$SKILLS_SRC/$skill"
    dest="$SKILLS_DEST/$skill"

    if [[ ! -d "$src" ]]; then
        echo -e "${YELLOW}⚠️  Skill 不存在: $skill${NC}"
        continue
    fi

    # 删除旧版本
    if [[ -d "$dest" ]]; then
        rm -rf "$dest"
    fi

    # 复制新版本
    cp -r "$src" "$dest"

    echo -e "${GREEN}✅ 已部署: $skill${NC}"

    # 显示部署的文件
    ls -la "$dest" | head -5
    echo ""
done

echo "🎉 部署完成！"
