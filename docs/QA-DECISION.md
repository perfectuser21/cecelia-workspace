# QA Decision: 迁移 Core 后端到 Monorepo + 添加 Feature Dashboard

**Task**: Core 后端迁移 + Feature Dashboard 菜单项

**Change Type**: refactor (架构迁移) + feature (新增菜单项)

---

## Decision

```yaml
Decision: NO_RCI
Priority: P1
RepoType: Business

Tests:
  - dod_item: "apps/core 目录包含完整代码"
    method: manual
    location: "manual:检查目录结构和文件完整性"

  - dod_item: "添加 /ops/features 路由"
    method: manual
    location: "manual:检查 apps/core/features/ops/index.ts"

  - dod_item: "FeatureDashboard 组件映射正确"
    method: manual
    location: "manual:检查组件路径"

  - dod_item: "TypeScript 编译通过"
    method: auto
    location: "contract:C1-001"

  - dod_item: ".gitignore 配置正确"
    method: manual
    location: "manual:检查 node_modules 等未被 track"

RCI:
  new: []
  update: []

Reason: 代码迁移 + 配置变更，添加已有组件的路由映射，无需 RCI
```

---

## Analysis

### 改动范围
- 新增：apps/core/ 整个目录（Core 后端代码迁移）
- 修改：apps/core/features/ops/index.ts（添加路由）
- 修改：.gitignore（忽略 node_modules 等）

### 测试策略
- **自动化**：TypeScript 编译验证
- **手动验证**：目录结构、路由配置、组件映射

### RCI 判定
- **NO_RCI**: 纯代码迁移 + 配置变更，功能逻辑不变

### 优先级
- **P1**: 架构重构，重要但不紧急
