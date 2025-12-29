#!/bin/bash
# Autopilot Core 版本汇总脚本
# 用途：收集测试结果，生成版本报告，创建 Git Tag

set -e

VERSION="${1:-1.8.0}"
REPO_DIR="/home/xx/dev/zenithjoy-autopilot"
RUNS_DIR="/home/xx/data/runs"
RELEASE_DIR="$REPO_DIR/docs/releases"
REPORT_FILE="$RELEASE_DIR/v${VERSION}.md"

echo "=========================================="
echo "  Autopilot Core v${VERSION} 版本汇总"
echo "=========================================="
echo ""

# 创建目录
mkdir -p "$RELEASE_DIR"

# 统计最近 7 天的测试结果
echo "[1/4] 收集测试结果..."

TOTAL_RUNS=0
SUCCESS_RUNS=0
FAILED_RUNS=0

FAILURE_REASONS=""

# 查找最近 7 天的测试运行
while IFS= read -r result_file; do
    TOTAL_RUNS=$((TOTAL_RUNS + 1))
    
    # 读取结果
    if grep -q '"success": true' "$result_file" 2>/dev/null; then
        SUCCESS_RUNS=$((SUCCESS_RUNS + 1))
    else
        FAILED_RUNS=$((FAILED_RUNS + 1))
        
        # 提取错误原因
        error=$(grep -oP '"error":\s*"\K[^"]+' "$result_file" 2>/dev/null || echo "unknown")
        FAILURE_REASONS="${FAILURE_REASONS}\n- ${error}"
    fi
done < <(find "$RUNS_DIR" -name "result.json" -mtime -7 2>/dev/null)

# 计算成功率
if [ $TOTAL_RUNS -gt 0 ]; then
    SUCCESS_RATE=$(awk "BEGIN {printf \"%.2f\", ($SUCCESS_RUNS / $TOTAL_RUNS) * 100}")
else
    SUCCESS_RATE="0.00"
fi

echo "  总测试运行: $TOTAL_RUNS"
echo "  成功: $SUCCESS_RUNS"
echo "  失败: $FAILED_RUNS"
echo "  成功率: ${SUCCESS_RATE}%"
echo ""

# 生成版本报告
echo "[2/4] 生成版本报告..."

cat > "$REPORT_FILE" <<EOF
# Autopilot Core v${VERSION} 版本报告

**发布日期**: $(date '+%Y-%m-%d')

## 版本概述

Autopilot Core v${VERSION} 是质检系统验证版本，重点验证了硬检查和软检查功能的稳定性。

## 测试摘要

### 测试统计 (最近 7 天)

| 指标 | 数值 |
|------|------|
| 总测试运行 | $TOTAL_RUNS |
| 成功运行 | $SUCCESS_RUNS |
| 失败运行 | $FAILED_RUNS |
| 通过率 | ${SUCCESS_RATE}% |

### 测试范围

- ✅ 硬检查 (Hard Check)
  - 语法错误检测
  - 类型错误检测
  - 依赖缺失检测
  - 构建失败检测

- ✅ 软检查 (Soft Check)
  - 代码风格检查
  - 最佳实践验证
  - 性能警告
  - 安全建议

## 主要失败原因

EOF

if [ $FAILED_RUNS -gt 0 ]; then
    echo -e "$FAILURE_REASONS" | sort | uniq -c | sort -rn >> "$REPORT_FILE"
else
    echo "无失败记录" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" <<EOF

## 已知问题

1. **执行失败 (execute_failed)**
   - 部分任务因环境配置问题导致执行失败
   - 优化建议：增强环境预检查

2. **超时问题**
   - 长时间运行的任务可能触发超时
   - 优化建议：实现任务分片机制

## 改进建议

- [ ] 优化任务执行环境预检查
- [ ] 实现更详细的错误日志
- [ ] 增加任务重试机制
- [ ] 改进超时处理逻辑

## 下一步计划

- 版本 1.9.0：优化错误处理和重试机制
- 版本 2.0.0：引入并行执行能力

---

**生成时间**: $(date '+%Y-%m-%d %H:%M:%S')
EOF

echo "  报告已保存: $REPORT_FILE"
echo ""

# 创建 Git Tag
echo "[3/4] 创建 Git Tag..."

cd "$REPO_DIR"

# 检查是否已存在该 tag
if git rev-parse "autopilot-core-v${VERSION}" >/dev/null 2>&1; then
    echo "  警告: Tag autopilot-core-v${VERSION} 已存在"
    echo "  如需重新创建，请先删除: git tag -d autopilot-core-v${VERSION}"
else
    # 创建 annotated tag
    git tag -a "autopilot-core-v${VERSION}" -m "$(cat <<TAGMSG
Autopilot Core v${VERSION}

质检系统验证版本

测试摘要:
- 总运行: $TOTAL_RUNS
- 成功率: ${SUCCESS_RATE}%
- 测试时间: 最近 7 天

详细报告: docs/releases/v${VERSION}.md
TAGMSG
)"
    
    echo "  Tag 已创建: autopilot-core-v${VERSION}"
    echo ""
    echo "  推送到远程: git push origin autopilot-core-v${VERSION}"
fi

echo ""

# 完成
echo "[4/4] 汇总完成"
echo ""
echo "=========================================="
echo "  版本报告: $REPORT_FILE"
echo "  Git Tag: autopilot-core-v${VERSION}"
echo "=========================================="
echo ""
echo "下一步操作:"
echo "  1. 查看报告: cat $REPORT_FILE"
echo "  2. 推送标签: git push origin autopilot-core-v${VERSION}"
echo "  3. 更新 Notion 项目状态"
echo ""
