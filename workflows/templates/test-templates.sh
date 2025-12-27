#!/bin/bash
#
# 模板库测试脚本
#

TEMPLATES_DIR="/home/xx/dev/n8n-workflows/templates"

echo "========================================="
echo "n8n 模板库测试"
echo "========================================="
echo

# 1. 检查目录结构
echo "[1/5] 检查目录结构..."
for template in webhook-response scheduled-task api-integration notification ssh-execution data-processing error-handling parallel-execution sub-workflow; do
  if [[ -d "$TEMPLATES_DIR/$template" ]]; then
    echo "  ✓ $template"
  else
    echo "  ✗ $template (缺失)"
  fi
done
echo

# 2. 检查 index.json
echo "[2/5] 检查 index.json..."
if [[ -f "$TEMPLATES_DIR/index.json" ]]; then
  template_count=$(jq '.templates | length' "$TEMPLATES_DIR/index.json")
  echo "  ✓ index.json 存在"
  echo "  模板数量: $template_count"

  # 验证每个模板在 index.json 中注册
  for template in webhook-response scheduled-task api-integration notification ssh-execution data-processing error-handling parallel-execution sub-workflow; do
    if jq -e ".templates[] | select(.id == \"$template\")" "$TEMPLATES_DIR/index.json" > /dev/null 2>&1; then
      echo "    ✓ $template 已注册"
    else
      echo "    ✗ $template 未在 index.json 中注册"
    fi
  done
else
  echo "  ✗ index.json 不存在"
fi
echo

# 3. 检查 template.json 文件
echo "[3/5] 检查 template.json 文件..."
for template in webhook-response scheduled-task api-integration notification ssh-execution data-processing error-handling parallel-execution sub-workflow; do
  template_file="$TEMPLATES_DIR/$template/template.json"
  if [[ -f "$template_file" ]]; then
    # 验证 JSON 格式
    if jq '.' "$template_file" > /dev/null 2>&1; then
      node_count=$(jq '.nodes | length' "$template_file")
      echo "  ✓ $template/template.json (${node_count} nodes)"
    else
      echo "  ✗ $template/template.json (无效的 JSON)"
    fi
  else
    echo "  ✗ $template/template.json (缺失)"
  fi
done
echo

# 4. 检查 README 文件
echo "[4/5] 检查 README 文件..."
for template in webhook-response scheduled-task api-integration notification ssh-execution data-processing error-handling parallel-execution sub-workflow; do
  readme_file="$TEMPLATES_DIR/$template/README.md"
  if [[ -f "$readme_file" ]]; then
    echo "  ✓ $template/README.md"
  else
    echo "  ✗ $template/README.md (缺失)"
  fi
done
echo

# 5. 检查模板变量
echo "[5/5] 检查模板变量使用..."
for template in webhook-response scheduled-task api-integration notification ssh-execution data-processing error-handling parallel-execution sub-workflow; do
  template_file="$TEMPLATES_DIR/$template/template.json"
  if [[ -f "$template_file" ]]; then
    # 检查是否使用了占位符
    if grep -q "{{" "$template_file"; then
      placeholders=$(grep -o "{{[^}]*}}" "$template_file" | sort -u | tr '\n' ' ')
      echo "  $template: $placeholders"
    else
      echo "  $template: (无占位符)"
    fi
  fi
done
echo

# 总结
echo "========================================="
echo "测试完成"
echo "========================================="
echo
echo "查看详细文档:"
echo "  - 总览: $TEMPLATES_DIR/README.md"
echo "  - 快速参考: $TEMPLATES_DIR/QUICK_REFERENCE.md"
echo "  - 示例: $TEMPLATES_DIR/EXAMPLES.md"
echo
echo "使用方式:"
echo "  curl -X POST 'https://zenithjoy21xx.app.n8n.cloud/webhook/workflow-factory' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"prd\": \"创建 API\", \"template\": \"webhook-response\"}'"
