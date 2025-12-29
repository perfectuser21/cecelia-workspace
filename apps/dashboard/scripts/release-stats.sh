#!/bin/bash
# 查看测试统计信息
# 用途：快速查看最近的测试运行统计

set -e

DAYS="${1:-7}"
RUNS_DIR="/home/xx/data/runs"

echo "=========================================="
echo "  测试统计 (最近 ${DAYS} 天)"
echo "=========================================="
echo ""

TOTAL=0
SUCCESS=0
FAILED=0

declare -A ERROR_TYPES

# 收集数据
while IFS= read -r result_file; do
    TOTAL=$((TOTAL + 1))
    
    if grep -q '"success": true' "$result_file" 2>/dev/null; then
        SUCCESS=$((SUCCESS + 1))
    else
        FAILED=$((FAILED + 1))
        
        # 统计错误类型
        error=$(grep -oP '"error":\s*"\K[^"]+' "$result_file" 2>/dev/null || echo "unknown")
        ERROR_TYPES["$error"]=$((${ERROR_TYPES["$error"]:-0} + 1))
    fi
done < <(find "$RUNS_DIR" -name "result.json" -mtime -"$DAYS" 2>/dev/null)

# 计算成功率
if [ $TOTAL -gt 0 ]; then
    SUCCESS_RATE=$(awk "BEGIN {printf \"%.2f\", ($SUCCESS / $TOTAL) * 100}")
else
    SUCCESS_RATE="0.00"
fi

echo "总运行: $TOTAL"
echo "成功: $SUCCESS"
echo "失败: $FAILED"
echo "成功率: ${SUCCESS_RATE}%"
echo ""

if [ $FAILED -gt 0 ]; then
    echo "失败原因分布:"
    echo "----------------------------------------"
    for error in "${!ERROR_TYPES[@]}"; do
        count=${ERROR_TYPES[$error]}
        percentage=$(awk "BEGIN {printf \"%.1f\", ($count / $FAILED) * 100}")
        printf "  %-30s %3d (%.1f%%)\n" "$error" "$count" "$percentage"
    done | sort -k2 -rn
fi

echo ""
echo "=========================================="
