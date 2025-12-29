#!/bin/bash
#
# Feature Check 执行器
# 用于执行 Feature Check 任务（Coding Type = Check）
#
# 职责:
#   1. 检查所有前置 Tasks 是否完成
#   2. 按定义的节点截图作为证据
#   3. 生成汇总报告并打分
#   4. 打 Git tag
#   5. 上传截图到 Notion
#
# 用法: execute.sh <run_id> <task_info_path>
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# v1.1: 使用固定位置的 shared 脚本
SHARED_DIR="/home/xx/bin/ai-factory-v2"

# 加载公共基础
source "$SHARED_DIR/execute-base.sh"

# 解析参数
parse_execute_args "$@"

# 打印开始日志
log_execute_start "Check"

# ============================================================
# 检查是否跳过执行（稳定性验证）
# ============================================================
if check_skip_execution "check"; then
  output_skip_result
  exit 0
fi

# ============================================================
# 初始化变量
# ============================================================
FEATURE_NAME=$(json_get "$TASK_INFO_PATH" '.task_name' "Unknown Feature")
TASK_ID=$(json_get "$TASK_INFO_PATH" '.task_id' "")
BLOCKED_BY=$(json_get "$TASK_INFO_PATH" '.blocked_by' "[]")
VERSION=$(json_get "$TASK_INFO_PATH" '.version' "1.0.0")
SUB_PROJECT=$(json_get "$TASK_INFO_PATH" '.sub_project' "autopilot")

# 截图目录
SCREENSHOT_DIR="$WORK_DIR/screenshots"
mkdir -p "$SCREENSHOT_DIR"

# 报告文件
REPORT_FILE="$WORK_DIR/feature-report.md"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

# 打分变量
SCORE_BLOCKED_BY=0       # 前置任务完成度 (30分)
SCORE_SCREENSHOTS=0      # 截图完整度 (20分)
SCORE_GIT_TAG=0          # Git Tag (20分)
SCORE_NO_FEEDBACK=0      # 无待处理反馈 (15分)
SCORE_REPORT=0           # 报告生成 (15分)
TOTAL_SCORE=0

# 检查结果
ALL_DEPS_DONE=true
COMPLETED_DEPS=0
TOTAL_DEPS=0
PENDING_TASKS=""
DEP_RESULTS=()

log_info "Feature: $FEATURE_NAME"
log_info "Task ID: $TASK_ID"
log_info "Version: $VERSION"

# ============================================================
# [1/6] 检查所有前置 Tasks 状态
# ============================================================
log_info "[1/6] 检查前置 Tasks 状态..."

# 加载密钥
load_secrets

# 从 task_info.json 获取 blocked_by 列表
DEP_IDS=$(echo "$BLOCKED_BY" | jq -r '.[]? // empty' 2>/dev/null || echo "")

if [[ -z "$DEP_IDS" ]]; then
  log_info "没有依赖任务，前置检查通过"
  ALL_DEPS_DONE=true
  SCORE_BLOCKED_BY=30
else
  for DEP_ID in $DEP_IDS; do
    TOTAL_DEPS=$((TOTAL_DEPS + 1))

    # 查询 Notion 获取状态和名称（带重试）
    DEP_RESPONSE=""
    for retry in 1 2 3; do
      DEP_RESPONSE=$(curl -sf --connect-timeout 10 --max-time 30 \
        "https://api.notion.com/v1/pages/$DEP_ID" \
        -H "Authorization: Bearer $NOTION_API_KEY" \
        -H "Notion-Version: 2022-06-28" 2>/dev/null)
      if [[ -n "$DEP_RESPONSE" && "$DEP_RESPONSE" != "{}" ]]; then
        break
      fi
      [[ $retry -lt 3 ]] && sleep 1
    done
    [[ -z "$DEP_RESPONSE" ]] && DEP_RESPONSE="{}"

    DEP_STATUS=$(echo "$DEP_RESPONSE" | jq -r '.properties.Status.status.name // "unknown"' 2>/dev/null || echo "error")
    DEP_NAME=$(echo "$DEP_RESPONSE" | jq -r '.properties.Name.title[0].plain_text // "Unknown"' 2>/dev/null || echo "Unknown")

    log_info "依赖任务: ${DEP_NAME:0:40}... 状态: $DEP_STATUS"

    if [[ "$DEP_STATUS" == "AI Done" || "$DEP_STATUS" == "Completed" ]]; then
      COMPLETED_DEPS=$((COMPLETED_DEPS + 1))
      DEP_RESULTS+=("✅|${DEP_ID:0:8}|$DEP_NAME|$DEP_STATUS")
    else
      ALL_DEPS_DONE=false
      PENDING_TASKS="${PENDING_TASKS}${DEP_ID:0:8} ($DEP_STATUS), "
      DEP_RESULTS+=("❌|${DEP_ID:0:8}|$DEP_NAME|$DEP_STATUS")
    fi
  done

  log_info "依赖任务完成进度: $COMPLETED_DEPS / $TOTAL_DEPS"

  # 计算前置任务分数 (满分30分)
  if [[ $TOTAL_DEPS -gt 0 ]]; then
    SCORE_BLOCKED_BY=$((30 * COMPLETED_DEPS / TOTAL_DEPS))
  fi
fi

if [[ "$ALL_DEPS_DONE" == "false" ]]; then
  log_warn "部分依赖任务未完成: ${PENDING_TASKS%, }"
fi

# ============================================================
# [2/6] 检查 Notion 页面是否有反馈
# ============================================================
log_info "[2/6] 检查反馈..."

PAGE_CONTENT_FILE="$WORK_DIR/page_content.md"
HAS_FEEDBACK=false
FEEDBACK_CONTENT=""

if [[ -f "$PAGE_CONTENT_FILE" ]]; then
  # 检查是否有 "## 反馈" 或 "## Feedback" 部分
  if grep -qE "^##\s*(反馈|Feedback)" "$PAGE_CONTENT_FILE"; then
    HAS_FEEDBACK=true
    # 提取反馈内容
    FEEDBACK_CONTENT=$(sed -n '/^##\s*\(反馈\|Feedback\)/,/^##/p' "$PAGE_CONTENT_FILE" | head -20)
    log_warn "发现待处理反馈"
  fi
fi

if [[ "$HAS_FEEDBACK" == "false" ]]; then
  SCORE_NO_FEEDBACK=15
  log_info "没有待处理反馈"
fi

# ============================================================
# [3/6] 解析截图节点并截图
# ============================================================
log_info "[3/6] 截图关键节点..."

SCREENSHOT_COUNT=0
EXPECTED_SCREENSHOTS=0
SCREENSHOT_RESULTS=()

# 从 page_content.md 解析截图节点定义
# 格式: ## 截图节点 / ## Screenshot Nodes
# - URL: https://xxx.com
# - CLI: git status
if [[ -f "$PAGE_CONTENT_FILE" ]]; then
  # 提取截图节点部分
  SCREENSHOT_SECTION=$(sed -n '/^##\s*\(截图节点\|Screenshot Nodes\|Screenshots\)/,/^##/p' "$PAGE_CONTENT_FILE" 2>/dev/null || echo "")

  if [[ -n "$SCREENSHOT_SECTION" ]]; then
    # 解析 URL 截图
    while IFS= read -r line; do
      if [[ "$line" =~ ^-[[:space:]]*URL:[[:space:]]*(.+)$ ]]; then
        URL="${BASH_REMATCH[1]}"
        URL=$(echo "$URL" | xargs)  # trim whitespace
        EXPECTED_SCREENSHOTS=$((EXPECTED_SCREENSHOTS + 1))
        SCREENSHOT_NAME="url-screenshot-$EXPECTED_SCREENSHOTS"

        log_info "截图 URL: $URL"
        if save_screenshot "$RUN_ID" "$SCREENSHOT_NAME" "$URL" 2>/dev/null; then
          SCREENSHOT_COUNT=$((SCREENSHOT_COUNT + 1))
          SCREENSHOT_RESULTS+=("✅|$SCREENSHOT_NAME|$URL")
        else
          log_warn "URL 截图失败: $URL"
          SCREENSHOT_RESULTS+=("❌|$SCREENSHOT_NAME|$URL")
        fi
      fi
    done <<< "$SCREENSHOT_SECTION"

    # 解析 CLI 命令截图 (安全白名单机制)
    # 只允许以下安全命令前缀
    ALLOWED_CLI_PREFIXES=(
      "git status"
      "git log"
      "git diff"
      "git tag"
      "npm test"
      "npm run"
      "pnpm test"
      "pnpm run"
      "docker ps"
      "docker images"
      "ls "
      "cat "
      "head "
      "tail "
    )

    while IFS= read -r line; do
      if [[ "$line" =~ ^-[[:space:]]*CLI:[[:space:]]*(.+)$ ]]; then
        CMD="${BASH_REMATCH[1]}"
        CMD=$(echo "$CMD" | xargs)  # trim whitespace
        EXPECTED_SCREENSHOTS=$((EXPECTED_SCREENSHOTS + 1))
        SCREENSHOT_NAME="cli-screenshot-$EXPECTED_SCREENSHOTS"

        # 安全检查：验证命令是否在白名单中
        CMD_ALLOWED=false
        for prefix in "${ALLOWED_CLI_PREFIXES[@]}"; do
          if [[ "$CMD" == "$prefix"* ]]; then
            CMD_ALLOWED=true
            break
          fi
        done

        if [[ "$CMD_ALLOWED" == "false" ]]; then
          log_warn "CLI 命令不在白名单中，跳过: $CMD"
          SCREENSHOT_RESULTS+=("⚠️|$SCREENSHOT_NAME|[已跳过] $CMD")
          continue
        fi

        log_info "截图 CLI 输出: $CMD"

        # 执行命令并生成 HTML 报告
        CLI_OUTPUT=$(cd "$PROJECT_DIR" && timeout 30 bash -c "$CMD" 2>&1 || echo "[命令执行失败]")
        CLI_HTML="<html><body style='background:#1e1e1e;color:#d4d4d4;font-family:monospace;padding:20px;'>
<h2 style='color:#569cd6;'>$ $CMD</h2>
<pre style='white-space:pre-wrap;'>$(echo "$CLI_OUTPUT" | head -50 | sed 's/</\&lt;/g; s/>/\&gt;/g')</pre>
</body></html>"

        # 保存 HTML 并截图
        echo "$CLI_HTML" > "$WORK_DIR/${SCREENSHOT_NAME}.html"
        if take_screenshot_file "$WORK_DIR/${SCREENSHOT_NAME}.html" "$SCREENSHOT_DIR/${SCREENSHOT_NAME}.png" "--full-page" 2>/dev/null; then
          SCREENSHOT_COUNT=$((SCREENSHOT_COUNT + 1))
          SCREENSHOT_RESULTS+=("✅|$SCREENSHOT_NAME|$CMD")
          rm -f "$WORK_DIR/${SCREENSHOT_NAME}.html"
        else
          log_warn "CLI 截图失败: $CMD"
          SCREENSHOT_RESULTS+=("❌|$SCREENSHOT_NAME|$CMD")
        fi
      fi
    done <<< "$SCREENSHOT_SECTION"
  fi
fi

# 如果没有定义截图节点，自动生成一个状态截图
if [[ $EXPECTED_SCREENSHOTS -eq 0 ]]; then
  log_info "没有定义截图节点，生成默认状态截图"
  EXPECTED_SCREENSHOTS=1

  # 生成 Feature 状态 HTML 报告
  STATUS_HTML=$(generate_result_report_html "Feature Check: $FEATURE_NAME" "$([ "$ALL_DEPS_DONE" == "true" ] && echo "✅" || echo "⚠️")" "
<div class='card'>
  <div class='card-title'>依赖任务进度</div>
  <div class='card-value'>$COMPLETED_DEPS / $TOTAL_DEPS</div>
</div>
<div class='card'>
  <div class='card-title'>版本</div>
  <div class='card-value'>$SUB_PROJECT-v$VERSION</div>
</div>
")

  if screenshot_html_report "$RUN_ID" "feature-status" "$STATUS_HTML" 2>/dev/null; then
    SCREENSHOT_COUNT=$((SCREENSHOT_COUNT + 1))
    SCREENSHOT_RESULTS+=("✅|feature-status|默认状态截图")
  fi
fi

# 计算截图分数 (满分20分)
if [[ $EXPECTED_SCREENSHOTS -gt 0 ]]; then
  SCORE_SCREENSHOTS=$((20 * SCREENSHOT_COUNT / EXPECTED_SCREENSHOTS))
fi

log_info "截图完成: $SCREENSHOT_COUNT / $EXPECTED_SCREENSHOTS"

# ============================================================
# [4/6] 打 Git Tag
# ============================================================
log_info "[4/6] 打 Git Tag..."

TAG_NAME="${SUB_PROJECT}-v${VERSION}"
TAG_SUCCESS=false
TAG_SKIPPED=false  # 标记是否因条件不满足而跳过

# 只有所有依赖任务完成且没有反馈时才打 tag
if [[ "$ALL_DEPS_DONE" == "true" && "$HAS_FEEDBACK" == "false" ]]; then
  if ! cd "$PROJECT_DIR"; then
    log_error "无法进入项目目录: $PROJECT_DIR"
    # cd 失败时不执行 git 命令，标记为跳过
    TAG_SKIPPED=true
    SCORE_GIT_TAG=0
  else
    # 检查 tag 是否已存在
    if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
      log_warn "Git tag 已存在: $TAG_NAME"
      TAG_SUCCESS=true
      SCORE_GIT_TAG=20
    else
      # 创建 tag
      if git tag -a "$TAG_NAME" -m "Feature: $FEATURE_NAME

Task ID: $TASK_ID
Completed: $COMPLETED_DEPS/$TOTAL_DEPS tasks
Quality Score: Pending

Generated by AI Factory v2" 2>/dev/null; then
        log_info "Git tag 已创建: $TAG_NAME"

        # 尝试推送 tag
        if git push origin "$TAG_NAME" 2>/dev/null; then
          log_info "Git tag 已推送到 origin"
          TAG_SUCCESS=true
          SCORE_GIT_TAG=20
        else
          log_warn "Git tag 推送失败，仅存在于本地"
          TAG_SUCCESS=true
          SCORE_GIT_TAG=15  # 本地成功但推送失败扣5分
        fi
      else
        log_error "Git tag 创建失败"
      fi
    fi
  fi
else
  log_info "跳过 Git tag (依赖未完成或有待处理反馈)"
  TAG_SKIPPED=true
  # 因条件不满足而跳过时，不扣分（重新分配权重）
  # Git Tag 的 20 分平均分配给其他维度
  SCORE_GIT_TAG=0
fi

# ============================================================
# [5/6] 生成汇总报告
# ============================================================
log_info "[5/6] 生成汇总报告..."

SCORE_REPORT=15  # 报告生成成功

# 计算总分
# 如果 Git Tag 被跳过（因依赖未完成），重新计算满分基数
if [[ "$TAG_SKIPPED" == "true" ]]; then
  # Git Tag 跳过时，总分基数变为 80 分，按比例计算
  # 其他四项满分: 30 + 20 + 15 + 15 = 80
  BASE_SCORE=$((SCORE_BLOCKED_BY + SCORE_SCREENSHOTS + SCORE_NO_FEEDBACK + SCORE_REPORT))
  # 按 80 分制换算成 100 分制
  TOTAL_SCORE=$((BASE_SCORE * 100 / 80))
  log_info "Git Tag 跳过，按 80 分制换算: $BASE_SCORE/80 → $TOTAL_SCORE/100"
else
  TOTAL_SCORE=$((SCORE_BLOCKED_BY + SCORE_SCREENSHOTS + SCORE_GIT_TAG + SCORE_NO_FEEDBACK + SCORE_REPORT))
fi

# 生成简化版 Markdown 报告（用户友好，非技术）
PASS_ICON=$([ $TOTAL_SCORE -ge 80 ] && echo "✅" || echo "❌")
PASS_TEXT=$([ $TOTAL_SCORE -ge 80 ] && echo "验收通过" || echo "待处理")

cat > "$REPORT_FILE" << EOF
# ${PASS_ICON} Feature 验收报告

**功能**: ${FEATURE_NAME}
**版本**: ${SUB_PROJECT}-v${VERSION}
**检查时间**: ${TIMESTAMP}

---

## 📋 前置任务 (${COMPLETED_DEPS}/${TOTAL_DEPS} 完成)

| 任务 | 状态 |
|------|------|
EOF

# 添加依赖任务（简化显示）
for result in "${DEP_RESULTS[@]}"; do
  IFS='|' read -r icon tid name status <<< "$result"
  # 只显示名称和状态图标，不显示技术 ID
  status_icon=$([ "$status" == "AI Done" ] || [ "$status" == "Completed" ] && echo "✅ 完成" || echo "⏳ 进行中")
  echo "| ${name:0:50} | $status_icon |" >> "$REPORT_FILE"
done

if [[ ${#DEP_RESULTS[@]} -eq 0 ]]; then
  echo "| 无前置任务 | ✅ |" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << EOF

## 🏷️ 版本标记

EOF

if [[ "$TAG_SUCCESS" == "true" ]]; then
  echo "✅ 已创建版本标记: \`${TAG_NAME}\`" >> "$REPORT_FILE"
elif [[ "$TAG_SKIPPED" == "true" ]]; then
  echo "⏸️ 版本标记待创建（等待前置任务完成）" >> "$REPORT_FILE"
else
  echo "❌ 版本标记创建失败" >> "$REPORT_FILE"
fi

if [[ "$HAS_FEEDBACK" == "true" ]]; then
  cat >> "$REPORT_FILE" << EOF

## ⚠️ 待处理反馈

有用户反馈需要处理，请查看页面中的「反馈」部分。
EOF
fi

cat >> "$REPORT_FILE" << EOF

---

**总评**: ${PASS_ICON} ${PASS_TEXT} (${TOTAL_SCORE}/100)
EOF

log_info "汇总报告已生成: $REPORT_FILE"

# ============================================================
# [6/6] 上传截图和报告到 Notion
# ============================================================
log_info "[6/6] 上传截图和报告到 Notion..."

if [[ -n "$TASK_ID" ]]; then
  # 上传截图
  if [[ -d "$SCREENSHOT_DIR" ]]; then
    upload_all_screenshots "$WORK_DIR" "$TASK_ID" || log_warn "上传截图失败"
  fi

  # 写入验收报告到 Notion 页面
  if [[ -f "$REPORT_FILE" ]]; then
    append_report_to_notion "$TASK_ID" "$REPORT_FILE" || log_warn "写入报告到 Notion 失败"
  fi
fi

# ============================================================
# 生成执行结果截图
# ============================================================
log_info "生成执行结果截图..."

RESULT_ICON=$([ $TOTAL_SCORE -ge 80 ] && echo "✅" || echo "⚠️")
RESULT_TITLE="Feature Check $([ $TOTAL_SCORE -ge 80 ] && echo "通过" || echo "未通过")"

MAIN_CONTENT="
<div class='grid'>
  <div class='card'>
    <div class='card-title'>总分</div>
    <div class='card-value'>${TOTAL_SCORE}/100</div>
  </div>
  <div class='card'>
    <div class='card-title'>依赖任务</div>
    <div class='card-value'>${COMPLETED_DEPS}/${TOTAL_DEPS}</div>
  </div>
</div>
<div class='grid'>
  <div class='card'>
    <div class='card-title'>截图</div>
    <div class='card-value'>${SCREENSHOT_COUNT}/${EXPECTED_SCREENSHOTS}</div>
  </div>
  <div class='card'>
    <div class='card-title'>Git Tag</div>
    <div class='card-value'>$([ "$TAG_SUCCESS" == "true" ] && echo "✅" || echo "❌")</div>
  </div>
</div>
<div class='card'>
  <div class='card-title'>Feature</div>
  <div class='card-value' style='font-size: 18px;'>$(html_escape "$FEATURE_NAME")</div>
</div>
<div class='card'>
  <div class='card-title'>版本</div>
  <div class='card-value'>${SUB_PROJECT}-v${VERSION}</div>
</div>
"

RESULT_HTML=$(generate_result_report_html "$RESULT_TITLE" "$RESULT_ICON" "$MAIN_CONTENT")
screenshot_html_report "$RUN_ID" "check-execute-result" "$RESULT_HTML" || log_warn "结果截图失败"

# ============================================================
# 保存结果
# ============================================================

# 判断是否成功
RESULT_SUCCESS=true
if [[ "$ALL_DEPS_DONE" == "false" ]]; then
  RESULT_SUCCESS=false
fi
if [[ $TOTAL_SCORE -lt 80 ]]; then
  RESULT_SUCCESS=false
fi

# 保存 artifacts
RESULT_ARTIFACTS=$(jq -n \
  --arg type "check" \
  --arg id "check-${RUN_ID}" \
  --arg feature "$FEATURE_NAME" \
  --arg version "$VERSION" \
  --arg tag_name "$TAG_NAME" \
  --argjson tag_success "$TAG_SUCCESS" \
  --argjson score "$TOTAL_SCORE" \
  --arg report_file "$REPORT_FILE" \
  '[{
    type: $type,
    id: $id,
    name: "Feature Check Report",
    feature: $feature,
    version: $version,
    tag_name: $tag_name,
    tag_created: $tag_success,
    score: $score,
    report_file: $report_file
  }]')

RESULT_EXTRA=$(jq -n \
  --argjson completed_deps "$COMPLETED_DEPS" \
  --argjson total_deps "$TOTAL_DEPS" \
  --argjson screenshot_count "$SCREENSHOT_COUNT" \
  --argjson expected_screenshots "$EXPECTED_SCREENSHOTS" \
  --argjson score_blocked_by "$SCORE_BLOCKED_BY" \
  --argjson score_screenshots "$SCORE_SCREENSHOTS" \
  --argjson score_git_tag "$SCORE_GIT_TAG" \
  --argjson score_no_feedback "$SCORE_NO_FEEDBACK" \
  --argjson score_report "$SCORE_REPORT" \
  --argjson total_score "$TOTAL_SCORE" \
  --argjson has_feedback "$HAS_FEEDBACK" \
  '{
    completed_deps: $completed_deps,
    total_deps: $total_deps,
    screenshot_count: $screenshot_count,
    expected_screenshots: $expected_screenshots,
    scores: {
      blocked_by: $score_blocked_by,
      screenshots: $score_screenshots,
      git_tag: $score_git_tag,
      no_feedback: $score_no_feedback,
      report: $score_report,
      total: $total_score
    },
    has_feedback: $has_feedback
  }')

export RESULT_SUCCESS RESULT_ARTIFACTS RESULT_EXTRA
save_result

# ============================================================
# 完成
# ============================================================
log_execute_end "Check"

# 如果有反馈，更新状态为 Waiting
if [[ "$HAS_FEEDBACK" == "true" ]]; then
  update_notion_status "$TASK_ID" "Waiting" || log_warn "更新状态失败"
fi

# 输出结果 JSON
jq -n \
  --argjson success "$RESULT_SUCCESS" \
  --arg feature "$FEATURE_NAME" \
  --arg version "${SUB_PROJECT}-v${VERSION}" \
  --argjson score "$TOTAL_SCORE" \
  --argjson completed_deps "$COMPLETED_DEPS" \
  --argjson total_deps "$TOTAL_DEPS" \
  --arg tag_name "$TAG_NAME" \
  --argjson tag_success "$TAG_SUCCESS" \
  --argjson has_feedback "$HAS_FEEDBACK" \
  '{
    success: $success,
    feature: $feature,
    version: $version,
    score: $score,
    completed_deps: $completed_deps,
    total_deps: $total_deps,
    tag_name: $tag_name,
    tag_created: $tag_success,
    has_feedback: $has_feedback
  }'

# 退出码
if [[ "$RESULT_SUCCESS" == "true" ]]; then
  exit 0
else
  exit 1
fi
