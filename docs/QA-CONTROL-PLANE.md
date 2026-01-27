# QA Control Plane

> 跨 Repo 质检管理已迁移到 `cecelia-quality` 独立 repo

## 📍 Control Plane 位置

**Repo**: [cecelia-quality](https://github.com/ZenithJoycloud/cecelia-quality)
**路径**: `/home/xx/dev/cecelia-quality/control-plane/`

## 为什么在 cecelia-quality？

1. ✅ **独立版本控制** - Control Plane 的演进历史需要追踪
2. ✅ **跨 Repo 共享** - 所有业务 repos 引用同一份契约
3. ✅ **清晰职责** - Quality 的东西在 Quality repo
4. ✅ **权限管理** - QA 团队独立管理，不混在业务 repo

## cecelia-workspace 的角色

作为业务 repo，cecelia-workspace 只需要：

1. **执行测试**：运行 `npm run qa`
2. **产出 evidence**：生成 `.qa-evidence.json`
3. **引用契约**：从 cecelia-quality 读取 regression-contract

## 使用方式

### 1. 执行质检

```bash
# 在 cecelia-workspace 中
# 脚本位于 cecelia-quality，通过符号链接引用
bash scripts/qa-run-all.sh pr

# 查看 evidence
cat .qa-evidence.json
```

### 2. 查看契约

```bash
# cecelia-workspace 的回归契约定义在：
cat /home/xx/dev/cecelia-quality/contracts/cecelia-workspace.regression-contract.yaml
```

### 3. 查看策略规则

```bash
# commit → TestStrategy 映射规则：
cat /home/xx/dev/cecelia-quality/control-plane/qa-policy.yaml
```

## 架构关系

```
cecelia-quality/  (单一真相源)
├── control-plane/
│   ├── repo-registry.yaml      # 注册所有 Repos
│   ├── qa-policy.yaml          # 测试策略
│   └── schemas/
│       └── qa-evidence.schema.json
└── contracts/
    └── cecelia-workspace.regression-contract.yaml  # 本 repo 的契约

cecelia-workspace/  (业务 repo)
├── 执行测试（npm run qa）
├── 产出 evidence（.qa-evidence.json）
└── 文档（docs/）
    ├── VERSION-QA-INTEGRATION.md
    ├── CROSS-REPO-QA-ARCHITECTURE.md
    └── QA-CONTROL-PLANE.md（本文件）

Core API (cecelia-workspace/apps/core)
├── 收集 evidence
└── 提供 /api/qa/* 端点（Phase 1）

Dashboard (cecelia-workspace/apps/dashboard)
└── 展示 evidence（Phase 2）
```

## 相关文档

- [VERSION-QA-INTEGRATION.md](./VERSION-QA-INTEGRATION.md) - 版本管理与 QA 系统集成分析
- [CROSS-REPO-QA-ARCHITECTURE.md](./CROSS-REPO-QA-ARCHITECTURE.md) - 跨 Repo QA 完整架构
- [cecelia-quality README](https://github.com/ZenithJoycloud/cecelia-quality/blob/develop/control-plane/README.md)

## 下一步（Phase 1-4）

- **Phase 1**：Core API（/api/qa/execute, /api/qa/sync）
- **Phase 2**：Dashboard MVP（Repos 总览 / RCI 状态墙 / Run 执行中心）
- **Phase 3**：sync/query 扩展
- **Phase 4**：趋势分析
