#!/bin/bash
#
# Autopilot Core 版本汇总脚本
# 用途: 收集测试结果,生成版本报告,创建 Git Tag
#
# 用法: ./release-summary.sh <version> [start_date]
# 示例: ./release-summary.sh 1.8.0 "2025-12-28"
#

set -e

VERSION="${1:-}"
START_DATE="${2:-2025-12-28}"

if [[ -z "$VERSION" ]]; then
  echo "错误: 请提供版本号"
  echo "用法: $0 <version> [start_date]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RUNS_DIR="/home/xx/data/runs"
RELEASE_DIR="$PROJECT_DIR/docs/releases"
REPORT_FILE="$RELEASE_DIR/v${VERSION}.md"

echo "=========================================="
echo "Autopilot Core v${VERSION} 版本汇总"
echo "开始日期: $START_DATE"
echo "=========================================="

# 创建临时文件
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

# ============================================================
# 1. 收集测试结果
# ============================================================
echo ""
echo "[1/5] 收集测试结果..."

TOTAL_RUNS=0
SUCCESS_RUNS=0
FAILED_RUNS=0
ERROR_RUNS=0

# 查找所有测试运行目录
for run_dir in "$RUNS_DIR"/202512*; do
  [[ -d "$run_dir" ]] || continue

  # 提取日期 (格式: YYYYMMDD)
  run_name=$(basename "$run_dir")
  run_date=${run_name:0:8}

  # 过滤日期
  compare_date=$(echo "$START_DATE" | tr -d '-')
  if [[ "$run_date" < "$compare_date" ]]; then
    continue
  fi

  TOTAL_RUNS=$((TOTAL_RUNS + 1))

  # 检查结果文件
  if [[ -f "$run_dir/result.json" ]]; then
    if jq -e '.success == true' "$run_dir/result.json" &>/dev/null; then
      SUCCESS_RUNS=$((SUCCESS_RUNS + 1))
      echo "$run_name" >> "$TEMP_DIR/success.txt"
    elif jq -e '.success == false' "$run_dir/result.json" &>/dev/null; then
      FAILED_RUNS=$((FAILED_RUNS + 1))
      error_msg=$(jq -r '.error // "unknown"' "$run_dir/result.json")
      echo "$run_name: $error_msg" >> "$TEMP_DIR/failed.txt"
    fi
  elif [[ -f "$run_dir/error.json" ]]; then
    ERROR_RUNS=$((ERROR_RUNS + 1))
    echo "$run_name" >> "$TEMP_DIR/errors.txt"
  fi
done

echo "总运行次数: $TOTAL_RUNS"
echo "成功: $SUCCESS_RUNS"
echo "失败: $FAILED_RUNS"
echo "错误: $ERROR_RUNS"

# 计算成功率
if [[ $TOTAL_RUNS -gt 0 ]]; then
  SUCCESS_RATE=$(awk "BEGIN {printf \"%.2f\", ($SUCCESS_RUNS / $TOTAL_RUNS) * 100}")
else
  SUCCESS_RATE="0.00"
fi

echo "成功率: ${SUCCESS_RATE}%"

# ============================================================
# 2. 分析失败原因
# ============================================================
echo ""
echo "[2/5] 分析失败原因..."

if [[ -f "$TEMP_DIR/failed.txt" ]]; then
  # 统计失败原因
  awk -F': ' '{print $2}' "$TEMP_DIR/failed.txt" | sort | uniq -c | sort -rn > "$TEMP_DIR/failure_reasons.txt"
  echo "失败原因分布:"
  cat "$TEMP_DIR/failure_reasons.txt"
else
  echo "无失败记录"
fi

# ============================================================
# 3. 生成版本报告
# ============================================================
echo ""
echo "[3/5] 生成版本报告..."

mkdir -p "$RELEASE_DIR"

cat > "$REPORT_FILE" <<EOF
# Autopilot Core v${VERSION}

**发布日期**: $(date +"%Y-%m-%d")
**测试周期**: ${START_DATE} - $(date +"%Y-%m-%d")

## 摘要

Autopilot Core v${VERSION} 是质检系统验证版本，完成了硬检查和软检查的全面测试。

## 测试结果

### 整体统计

| 指标 | 数值 |
|------|------|
| 总运行次数 | ${TOTAL_RUNS} |
| 成功次数 | ${SUCCESS_RUNS} |
| 失败次数 | ${FAILED_RUNS} |
| 错误次数 | ${ERROR_RUNS} |
| **成功率** | **${SUCCESS_RATE}%** |

### 测试分布

- 测试开始日期: ${START_DATE}
- 测试结束日期: $(date +"%Y-%m-%d")
- 测试周期: $(($(date +%s) - $(date -d "$START_DATE" +%s))) 秒

EOF

# 添加失败原因分析
if [[ -f "$TEMP_DIR/failure_reasons.txt" && -s "$TEMP_DIR/failure_reasons.txt" ]]; then
  cat >> "$REPORT_FILE" <<EOF

### 失败原因分析

| 次数 | 原因 |
|------|------|
EOF

  while read -r line; do
    count=$(echo "$line" | awk '{print $1}')
    reason=$(echo "$line" | cut -d' ' -f2-)
    echo "| $count | $reason |" >> "$REPORT_FILE"
  done < "$TEMP_DIR/failure_reasons.txt"
fi

# 添加已知问题
cat >> "$REPORT_FILE" <<EOF

## 已知问题

EOF

if [[ $FAILED_RUNS -gt 0 || $ERROR_RUNS -gt 0 ]]; then
  cat >> "$REPORT_FILE" <<EOF
1. **执行失败**: 部分任务执行失败，需要进一步调查失败原因
2. **错误处理**: ${ERROR_RUNS} 个运行出现错误，需要改进错误处理机制

EOF
else
  cat >> "$REPORT_FILE" <<EOF
无已知问题。所有测试均已通过。

EOF
fi

# 添加改进建议
cat >> "$REPORT_FILE" <<EOF
## 改进建议

1. **提高成功率**: 当前成功率为 ${SUCCESS_RATE}%，目标是达到 95% 以上
2. **错误分类**: 建立更细粒度的错误分类体系
3. **自动重试**: 对于可恢复的错误，实现自动重试机制
4. **监控告警**: 增强实时监控和告警功能

## 下一步计划

- [ ] 修复已知问题
- [ ] 优化质检规则
- [ ] 提升测试覆盖率
- [ ] 完善文档和示例

---

**生成时间**: $(date +"%Y-%m-%d %H:%M:%S")
**生成脚本**: release-summary.sh
EOF

echo "报告已生成: $REPORT_FILE"

# ============================================================
# 4. 创建 Git Tag
# ============================================================
echo ""
echo "[4/5] 创建 Git Tag..."

cd "$PROJECT_DIR"

# 检查是否有未提交的更改
if [[ -n "$(git status --porcelain)" ]]; then
  echo "警告: 存在未提交的更改"
  git status --short
  read -p "是否继续创建 tag? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 1
  fi
fi

# 检查 tag 是否已存在
TAG_NAME="autopilot-core-v${VERSION}"
if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
  echo "警告: Tag $TAG_NAME 已存在"
  read -p "是否删除并重新创建? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git tag -d "$TAG_NAME"
  else
    echo "已取消"
    exit 1
  fi
fi

# 创建带注释的 tag
TAG_MESSAGE="Autopilot Core v${VERSION}

测试结果汇总:
- 总运行次数: ${TOTAL_RUNS}
- 成功率: ${SUCCESS_RATE}%
- 失败次数: ${FAILED_RUNS}
- 错误次数: ${ERROR_RUNS}

版本报告: docs/releases/v${VERSION}.md"

git tag -a "$TAG_NAME" -m "$TAG_MESSAGE"

echo "Tag 已创建: $TAG_NAME"

# ============================================================
# 5. 推送到远程仓库
# ============================================================
echo ""
echo "[5/5] 推送到远程仓库..."

read -p "是否推送 tag 到远程仓库? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  # 添加版本报告文件
  git add "$REPORT_FILE"
  git commit -m "docs: 添加 v${VERSION} 版本报告" || true

  # 推送
  git push origin main --tags
  echo "已推送到远程仓库"
else
  echo "已跳过推送，请手动执行:"
  echo "  git push origin main --tags"
fi

echo ""
echo "=========================================="
echo "版本汇总完成!"
echo "=========================================="
echo "版本报告: $REPORT_FILE"
echo "Git Tag: $TAG_NAME"
echo ""
