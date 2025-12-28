#!/bin/bash
#
# 截图工具函数
# 负责：截图、上传到 Notion、发送飞书通知
#
# 依赖: screenshot.mjs (puppeteer)
#

SCREENSHOT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCREENSHOT_NODE_SCRIPT="$SCREENSHOT_SCRIPT_DIR/screenshot.mjs"

# ============================================================
# 截图函数
# ============================================================

# 对 URL 截图
# 参数: $1=url, $2=output_path, [$3=options]
# 返回: 0=成功, 非0=失败
# 输出: JSON 结果
take_screenshot_url() {
  local url="$1"
  local output="$2"
  local options="${3:-}"

  if [[ -z "$url" || -z "$output" ]]; then
    echo '{"success": false, "error": "缺少 URL 或输出路径"}'
    return 1
  fi

  # 确保 node_modules 存在
  if [[ ! -d "$SCREENSHOT_SCRIPT_DIR/node_modules" ]]; then
    log_warn "截图依赖未安装，尝试安装..."
    (cd "$SCREENSHOT_SCRIPT_DIR" && npm install --silent) || {
      echo '{"success": false, "error": "无法安装截图依赖"}'
      return 1
    }
  fi

  # 执行截图
  node "$SCREENSHOT_NODE_SCRIPT" "$url" "$output" $options
}

# 对本地 HTML 文件截图
# 参数: $1=html_path, $2=output_path, [$3=options]
take_screenshot_file() {
  local html_path="$1"
  local output="$2"
  local options="${3:-}"

  if [[ -z "$html_path" || -z "$output" ]]; then
    echo '{"success": false, "error": "缺少文件路径或输出路径"}'
    return 1
  fi

  # 确保 node_modules 存在
  if [[ ! -d "$SCREENSHOT_SCRIPT_DIR/node_modules" ]]; then
    log_warn "截图依赖未安装，尝试安装..."
    (cd "$SCREENSHOT_SCRIPT_DIR" && npm install --silent) || {
      echo '{"success": false, "error": "无法安装截图依赖"}'
      return 1
    }
  fi

  # 执行截图
  node "$SCREENSHOT_NODE_SCRIPT" --file "$html_path" "$output" $options
}

# ============================================================
# Notion 上传函数
# ============================================================

# 上传图片到 Notion 页面
# 参数: $1=page_id, $2=image_path, [$3=caption]
# 返回: 0=成功, 非0=失败
# 环境变量: TEST_MODE=1 时跳过实际上传
upload_to_notion() {
  local page_id="$1"
  local image_path="$2"
  local caption="${3:-Screenshot}"

  if [[ -z "$page_id" || -z "$image_path" ]]; then
    log_error "缺少 page_id 或 image_path"
    return 1
  fi

  if [[ ! -f "$image_path" ]]; then
    log_error "图片文件不存在: $image_path"
    return 1
  fi

  # TEST_MODE: 跳过实际上传
  if [[ "${TEST_MODE:-}" == "1" ]]; then
    log_info "[TEST_MODE] 模拟上传图片到 Notion: $image_path"
    return 0
  fi

  # 加载 secrets
  load_secrets

  if [[ -z "$NOTION_API_KEY" ]]; then
    log_error "NOTION_API_KEY 未设置"
    return 1
  fi

  # Notion API 不支持直接上传图片，需要先上传到外部服务
  # 这里使用 imgbb 作为临时图床（免费）
  # 或者可以配置其他图床服务

  # 如果没有配置图床，记录本地路径
  if [[ -z "$IMGBB_API_KEY" ]]; then
    log_warn "未配置图床，截图保存在本地: $image_path"

    # 在 Notion 页面添加一条提示（使用 jq 构建 JSON 防止注入）
    local json_payload
    json_payload=$(jq -n \
      --arg msg "$caption: 截图已保存到服务器 $image_path" \
      '{
        children: [{
          object: "block",
          type: "callout",
          callout: {
            rich_text: [{type: "text", text: {content: $msg}}],
            icon: {type: "emoji", emoji: "📸"}
          }
        }]
      }')

    curl -sf -X PATCH "https://api.notion.com/v1/blocks/$page_id/children" \
      -H "Authorization: Bearer $NOTION_API_KEY" \
      -H "Notion-Version: 2022-06-28" \
      -H "Content-Type: application/json" \
      -d "$json_payload" > /dev/null 2>&1

    return 0
  fi

  # 上传到 imgbb
  log_info "上传图片到 imgbb..."
  local upload_result
  upload_result=$(curl -sf -X POST "https://api.imgbb.com/1/upload" \
    -F "key=$IMGBB_API_KEY" \
    -F "image=@$image_path" 2>/dev/null)

  if [[ -z "$upload_result" ]]; then
    log_error "上传图片失败"
    return 1
  fi

  local image_url=$(echo "$upload_result" | jq -r '.data.url // empty')
  if [[ -z "$image_url" ]]; then
    log_error "获取图片 URL 失败"
    return 1
  fi

  log_info "图片已上传: $image_url"

  # 在 Notion 页面添加图片（使用 jq 构建 JSON 防止注入）
  local json_payload
  json_payload=$(jq -n \
    --arg url "$image_url" \
    --arg cap "$caption" \
    '{
      children: [{
        object: "block",
        type: "image",
        image: {
          type: "external",
          external: {url: $url},
          caption: [{type: "text", text: {content: $cap}}]
        }
      }]
    }')

  curl -sf -X PATCH "https://api.notion.com/v1/blocks/$page_id/children" \
    -H "Authorization: Bearer $NOTION_API_KEY" \
    -H "Notion-Version: 2022-06-28" \
    -H "Content-Type: application/json" \
    -d "$json_payload" > /dev/null 2>&1

  if [[ $? -eq 0 ]]; then
    log_info "图片已添加到 Notion 页面"
    return 0
  else
    log_error "添加图片到 Notion 失败"
    return 1
  fi
}

# ============================================================
# 飞书图片通知
# ============================================================

# 发送带图片的飞书通知
# 参数: $1=title, $2=image_path, [$3=description]
# 环境变量: TEST_MODE=1 时跳过实际发送
send_feishu_image() {
  local title="$1"
  local image_path="$2"
  local description="${3:-}"

  if [[ -z "$title" || -z "$image_path" ]]; then
    log_error "缺少标题或图片路径"
    return 1
  fi

  # TEST_MODE: 跳过实际发送
  if [[ "${TEST_MODE:-}" == "1" ]]; then
    log_info "[TEST_MODE] 模拟发送飞书图片: $title"
    return 0
  fi

  load_secrets

  if [[ -z "$FEISHU_BOT_WEBHOOK" ]]; then
    log_warn "FEISHU_BOT_WEBHOOK 未设置，跳过图片通知"
    return 0
  fi

  # 飞书机器人不支持直接上传图片，需要图床 URL
  # 如果没有图床，发送文本通知说明图片位置
  if [[ -z "$IMGBB_API_KEY" ]]; then
    send_feishu_notification "📸 $title\n$description\n\n截图路径: $image_path"
    return 0
  fi

  # 上传到 imgbb
  local upload_result
  upload_result=$(curl -sf -X POST "https://api.imgbb.com/1/upload" \
    -F "key=$IMGBB_API_KEY" \
    -F "image=@$image_path" 2>/dev/null)

  local image_url=$(echo "$upload_result" | jq -r '.data.url // empty')

  if [[ -z "$image_url" ]]; then
    # 上传失败，发送文本通知
    send_feishu_notification "📸 $title\n$description\n\n截图路径: $image_path"
    return 0
  fi

  # 飞书卡片消息中的 img 元素需要 img_key（需要先上传到飞书获取）
  # 由于飞书图片上传 API 需要 app_id/app_secret，这里改用富文本消息嵌入外部图片链接
  # 或者发送包含图片链接的 Markdown 格式卡片

  # 使用 jq 构建 JSON 防止注入
  local json_payload
  json_payload=$(jq -n \
    --arg title "$title" \
    --arg desc "$description" \
    --arg url "$image_url" \
    --arg link_text "**截图链接**: [$title]($url)" \
    '{
      msg_type: "interactive",
      card: {
        header: {
          title: {tag: "plain_text", content: ("📸 " + $title)},
          template: "blue"
        },
        elements: [
          {tag: "div", text: {tag: "lark_md", content: $desc}},
          {tag: "div", text: {tag: "lark_md", content: ("**截图链接**: [" + $title + "](" + $url + ")")}},
          {
            tag: "action",
            actions: [{
              tag: "button",
              text: {tag: "plain_text", content: "查看截图"},
              type: "primary",
              url: $url
            }]
          }
        ]
      }
    }')

  curl -sf -X POST "$FEISHU_BOT_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "$json_payload" > /dev/null 2>&1

  log_info "飞书图片通知已发送（链接形式）"
}

# ============================================================
# 批量截图（运行目录下所有截图）
# ============================================================

# 上传运行目录下所有截图到 Notion
# 参数: $1=run_dir, $2=page_id
upload_all_screenshots() {
  local run_dir="$1"
  local page_id="$2"
  local screenshots_dir="$run_dir/screenshots"

  if [[ ! -d "$screenshots_dir" ]]; then
    log_info "没有截图目录"
    return 0
  fi

  local count=0
  # 启用 nullglob 避免空目录时循环处理字面量模式
  shopt -s nullglob
  for img in "$screenshots_dir"/*.png; do
    local caption=$(basename "$img" .png)
    upload_to_notion "$page_id" "$img" "$caption"
    count=$((count + 1))
  done
  shopt -u nullglob

  log_info "已上传 $count 张截图到 Notion"
}

# ============================================================
# 便捷函数（供 execute 脚本使用）
# ============================================================

# 保存截图到运行目录
# 用法: save_screenshot <run_id> <name> <url_or_html_path> [--file] [options]
# 参数:
#   run_id           - 运行 ID
#   name             - 截图名称（不含扩展名）
#   url_or_html_path - URL 或 HTML 文件路径
#   --file           - 如果是本地文件，加上此参数
#   options          - 其他截图选项
#
# 示例:
#   save_screenshot "$RUN_ID" "workflow-result" "https://n8n.cloud/workflow/xxx"
#   save_screenshot "$RUN_ID" "test-report" "./report.html" --file --full-page
save_screenshot() {
  local run_id="$1"
  local name="$2"
  local target="$3"
  shift 3
  local is_file=false
  local options=""

  # 解析参数
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --file)
        is_file=true
        shift
        ;;
      *)
        options="$options $1"
        shift
        ;;
    esac
  done

  # 创建截图目录
  local screenshots_dir="/home/xx/data/runs/$run_id/screenshots"
  mkdir -p "$screenshots_dir"

  local output_path="$screenshots_dir/${name}.png"
  local result

  if [[ "$is_file" == "true" ]]; then
    result=$(take_screenshot_file "$target" "$output_path" "$options")
  else
    result=$(take_screenshot_url "$target" "$output_path" "$options")
  fi

  # 检查结果
  if echo "$result" | jq -e '.success == true' > /dev/null 2>&1; then
    log_info "截图已保存: $output_path"
    echo "$output_path"
    return 0
  else
    local error=$(echo "$result" | jq -r '.error // "未知错误"')
    log_error "截图失败: $error"
    return 1
  fi
}

# 生成 HTML 报告并截图
# 用法: screenshot_html_report <run_id> <name> <html_content>
# 参数:
#   run_id       - 运行 ID
#   name         - 截图名称
#   html_content - HTML 内容
screenshot_html_report() {
  local run_id="$1"
  local name="$2"
  local html_content="$3"

  local run_dir="/home/xx/data/runs/$run_id"
  local html_path="$run_dir/${name}.html"
  local screenshots_dir="$run_dir/screenshots"

  mkdir -p "$screenshots_dir"

  # 写入 HTML 文件
  echo "$html_content" > "$html_path"

  # 截图
  local output_path="$screenshots_dir/${name}.png"
  local result=$(take_screenshot_file "$html_path" "$output_path" "--full-page")

  if echo "$result" | jq -e '.success == true' > /dev/null 2>&1; then
    log_info "报告截图已保存: $output_path"
    # 清理临时 HTML
    rm -f "$html_path"
    echo "$output_path"
    return 0
  else
    local error=$(echo "$result" | jq -r '.error // "未知错误"')
    log_error "报告截图失败: $error"
    return 1
  fi
}

# ============================================================
# 导出函数
# ============================================================
export -f take_screenshot_url take_screenshot_file
export -f upload_to_notion upload_all_screenshots
export -f send_feishu_image
export -f save_screenshot screenshot_html_report
