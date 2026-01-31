---
id: qa-decision-kr1-advance
version: 1.0.0
created: 2026-02-01
updated: 2026-02-01
changelog:
  - 1.0.0: 初始版本（KR1 意图识别功能开发）
---

# QA Decision

Decision: NO_RCI
Priority: P0
RepoType: Business

Tests:
  - dod_item: "能够识别创建任务的意图"
    method: auto
    location: apps/core/src/brain/__tests__/intent.test.js

  - dod_item: "能够识别创建目标的意图"
    method: auto
    location: apps/core/src/brain/__tests__/intent.test.js

  - dod_item: "能够识别创建项目的意图"
    method: auto
    location: apps/core/src/brain/__tests__/intent.test.js

  - dod_item: "分类准确率：在测试集上达到 80% 以上"
    method: auto
    location: apps/core/src/brain/__tests__/intent.test.js

  - dod_item: "能够提取标题"
    method: auto
    location: apps/core/src/brain/__tests__/intent.test.js

  - dod_item: "能够提取描述"
    method: auto
    location: apps/core/src/brain/__tests__/intent.test.js

  - dod_item: "能够提取优先级"
    method: auto
    location: apps/core/src/brain/__tests__/intent.test.js

  - dod_item: "能够提取时间范围"
    method: auto
    location: apps/core/src/brain/__tests__/intent.test.js

  - dod_item: "实体提取覆盖率：至少 70% 的输入能成功提取标题"
    method: auto
    location: apps/core/src/brain/__tests__/intent.test.js

  - dod_item: "POST /api/intent/parse 端点正常响应"
    method: auto
    location: apps/core/src/routes/api/__tests__/intent.test.ts

  - dod_item: "返回格式包含 type/entities/confidence"
    method: auto
    location: apps/core/src/routes/api/__tests__/intent.test.ts

  - dod_item: "错误情况返回合理的错误信息和状态码"
    method: auto
    location: apps/core/src/routes/api/__tests__/intent.test.ts

  - dod_item: "API 响应时间 < 500ms (p95)"
    method: auto
    location: apps/core/src/routes/api/__tests__/intent.test.ts

  - dod_item: "单元测试通过率 > 90%"
    method: auto
    location: apps/core/src/brain/__tests__/intent.test.js

  - dod_item: "集成测试覆盖主要场景"
    method: auto
    location: apps/core/src/routes/api/__tests__/intent.test.ts

  - dod_item: "至少包含 10 个真实场景的测试用例"
    method: manual
    location: manual:检查 apps/core/src/brain/__tests__/intent.test.js 和 apps/core/src/routes/api/__tests__/intent.test.ts 总共包含至少 10 个测试用例

  - dod_item: "npm run qa 通过"
    method: auto
    location: CI pipeline

  - dod_item: "在 docs/ 目录创建 INTENT-RECOGNITION.md 文档"
    method: manual
    location: manual:检查文件 /home/xx/dev/cecelia-workspace-wt--Retry-Advance-KR1-OKR-Project/docs/INTENT-RECOGNITION.md 存在

  - dod_item: "文档包含功能说明、API使用示例、支持的短语模式、扩展方法"
    method: manual
    location: manual:审查 docs/INTENT-RECOGNITION.md 内容完整性

  - dod_item: "代码中关键函数有清晰的 JSDoc 注释"
    method: manual
    location: manual:审查 apps/core/src/brain/intent.js 和 apps/core/src/routes/api/intent.ts 的代码注释质量

RCI:
  new: []
  update: []

Reason: 此任务是业务功能开发（意图识别API），不涉及核心引擎（Hook/Gate/CI），所有验收标准均可通过单元测试和集成测试自动化验证，文档相关项目通过人工审查，无需新增或更新回归契约。
