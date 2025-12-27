# Bundle 机制

## 概述

Bundle 是一组相关 Workflow 的集合，作为一个整体进行版本控制和部署。

## 目录结构

```
workflows/
├── bundles/
│   ├── nightly-maintenance/
│   │   ├── bundle.json
│   │   ├── scheduler.json
│   │   ├── health-check.json
│   │   ├── backup.json
│   │   └── cleanup.json
│   ├── data-collection/
│   ├── ai-factory/
│   └── content-publish/
├── shared/
│   └── claude-executor/
│       ├── version.json
│       └── workflow.json
├── scripts/
│   ├── lock.sh
│   └── quality-check.sh
├── docs/
│   ├── FACTORY.md
│   ├── BUNDLE.md
│   └── WORKFLOW.md
└── bundle-manager.sh
```

## bundle.json 格式

```json
{
  "name": "nightly-maintenance",
  "description": "夜间维护任务调度",
  "bundle_version": "1.0.0",
  "components": {
    "scheduler": {
      "n8n_id": "YFqEplFiSl5Qd3x9",
      "version": "1.0.0",
      "file": "scheduler.json"
    },
    "health-check": {
      "n8n_id": "wqeeHpnTcJolnse4",
      "version": "1.0.0",
      "file": "health-check.json"
    }
  },
  "dependencies": {
    "shared/claude-executor": "1.0.0"
  },
  "changelog": [
    {
      "version": "1.0.0",
      "date": "2025-12-26",
      "changes": ["初始导入"]
    }
  ]
}
```

## Shared 组件

跨 Bundle 复用的 Workflow 放在 `shared/` 目录：

```json
// shared/claude-executor/version.json
{
  "name": "claude-executor",
  "version": "1.0.0",
  "n8n_id": "JhHc95ZUfnUhKV4Y",
  "description": "Claude Code SSH 执行器",
  "used_by": ["ai-factory"]
}
```

## 版本控制

### 语义化版本

- `MAJOR.MINOR.PATCH`
- MAJOR: 不兼容的改动
- MINOR: 新功能，向后兼容
- PATCH: Bug 修复

### Git Tag

每个 Bundle 有独立的 tag：

```
nightly-maintenance-v1.0.0
ai-factory-v1.0.0
shared/claude-executor-v1.0.0
```

## bundle-manager.sh 命令

```bash
# 列出所有 Bundle
./bundle-manager.sh list

# 查看 Bundle 详情
./bundle-manager.sh info nightly-maintenance

# 从 n8n 同步到本地
./bundle-manager.sh sync nightly-maintenance

# 部署到 n8n（自动处理依赖）
./bundle-manager.sh deploy nightly-maintenance

# 部署 Shared 组件
./bundle-manager.sh deploy-shared claude-executor

# 查看哪些 Bundle 依赖某个 Shared
./bundle-manager.sh dependents claude-executor

# 版本升级
./bundle-manager.sh bump nightly-maintenance patch

# 回滚到指定版本
./bundle-manager.sh rollback nightly-maintenance 1.0.0

# 激活/停用 Bundle 中所有 Workflow
./bundle-manager.sh activate nightly-maintenance
./bundle-manager.sh deactivate nightly-maintenance
```

## 部署逻辑

```
deploy bundle-name
    ↓
1. 检查依赖（shared 组件）
   ├── 有未部署的依赖 → 先部署依赖
   └── 依赖版本不匹配 → 警告
    ↓
2. 逐个部署组件
   ├── 有 n8n_id → PUT 更新
   └── 无 n8n_id → POST 创建 → 写入 n8n_id
    ↓
3. n8n_id 有变化 → 自动 git commit
```

## 锁机制

防止多个 Claude 实例同时修改同一个 Bundle。

### 使用方式

```bash
# 获取锁（阻塞等待）
./scripts/lock.sh acquire bundle-nightly-maintenance

# 执行操作...

# 释放锁
./scripts/lock.sh release bundle-nightly-maintenance
```

### 持锁执行

```bash
# 自动获取锁、执行命令、释放锁
./scripts/lock.sh with bundle-ai-factory ./update-bundle.sh
```

### 锁状态

```bash
# 查看所有锁
./scripts/lock.sh status

# 清理过期锁
./scripts/lock.sh cleanup
```

### 配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| LOCK_TIMEOUT | 300s | 等待锁的超时时间 |
| STALE_THRESHOLD | 600s | 超过此时间的锁视为死锁 |

### 死锁检测

- 持锁进程死亡 → 自动释放
- 锁超过 10 分钟 → 视为死锁，强制释放

## Git Commit 规范

```
feat: add {workflow_name} workflow

- Bundle: {bundle_name}
- Task: {notion_task_url}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

## 现有 Bundle

| Bundle | 组件数 | 说明 |
|--------|--------|------|
| nightly-maintenance | 4 | 夜间调度器 + 健康检查 + 备份 + 清理 |
| data-collection | 10 | 各平台数据爬取 |
| ai-factory | 2 | AI 工厂生产线 |
| content-publish | 2 | 内容发布系统 |

---

## 更新记录

| 日期 | 变更描述 |
|------|----------|
| 2025-12-26 | 初始创建：定义 Bundle 结构、版本控制、锁机制 |
| 2025-12-26 | 添加 bundle-manager.sh deploy 增强（ID 保留、依赖处理） |
| 2025-12-26 | 添加 lock.sh 脚本及锁机制文档 |
