---
id: qa-decision-kr1-intent-recognition
version: 1.0.0
created: 2026-02-01
updated: 2026-02-01
changelog:
  - 1.0.0: 初始版本（KR1 意图识别功能）
---

# QA Decision

Decision: NO_RCI
Priority: P0
RepoType: Business

Tests:
  - dod_item: "API 端点 POST /api/brain/intent/parse 可以接收自然语言输入并返回意图分类结果"
    method: auto
    location: apps/core/src/brain/__tests__/intent.test.js

  - dod_item: "能正确识别至少 3 种意图类型:CREATE_GOAL, CREATE_PROJECT, CREATE_TASK"
    method: auto
    location: apps/core/src/brain/__tests__/intent.test.js

  - dod_item: "能从自然语言中提取实体字段:title, description, priority"
    method: auto
    location: apps/core/src/brain/__tests__/intent.test.js

  - dod_item: "对于明确的输入(如'创建项目:用户登录'),准确率达到 90%"
    method: auto
    location: apps/core/src/brain/__tests__/intent.test.js

  - dod_item: "有完整的单元测试覆盖意图分类和实体提取逻辑"
    method: auto
    location: apps/core/src/brain/__tests__/intent.test.js

  - dod_item: "npm run test --workspace=apps/core 通过"
    method: auto
    location: apps/core/package.json (test script: vitest run)

RCI:
  new: []
  update: []

Reason: 这是新增业务功能(意图识别服务),不涉及核心 Engine 机制(Hook/Gate/CI),仓库无 regression-contract.yaml,属于 Business 类型,所有功能可通过单元测试和 API 集成测试自动化验证,不需要回归契约。
