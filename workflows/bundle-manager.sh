#!/bin/bash
#
# Bundle Manager - n8n Workflow 版本控制工具
# 用法: bundle-manager.sh <command> [options]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKFLOWS_DIR="$SCRIPT_DIR"
BUNDLES_DIR="$WORKFLOWS_DIR/bundles"
SHARED_DIR="$WORKFLOWS_DIR/shared"
REPO_DIR="$(dirname "$WORKFLOWS_DIR")"

# 加载 API Key
source "$REPO_DIR/.secrets" 2>/dev/null || true

# API 配置（可通过环境变量覆盖）
N8N_API_URL="${N8N_API_URL:-https://zenithjoy21xx.app.n8n.cloud/api/v1}"
N8N_API_KEY="${N8N_API_KEY:-$N8N_REST_API_KEY}"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m'

# 输出函数
log() { echo -e "${BLUE}[bundle]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }
error_noexit() { echo -e "${RED}✗${NC} $1"; }
tree_line() { echo -e "${GRAY}  │${NC}   $1"; }
tree_item() { echo -e "${GRAY}  ├──${NC} $1"; }
tree_last() { echo -e "${GRAY}  └──${NC} $1"; }

# ============================================================
# API 辅助函数
# ============================================================
api_get() {
  local endpoint="$1"
  curl -sf "$N8N_API_URL$endpoint" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Accept: application/json"
}

api_post() {
  local endpoint="$1"
  local data="$2"
  curl -sf -X POST "$N8N_API_URL$endpoint" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$data"
}

api_put() {
  local endpoint="$1"
  local data="$2"
  curl -sf -X PUT "$N8N_API_URL$endpoint" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$data"
}

api_patch() {
  local endpoint="$1"
  local data="$2"
  curl -sf -X PATCH "$N8N_API_URL$endpoint" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$data"
}

# ============================================================
# 命令: list - 列出所有 bundles
# ============================================================
cmd_list() {
  echo "=== Bundles ==="
  for bundle_dir in "$BUNDLES_DIR"/*/; do
    if [[ -f "${bundle_dir}bundle.json" ]]; then
      local name=$(jq -r '.name' "${bundle_dir}bundle.json")
      local version=$(jq -r '.bundle_version' "${bundle_dir}bundle.json")
      local components=$(jq -r '.components | keys | length' "${bundle_dir}bundle.json")
      echo "  $name (v$version) - $components 个组件"
    fi
  done

  echo ""
  echo "=== Shared 组件 ==="
  for shared_dir in "$SHARED_DIR"/*/; do
    if [[ -f "${shared_dir}version.json" ]]; then
      local name=$(jq -r '.name' "${shared_dir}version.json")
      local version=$(jq -r '.version' "${shared_dir}version.json")
      local n8n_id=$(jq -r '.n8n_id // "未部署"' "${shared_dir}version.json")
      echo "  $name (v$version) [n8n: $n8n_id]"
    fi
  done
}

# ============================================================
# 命令: info - 显示 bundle 详情
# ============================================================
cmd_info() {
  local bundle_name="$1"

  if [[ -z "$bundle_name" ]]; then
    error "用法: bundle-manager.sh info <bundle>"
  fi

  local bundle_dir="$BUNDLES_DIR/$bundle_name"

  if [[ ! -f "${bundle_dir}/bundle.json" ]]; then
    error "Bundle '$bundle_name' 不存在"
  fi

  echo "=== Bundle: $bundle_name ==="
  jq '.' "${bundle_dir}/bundle.json"
}

# ============================================================
# 命令: sync - 从 n8n 同步 workflow 到本地
# ============================================================
cmd_sync() {
  local bundle_name="$1"

  if [[ -z "$bundle_name" ]]; then
    error "用法: bundle-manager.sh sync <bundle>"
  fi

  local bundle_dir="$BUNDLES_DIR/$bundle_name"

  if [[ ! -f "${bundle_dir}/bundle.json" ]]; then
    error "Bundle '$bundle_name' 不存在"
  fi

  log "同步 bundle: $bundle_name"

  # 读取 components
  local components=$(jq -r '.components | to_entries[] | "\(.key)|\(.value.n8n_id)"' "${bundle_dir}/bundle.json")

  while IFS='|' read -r comp_name n8n_id; do
    if [[ -n "$n8n_id" && "$n8n_id" != "null" ]]; then
      local result=$(api_get "/workflows/$n8n_id" 2>/dev/null)
      if [[ -n "$result" ]]; then
        echo "$result" | jq '{name, nodes, connections, settings}' > "${bundle_dir}/${comp_name}.json"
        success "$comp_name ($n8n_id)"
      else
        error_noexit "$comp_name: 获取失败 ($n8n_id)"
      fi
    else
      warn "$comp_name: 无 n8n_id，跳过"
    fi
  done <<< "$components"

  log "同步完成"
}

# ============================================================
# 命令: deploy - 部署 bundle 到 n8n（增强版）
# ============================================================
cmd_deploy() {
  local bundle_name="$1"

  if [[ -z "$bundle_name" ]]; then
    error "用法: bundle-manager.sh deploy <bundle>"
  fi

  local bundle_dir="$BUNDLES_DIR/$bundle_name"
  local bundle_file="${bundle_dir}/bundle.json"

  if [[ ! -f "$bundle_file" ]]; then
    error "Bundle '$bundle_name' 不存在"
  fi

  # 验证 bundle.json 格式
  if ! jq empty "$bundle_file" 2>/dev/null; then
    error "bundle.json 格式错误"
  fi

  local version=$(jq -r '.bundle_version' "$bundle_file")
  local ids_updated=false

  echo ""
  echo -e "Deploying bundle: ${BLUE}$bundle_name${NC} (v$version)"
  echo ""

  # Step 1: 检查并部署 dependencies (shared 组件)
  tree_item "Checking dependencies..."

  local deps=$(jq -r '.dependencies // {} | to_entries[] | "\(.key)|\(.value)"' "$bundle_file" 2>/dev/null)

  if [[ -n "$deps" ]]; then
    while IFS='|' read -r dep_path dep_version; do
      if [[ -z "$dep_path" ]]; then continue; fi

      # 解析 shared/xxx 格式
      local shared_name="${dep_path#shared/}"
      local shared_dir="$SHARED_DIR/$shared_name"
      local shared_version_file="$shared_dir/version.json"

      if [[ ! -f "$shared_version_file" ]]; then
        error "Shared 组件 '$shared_name' 不存在，请先创建"
      fi

      local shared_n8n_id=$(jq -r '.n8n_id // ""' "$shared_version_file")

      if [[ -z "$shared_n8n_id" || "$shared_n8n_id" == "null" ]]; then
        # 需要先部署 shared 组件
        tree_line "└── $dep_path: 未部署，正在创建..."

        local shared_workflow_file="$shared_dir/workflow.json"
        if [[ ! -f "$shared_workflow_file" ]]; then
          error "Shared 组件 '$shared_name' 缺少 workflow.json"
        fi

        local create_result=$(api_post "/workflows" "$(cat "$shared_workflow_file")" 2>&1)
        if [[ $? -ne 0 ]]; then
          error "创建 shared 组件失败: $create_result"
        fi

        shared_n8n_id=$(echo "$create_result" | jq -r '.id')

        # 更新 shared/version.json
        jq --arg id "$shared_n8n_id" '.n8n_id = $id' "$shared_version_file" > "${shared_version_file}.tmp"
        mv "${shared_version_file}.tmp" "$shared_version_file"

        tree_line "    Created (n8n_id: $shared_n8n_id)"
      else
        tree_line "└── $dep_path: OK (n8n_id: $shared_n8n_id)"
      fi
    done <<< "$deps"
  else
    tree_line "└── 无依赖"
  fi

  # Step 2: 部署 components
  local components=$(jq -r '.components | to_entries[] | "\(.key)|\(.value.n8n_id // "")"' "$bundle_file")
  local comp_count=$(echo "$components" | wc -l)
  local comp_idx=0

  while IFS='|' read -r comp_name n8n_id; do
    if [[ -z "$comp_name" ]]; then continue; fi

    comp_idx=$((comp_idx + 1))
    local json_file="${bundle_dir}/${comp_name}.json"

    # 判断是否是最后一个
    if [[ $comp_idx -eq $comp_count ]]; then
      tree_last "Deploying $comp_name..."
    else
      tree_item "Deploying $comp_name..."
    fi

    if [[ ! -f "$json_file" ]]; then
      tree_line "└── 跳过 (无 workflow.json)"
      continue
    fi

    if [[ -n "$n8n_id" && "$n8n_id" != "null" ]]; then
      # 更新现有 workflow (PUT)
      local update_result=$(api_put "/workflows/$n8n_id" "$(cat "$json_file")" 2>&1)
      if [[ $? -ne 0 ]]; then
        error "更新 $comp_name 失败: $update_result"
      fi
      tree_line "└── Updated (n8n_id: $n8n_id)"
    else
      # 创建新 workflow (POST)
      local create_result=$(api_post "/workflows" "$(cat "$json_file")" 2>&1)
      if [[ $? -ne 0 ]]; then
        error "创建 $comp_name 失败: $create_result"
      fi

      local new_id=$(echo "$create_result" | jq -r '.id')

      # 更新 bundle.json 中的 n8n_id
      jq --arg comp "$comp_name" --arg id "$new_id" \
        '.components[$comp].n8n_id = $id' "$bundle_file" > "${bundle_file}.tmp"
      mv "${bundle_file}.tmp" "$bundle_file"

      ids_updated=true
      tree_line "└── Created (n8n_id: $new_id) ← 新创建"
    fi
  done <<< "$components"

  echo ""
  tree_last "Done!"
  echo ""

  # Step 3: 如果有 ID 更新，自动 git commit
  if [[ "$ids_updated" == "true" ]]; then
    echo "Updated bundle.json with new IDs"

    git -C "$REPO_DIR" add "$bundle_file"
    git -C "$REPO_DIR" commit -m "chore: update n8n IDs for $bundle_name" --no-verify 2>/dev/null || true

    success "Committed: chore: update n8n IDs for $bundle_name"
  fi
}

# ============================================================
# 命令: deploy-shared - 部署单个 shared 组件
# ============================================================
cmd_deploy_shared() {
  local shared_name="$1"

  if [[ -z "$shared_name" ]]; then
    error "用法: bundle-manager.sh deploy-shared <shared_component>"
  fi

  local shared_dir="$SHARED_DIR/$shared_name"
  local version_file="$shared_dir/version.json"
  local workflow_file="$shared_dir/workflow.json"

  if [[ ! -f "$version_file" ]]; then
    error "Shared 组件 '$shared_name' 不存在"
  fi

  if [[ ! -f "$workflow_file" ]]; then
    error "Shared 组件 '$shared_name' 缺少 workflow.json"
  fi

  local n8n_id=$(jq -r '.n8n_id // ""' "$version_file")

  echo ""
  echo -e "Deploying shared: ${BLUE}$shared_name${NC}"
  echo ""

  if [[ -n "$n8n_id" && "$n8n_id" != "null" ]]; then
    # 更新
    local result=$(api_put "/workflows/$n8n_id" "$(cat "$workflow_file")" 2>&1)
    if [[ $? -ne 0 ]]; then
      error "更新失败: $result"
    fi
    success "Updated (n8n_id: $n8n_id)"
  else
    # 创建
    local result=$(api_post "/workflows" "$(cat "$workflow_file")" 2>&1)
    if [[ $? -ne 0 ]]; then
      error "创建失败: $result"
    fi

    n8n_id=$(echo "$result" | jq -r '.id')

    # 更新 version.json
    jq --arg id "$n8n_id" '.n8n_id = $id' "$version_file" > "${version_file}.tmp"
    mv "${version_file}.tmp" "$version_file"

    success "Created (n8n_id: $n8n_id)"

    # Git commit
    git -C "$REPO_DIR" add "$version_file"
    git -C "$REPO_DIR" commit -m "chore: update n8n ID for shared/$shared_name" --no-verify 2>/dev/null || true
  fi
}

# ============================================================
# 命令: dependents - 查找依赖某 shared 组件的 bundles
# ============================================================
cmd_dependents() {
  local shared_name="$1"

  if [[ -z "$shared_name" ]]; then
    error "用法: bundle-manager.sh dependents <shared_component>"
  fi

  # 支持 shared/xxx 和 xxx 两种格式
  shared_name="${shared_name#shared/}"
  local dep_key="shared/$shared_name"

  echo "=== Bundles depending on $dep_key ==="
  echo ""

  local found=false

  for bundle_dir in "$BUNDLES_DIR"/*/; do
    if [[ -f "${bundle_dir}bundle.json" ]]; then
      local bundle_name=$(jq -r '.name' "${bundle_dir}bundle.json")
      local dep_version=$(jq -r --arg key "$dep_key" '.dependencies[$key] // empty' "${bundle_dir}bundle.json")

      if [[ -n "$dep_version" ]]; then
        echo "  • $bundle_name (requires v$dep_version)"
        found=true
      fi
    fi
  done

  if [[ "$found" == "false" ]]; then
    echo "  (无)"
  fi

  echo ""

  # 显示当前 shared 组件版本
  local shared_dir="$SHARED_DIR/$shared_name"
  if [[ -f "$shared_dir/version.json" ]]; then
    local current_version=$(jq -r '.version' "$shared_dir/version.json")
    local n8n_id=$(jq -r '.n8n_id // "未部署"' "$shared_dir/version.json")
    echo "Current version: v$current_version (n8n_id: $n8n_id)"
  fi
}

# ============================================================
# 命令: bump - 升级版本号
# ============================================================
cmd_bump() {
  local bundle_name="$1"
  local bump_type="${2:-patch}"  # major, minor, patch

  if [[ -z "$bundle_name" ]]; then
    error "用法: bundle-manager.sh bump <bundle> [major|minor|patch]"
  fi

  local bundle_dir="$BUNDLES_DIR/$bundle_name"
  local bundle_file="${bundle_dir}/bundle.json"

  if [[ ! -f "$bundle_file" ]]; then
    error "Bundle '$bundle_name' 不存在"
  fi

  local current_version=$(jq -r '.bundle_version' "$bundle_file")
  IFS='.' read -r major minor patch <<< "$current_version"

  case "$bump_type" in
    major) major=$((major + 1)); minor=0; patch=0 ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    patch) patch=$((patch + 1)) ;;
    *) error "无效的版本类型: $bump_type (可选: major, minor, patch)" ;;
  esac

  local new_version="${major}.${minor}.${patch}"
  local today=$(date +%Y-%m-%d)

  # 更新 bundle.json
  jq --arg v "$new_version" --arg d "$today" \
    '.bundle_version = $v | .changelog = [{"version": $v, "date": $d, "change": "版本升级"}] + .changelog' \
    "$bundle_file" > "${bundle_file}.tmp" && mv "${bundle_file}.tmp" "$bundle_file"

  success "$bundle_name: v$current_version → v$new_version"

  # 创建 git tag
  local tag_name="${bundle_name}-v${new_version}"
  git -C "$REPO_DIR" add "$bundle_dir"
  git -C "$REPO_DIR" commit -m "chore($bundle_name): bump to v$new_version" --no-verify || true
  git -C "$REPO_DIR" tag -a "$tag_name" -m "Bundle $bundle_name v$new_version"

  success "Git tag: $tag_name"
}

# ============================================================
# 命令: rollback - 回滚到指定版本
# ============================================================
cmd_rollback() {
  local bundle_name="$1"
  local target_version="$2"

  if [[ -z "$bundle_name" ]]; then
    error "用法: bundle-manager.sh rollback <bundle> <version>"
  fi

  if [[ -z "$target_version" ]]; then
    echo "用法: bundle-manager.sh rollback <bundle> <version>"
    echo ""
    echo "可用版本:"
    git -C "$REPO_DIR" tag -l "${bundle_name}-v*" | sort -V
    exit 1
  fi

  local tag_name="${bundle_name}-v${target_version}"
  local bundle_dir="$BUNDLES_DIR/$bundle_name"

  # 检查 tag 是否存在
  if ! git -C "$REPO_DIR" rev-parse "$tag_name" &>/dev/null; then
    error "Tag '$tag_name' 不存在"
  fi

  log "回滚 $bundle_name 到 v$target_version"

  # 恢复文件
  git -C "$REPO_DIR" checkout "$tag_name" -- "workflows/bundles/$bundle_name/"

  success "已恢复到 v$target_version"
  warn "运行 'bundle-manager.sh deploy $bundle_name' 部署到 n8n"
}

# ============================================================
# 命令: diff - 对比本地和 n8n 的差异
# ============================================================
cmd_diff() {
  local bundle_name="$1"

  if [[ -z "$bundle_name" ]]; then
    error "用法: bundle-manager.sh diff <bundle>"
  fi

  local bundle_dir="$BUNDLES_DIR/$bundle_name"

  if [[ ! -f "${bundle_dir}/bundle.json" ]]; then
    error "Bundle '$bundle_name' 不存在"
  fi

  log "对比 bundle: $bundle_name"

  local components=$(jq -r '.components | to_entries[] | "\(.key)|\(.value.n8n_id // "")"' "${bundle_dir}/bundle.json")

  while IFS='|' read -r comp_name n8n_id; do
    if [[ -z "$comp_name" ]]; then continue; fi

    local local_file="${bundle_dir}/${comp_name}.json"

    if [[ ! -f "$local_file" ]]; then
      echo "  $comp_name: 本地文件不存在 ⚠"
      continue
    fi

    if [[ -z "$n8n_id" || "$n8n_id" == "null" ]]; then
      echo "  $comp_name: 未部署到 n8n"
      continue
    fi

    # 获取远程版本
    local remote_json=$(api_get "/workflows/$n8n_id" 2>/dev/null | jq '{name, nodes, connections, settings}')

    if [[ -z "$remote_json" ]]; then
      echo "  $comp_name: 获取远程失败 ⚠"
      continue
    fi

    local local_hash=$(jq -Sc '.' "$local_file" | md5sum | cut -d' ' -f1)
    local remote_hash=$(echo "$remote_json" | jq -Sc '.' | md5sum | cut -d' ' -f1)

    if [[ "$local_hash" == "$remote_hash" ]]; then
      echo "  $comp_name: 一致 ✓"
    else
      echo "  $comp_name: 有差异 ⚠"
    fi
  done <<< "$components"
}

# ============================================================
# 命令: activate - 激活 bundle 中所有 workflows
# ============================================================
cmd_activate() {
  local bundle_name="$1"

  if [[ -z "$bundle_name" ]]; then
    error "用法: bundle-manager.sh activate <bundle>"
  fi

  local bundle_dir="$BUNDLES_DIR/$bundle_name"
  local bundle_file="${bundle_dir}/bundle.json"

  if [[ ! -f "$bundle_file" ]]; then
    error "Bundle '$bundle_name' 不存在"
  fi

  log "激活 bundle: $bundle_name"

  local components=$(jq -r '.components | to_entries[] | "\(.key)|\(.value.n8n_id // "")"' "$bundle_file")

  while IFS='|' read -r comp_name n8n_id; do
    if [[ -z "$comp_name" || -z "$n8n_id" || "$n8n_id" == "null" ]]; then
      continue
    fi

    local result=$(api_patch "/workflows/$n8n_id" '{"active": true}' 2>&1)
    if [[ $? -eq 0 ]]; then
      success "$comp_name: 已激活"
    else
      error_noexit "$comp_name: 激活失败"
    fi
  done <<< "$components"
}

# ============================================================
# 主入口
# ============================================================
show_help() {
  cat << 'EOF'
Bundle Manager - n8n Workflow 版本控制工具

用法: bundle-manager.sh <command> [options]

Bundle 命令:
  list                      列出所有 bundles 和 shared 组件
  info <bundle>             显示 bundle 详情
  sync <bundle>             从 n8n 同步到本地
  deploy <bundle>           部署到 n8n（自动处理依赖）
  bump <bundle> [type]      升级版本 (major/minor/patch)
  rollback <bundle> <ver>   回滚到指定版本
  diff <bundle>             对比本地和 n8n 差异
  activate <bundle>         激活所有 workflows

Shared 组件命令:
  deploy-shared <name>      部署单个 shared 组件
  dependents <name>         查找依赖此组件的 bundles

示例:
  bundle-manager.sh list
  bundle-manager.sh deploy ai-factory
  bundle-manager.sh bump nightly-maintenance minor
  bundle-manager.sh rollback nightly-maintenance 1.0.0
  bundle-manager.sh dependents claude-executor

环境变量:
  N8N_API_URL   n8n API 地址 (默认: https://zenithjoy21xx.app.n8n.cloud/api/v1)
  N8N_API_KEY   n8n API Key
EOF
}

# 检查必要的工具
check_deps() {
  if ! command -v jq &>/dev/null; then
    error "需要安装 jq"
  fi
  if ! command -v curl &>/dev/null; then
    error "需要安装 curl"
  fi
  if [[ -z "$N8N_API_KEY" ]]; then
    error "未设置 N8N_API_KEY，请检查 .secrets 文件或环境变量"
  fi
}

case "${1:-}" in
  list) cmd_list ;;
  info) cmd_info "$2" ;;
  sync) check_deps; cmd_sync "$2" ;;
  deploy) check_deps; cmd_deploy "$2" ;;
  deploy-shared) check_deps; cmd_deploy_shared "$2" ;;
  dependents) cmd_dependents "$2" ;;
  bump) cmd_bump "$2" "$3" ;;
  rollback) cmd_rollback "$2" "$3" ;;
  diff) check_deps; cmd_diff "$2" ;;
  activate) check_deps; cmd_activate "$2" ;;
  -h|--help|help|"") show_help ;;
  *) error_noexit "未知命令: $1"; show_help; exit 1 ;;
esac
