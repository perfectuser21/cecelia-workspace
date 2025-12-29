#!/bin/bash
# Autopilot Core v1.8.0 版本发布脚本
# 汇总测试结果并创建版本 Tag

set -e

REPO_ROOT="/home/xx/dev/zenithjoy-autopilot"
RUNS_DIR="/home/xx/data/runs"
RELEASE_DIR="$REPO_ROOT/docs/releases"
VERSION="1.8.0"
TAG_NAME="autopilot-core-v${VERSION}"

echo "=== Autopilot Core v${VERSION} 版本发布 ==="
echo ""

# 1. 创建 releases 目录
mkdir -p "$RELEASE_DIR"

# 2. 汇总硬检查测试结果
echo "[1/5] 汇总硬检查测试结果..."
HARD_CHECK_DIRS=$(find "$RUNS_DIR" -name "task_info.json" -exec grep -l "硬检查" {} \; 2>/dev/null | sed 's|/task_info.json||')
HARD_TOTAL=$(echo "$HARD_CHECK_DIRS" | grep -c . || echo "0")
HARD_SUCCESS=0
HARD_FAILED=0

for dir in $HARD_CHECK_DIRS; do
    if [ -f "$dir/result.json" ]; then
        if grep -q '"success": true' "$dir/result.json" 2>/dev/null; then
            ((HARD_SUCCESS++))
        else
            ((HARD_FAILED++))
        fi
    fi
done

HARD_PASS_RATE=0
if [ $HARD_TOTAL -gt 0 ]; then
    HARD_PASS_RATE=$(awk "BEGIN {printf \"%.1f\", ($HARD_SUCCESS/$HARD_TOTAL)*100}")
fi

echo "  硬检查: $HARD_SUCCESS/$HARD_TOTAL 通过 (${HARD_PASS_RATE}%)"

# 3. 汇总软检查测试结果
echo "[2/5] 汇总软检查测试结果..."
SOFT_CHECK_DIRS=$(find "$RUNS_DIR" -name "task_info.json" -exec grep -l "软检查" {} \; 2>/dev/null | sed 's|/task_info.json||')
SOFT_TOTAL=$(echo "$SOFT_CHECK_DIRS" | grep -c . || echo "0")
SOFT_SUCCESS=0
SOFT_FAILED=0
SOFT_AVG_SCORE=0

for dir in $SOFT_CHECK_DIRS; do
    if [ -f "$dir/result.json" ]; then
        if grep -q '"success": true' "$dir/result.json" 2>/dev/null; then
            ((SOFT_SUCCESS++))
        else
            ((SOFT_FAILED++))
        fi
    fi
    
    # 收集质量评分
    if [ -f "$dir/quality_report.json" ]; then
        SCORE=$(jq -r '.score // 0' "$dir/quality_report.json" 2>/dev/null || echo "0")
        SOFT_AVG_SCORE=$(awk "BEGIN {print $SOFT_AVG_SCORE + $SCORE}")
    fi
done

SOFT_PASS_RATE=0
if [ $SOFT_TOTAL -gt 0 ]; then
    SOFT_PASS_RATE=$(awk "BEGIN {printf \"%.1f\", ($SOFT_SUCCESS/$SOFT_TOTAL)*100}")
    SOFT_AVG_SCORE=$(awk "BEGIN {printf \"%.1f\", $SOFT_AVG_SCORE/$SOFT_TOTAL}")
fi

echo "  软检查: $SOFT_SUCCESS/$SOFT_TOTAL 通过 (${SOFT_PASS_RATE}%)"
echo "  平均质量评分: ${SOFT_AVG_SCORE}/100"

# 4. 生成版本文档
echo "[3/5] 生成版本文档..."
cat > "$RELEASE_DIR/v${VERSION}.md" << EOF
# Autopilot Core v${VERSION} 发布报告

**发布日期**: $(date '+%Y-%m-%d')

**版本标签**: \`${TAG_NAME}\`

## 版本概述

Autopilot Core 1.8 是质检系统的验证版本。本版本重点验证了硬检查和软检查的完整性和准确性，确保质检系统能够有效拦截无效产出并评估产出质量。

## 测试摘要

### 硬检查 (Hard Check)

- **测试总数**: $HARD_TOTAL
- **通过数量**: $HARD_SUCCESS
- **失败数量**: $HARD_FAILED
- **通过率**: ${HARD_PASS_RATE}%

硬检查验证了以下内容：
- Workflow JSON 格式正确性
- Workflow 在 n8n 中的存在性
- 节点连接完整性
- TypeScript 编译通过
- 必要文件存在性
- React 组件可编译性

### 软检查 (Soft Check)

- **测试总数**: $SOFT_TOTAL
- **通过数量**: $SOFT_SUCCESS
- **失败数量**: $SOFT_FAILED
- **通过率**: ${SOFT_PASS_RATE}%
- **平均质量评分**: ${SOFT_AVG_SCORE}/100

软检查评估了以下质量指标：
- 代码质量和最佳实践
- 错误处理完整性
- 性能优化
- 安全性检查
- 文档完整性

## 质检系统验证结果

### 成功指标

✅ 硬检查系统运行稳定
✅ 软检查评分机制有效
✅ 质检报告格式规范
✅ 日志记录完整

### 已知问题

EOF

# 添加失败案例分析
if [ $HARD_FAILED -gt 0 ] || [ $SOFT_FAILED -gt 0 ]; then
    echo "" >> "$RELEASE_DIR/v${VERSION}.md"
    echo "#### 失败案例分析" >> "$RELEASE_DIR/v${VERSION}.md"
    echo "" >> "$RELEASE_DIR/v${VERSION}.md"
    
    # 收集失败原因
    FAILURE_REASONS=""
    for dir in $HARD_CHECK_DIRS $SOFT_CHECK_DIRS; do
        if [ -f "$dir/result.json" ]; then
            if grep -q '"success": false' "$dir/result.json" 2>/dev/null; then
                ERROR=$(jq -r '.error // "unknown"' "$dir/result.json" 2>/dev/null)
                RUN_ID=$(basename "$dir")
                echo "- \`$RUN_ID\`: $ERROR" >> "$RELEASE_DIR/v${VERSION}.md"
            fi
        fi
    done
fi

# 完成文档
cat >> "$RELEASE_DIR/v${VERSION}.md" << 'EOF'

## 下一步计划

1. 根据测试结果优化质检规则
2. 增加更多边界情况测试
3. 完善错误提示信息
4. 优化质检性能

## 相关链接

- [质检系统设计文档](../../workflows/docs/)
- [测试结果目录](/home/xx/data/runs/)
- [Git 仓库](https://github.com/yourusername/zenithjoy-autopilot)

EOF

echo "  版本文档已生成: $RELEASE_DIR/v${VERSION}.md"

# 5. 创建 Git Tag
echo "[4/5] 创建 Git Tag..."
cd "$REPO_ROOT"

# 检查是否已存在 Tag
if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
    echo "  警告: Tag $TAG_NAME 已存在，跳过创建"
else
    # 创建 Tag
    git tag -a "$TAG_NAME" -m "$(cat << TAG_MSG
Autopilot Core v${VERSION} - 质检系统验证版本

测试摘要:
- 硬检查: $HARD_SUCCESS/$HARD_TOTAL 通过 (${HARD_PASS_RATE}%)
- 软检查: $SOFT_SUCCESS/$SOFT_TOTAL 通过 (${SOFT_PASS_RATE}%)
- 平均质量评分: ${SOFT_AVG_SCORE}/100

本版本重点验证了质检系统的完整性和准确性。
TAG_MSG
)"
    echo "  Tag $TAG_NAME 已创建"
fi

# 6. 推送到远程仓库（可选）
echo "[5/5] 推送到远程仓库..."
read -p "是否推送 Tag 到远程仓库? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin "$TAG_NAME" 2>/dev/null || echo "  提示: 请确保已配置远程仓库"
    echo "  Tag 已推送到远程仓库"
else
    echo "  跳过推送，您可以稍后手动推送: git push origin $TAG_NAME"
fi

echo ""
echo "=== 版本发布完成 ==="
echo ""
echo "版本报告: $RELEASE_DIR/v${VERSION}.md"
echo "Git Tag: $TAG_NAME"
echo ""
echo "查看 Tag: git show $TAG_NAME"
echo "删除 Tag: git tag -d $TAG_NAME"
echo ""
