---
id: n8n-migration
version: 1.0.0
created: 2026-01-25
updated: 2026-01-25
changelog:
  - 1.0.0: N8N workflows 迁移到独立仓库
---

# N8N Workflows 迁移说明

## 迁移日期

2026-01-25

## 迁移原因

将 N8N workflows 从 Cecelia-OS 和 autopilot 中分离到独立仓库 `cecelia-workflows`，实现：

1. **单一数据源** - 所有 workflow 定义集中管理
2. **版本控制** - 独立的 Git 历史
3. **多引擎支持** - 不仅支持 N8N，还可以支持代码工作流
4. **解耦** - Cecelia-OS 和 autopilot 只负责展示，不管理 workflows

## 新架构

```
cecelia-workflows (独立仓库)
    ↓ 唯一的定义源
N8N Container / Cecelia Bridge
    ↓ 只负责执行
Cecelia-OS / autopilot
    ↓ 只负责展示（API 代理）
```

## 迁移内容

### 已迁移

- ✅ `data/n8n-templates/*.json` → `cecelia-workflows/n8n/archive/`
- ✅ `workflows/n8n/cecelia/prd-executor.json` → `cecelia-workflows/n8n/archive/`
- ✅ 当前活跃的 3 个 workflows:
  - `cecelia-launcher-v2.json`
  - `cecelia-callback-handler.json`
  - `devgate-nightly-push.json`

### 保留

- ✅ `features/n8n/` - API 客户端（只做代理，不存储数据）
- ✅ `features/n8n/pages/` - 展示页面

## 新仓库位置

**Git 仓库**: `/home/xx/dev/cecelia-workflows/`

**GitHub**: （待创建）

**文档**: 
- `/home/xx/dev/cecelia-workflows/README.md`
- `/home/xx/dev/cecelia-workflows/n8n/README.md`
- `/home/xx/dev/cecelia-workflows/docs/ARCHITECTURE.md`

## 如何管理 N8N Workflows

### 方式 1: 使用 cecelia-manage skill

```bash
# 在 Claude Desktop 中
"帮我同步 cecelia workflows 到 N8N"
"帮我创建一个新的 N8N workflow"
```

### 方式 2: 直接操作仓库

```bash
cd /home/xx/dev/cecelia-workflows

# 编辑 workflow
vim n8n/cecelia-launcher-v2.json

# 部署到 N8N
./scripts/deploy-to-n8n.sh

# 从 N8N 导出（备份）
./scripts/backup-from-n8n.sh

# Git 提交
git add .
git commit -m "更新 cecelia-launcher-v2"
git push
```

## Cecelia-OS 的职责

**只做展示，不做管理**：

- ✅ 通过 API 查询 N8N 状态
- ✅ 展示 workflows 列表
- ✅ 展示执行历史
- ❌ 不存储 workflow 定义
- ❌ 不管理 workflow 生命周期

## 相关文档

- [Cecelia Workflows 架构](../../cecelia-workflows/docs/ARCHITECTURE.md)
- [N8N Workflows 文档](../../cecelia-workflows/n8n/README.md)
- [如何触发 Cecelia](./docs/HOW_TO_TRIGGER_CECELIA.md)
