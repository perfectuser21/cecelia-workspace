# N8N Workflows

**⚠️ 重要通知：N8N Workflows 已迁移到独立仓库**

## 新位置

所有 N8N workflow 定义已迁移到独立仓库：

**仓库路径**: `/home/xx/dev/cecelia-workflows/`

**文档**: 
- [Cecelia Workflows 主文档](../../cecelia-workflows/README.md)
- [N8N Workflows 详细文档](../../cecelia-workflows/n8n/README.md)
- [架构说明](../../cecelia-workflows/docs/ARCHITECTURE.md)

## 为什么迁移？

将 workflows 从 Cecelia-OS 分离到独立仓库，实现：

1. **单一数据源** - 集中管理所有 workflow 定义
2. **版本控制** - 独立的 Git 历史，更清晰的版本管理
3. **多引擎支持** - 支持 N8N、代码工作流等多种类型
4. **解耦** - Cecelia-OS 只负责展示，不管理 workflows

## 迁移内容

所有 workflow 定义已迁移：
- `cecelia-launcher-v2.json`
- `cecelia-callback-handler.json`
- `devgate-nightly-push.json`
- 旧版本模板（存档）

## Cecelia-OS 的新职责

Cecelia-OS 现在只负责：
- ✅ 通过 API 展示 N8N 状态
- ✅ 展示 workflows 列表和执行历史
- ❌ 不存储 workflow 定义
- ❌ 不管理 workflow 生命周期

相关代码：
- `features/n8n/api/` - API 客户端（只做代理）
- `features/n8n/pages/` - 展示页面

## 如何管理 Workflows

```bash
# 1. 进入新仓库
cd /home/xx/dev/cecelia-workflows

# 2. 编辑 workflow
vim n8n/cecelia-launcher-v2.json

# 3. 部署到 N8N
./scripts/deploy-to-n8n.sh

# 4. Git 提交
git add .
git commit -m "更新 workflow"
git push
```

或者使用 Claude Desktop：
```
"帮我同步 cecelia workflows 到 N8N"
```

## 相关文档

- [迁移说明](../data/N8N_MIGRATION.md)
- [如何触发 Cecelia](../docs/HOW_TO_TRIGGER_CECELIA.md)
