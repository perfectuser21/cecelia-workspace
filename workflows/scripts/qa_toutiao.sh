#!/bin/bash
# 今日头条抓取优化 - 8路质检
# Task ID: 2d553f41-3ec5-8188-80d1-cd0e848f71b4

set -e
cd /home/xx/dev/n8n-workflows

echo "========================================="
echo "今日头条（副号）抓取优化 - 8路质检"
echo "========================================="
echo ""

PASSED=0
FAILED=0

# 1. 语法检查
echo "[1/8] 语法检查..."
if node -c windows-runner/vps_scraper.js 2>/dev/null; then
    echo "  ✅ 通过"
    ((PASSED++))
else
    echo "  ❌ 失败: 语法错误"
    ((FAILED++))
fi
echo ""

# 2. 头条函数检查
echo "[2/8] 头条函数检查..."
if grep -q "async function extractToutiao" windows-runner/vps_scraper.js; then
    echo "  ✅ 通过: extractToutiao 函数存在"
    ((PASSED++))
else
    echo "  ❌ 失败: 未找到 extractToutiao 函数"
    ((FAILED++))
fi
echo ""

# 3. 优化点检查 - 减少等待时间
echo "[3/8] 优化点检查 - 减少等待时间..."
if grep -q "pageNum === 1 ? 1000 : 800" windows-runner/vps_scraper.js; then
    echo "  ✅ 通过: 等待时间优化已应用"
    ((PASSED++))
else
    echo "  ❌ 失败: 未找到等待时间优化"
    ((FAILED++))
fi
echo ""

# 4. 30天智能停止检查
echo "[4/8] 30天智能停止检查..."
if grep -q "已超出30天范围" windows-runner/vps_scraper.js; then
    echo "  ✅ 通过: 30天智能停止逻辑已应用"
    ((PASSED++))
else
    echo "  ❌ 失败: 未找到30天智能停止逻辑"
    ((FAILED++))
fi
echo ""

# 5. 数据质量监控检查
echo "[5/8] 数据质量监控检查..."
if grep -q "数据指标为0" windows-runner/vps_scraper.js; then
    echo "  ✅ 通过: 数据质量监控已应用"
    ((PASSED++))
else
    echo "  ❌ 失败: 未找到数据质量监控"
    ((FAILED++))
fi
echo ""

# 6. 内容类型识别检查
echo "[6/8] 内容类型识别检查..."
if grep -q "contentType = '视频'" windows-runner/vps_scraper.js && \
   grep -q "contentType = '文章'" windows-runner/vps_scraper.js; then
    echo "  ✅ 通过: 内容类型识别已应用"
    ((PASSED++))
else
    echo "  ❌ 失败: 未找到内容类型识别逻辑"
    ((FAILED++))
fi
echo ""

# 7. 功能测试 - 头条副号
echo "[7/8] 功能测试 - 头条副号..."
RESULT=$(cd /home/xx && timeout 120 node vps_scraper.js toutiao-sub 2>&1 || true)
COUNT=$(echo "$RESULT" | grep -oP '"count":\s*\K\d+' | tail -1)

if [[ -n "$COUNT" ]] && [[ "$COUNT" -gt 0 ]]; then
    echo "  ✅ 通过: 成功抓取 $COUNT 条数据"
    ((PASSED++))
else
    echo "  ❌ 失败: 抓取数据失败或数量为0"
    echo "$RESULT" | tail -20
    ((FAILED++))
fi
echo ""

# 8. 代码结构检查
echo "[8/8] 代码结构检查..."
ERRORS=0

# 检查是否使用了 DOM 选择器
if ! grep -q "querySelectorAll.*content-item" windows-runner/vps_scraper.js; then
    echo "  ⚠️  警告: 未使用 DOM 选择器优化"
    ((ERRORS++))
fi

# 检查是否有连续空页检测
if ! grep -q "consecutiveEmptyPages" windows-runner/vps_scraper.js; then
    echo "  ⚠️  警告: 未找到连续空页检测"
    ((ERRORS++))
fi

if [[ $ERRORS -eq 0 ]]; then
    echo "  ✅ 通过: 代码结构良好"
    ((PASSED++))
else
    echo "  ❌ 失败: 代码结构存在 $ERRORS 个问题"
    ((FAILED++))
fi
echo ""

# 总结
echo "========================================="
echo "质检结果"
echo "========================================="
echo "通过: $PASSED/8"
echo "失败: $FAILED/8"
echo ""

if [[ $FAILED -eq 0 ]]; then
    echo "✅ 所有质检通过！"
    exit 0
else
    echo "❌ 质检未通过，请修复失败项"
    exit 1
fi
