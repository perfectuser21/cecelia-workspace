---
id: qa-decision-kr1-intent-recognition
version: 1.0.0
created: 2026-02-01
updated: 2026-02-01
changelog:
  - 1.0.0: 初始版本 — KR1 意图识别 QA 决策
---

# QA Decision

Decision: MUST_ADD_RCI
Priority: P0
RepoType: Business

Tests:
  - dod_item: "实现 POST /api/brain/recognize-intent API 端点"
    method: auto
    location: apps/core/src/brain/__tests__/intent-recognition.test.js

  - dod_item: "识别 create_objective 意图"
    method: auto
    location: apps/core/src/brain/__tests__/intent-recognition.test.js

  - dod_item: "识别 create_key_result 意图"
    method: auto
    location: apps/core/src/brain/__tests__/intent-recognition.test.js

  - dod_item: "识别 create_project 意图"
    method: auto
    location: apps/core/src/brain/__tests__/intent-recognition.test.js

  - dod_item: "识别 create_task 意图"
    method: auto
    location: apps/core/src/brain/__tests__/intent-recognition.test.js

  - dod_item: "识别 query_status 意图"
    method: auto
    location: apps/core/src/brain/__tests__/intent-recognition.test.js

  - dod_item: "从自然语言提取实体（title、priority、type）"
    method: auto
    location: apps/core/src/brain/__tests__/intent-recognition.test.js

  - dod_item: "置信度 < 0.6 时返回 ambiguities 字段"
    method: auto
    location: apps/core/src/brain/__tests__/intent-recognition.test.js

  - dod_item: "返回结构化 JSON (intent, confidence, entities, suggested_action)"
    method: auto
    location: apps/core/src/brain/__tests__/intent-recognition.test.js

  - dod_item: "单元测试覆盖率 > 80%"
    method: auto
    location: apps/core/src/brain/__tests__/intent-recognition.test.js

  - dod_item: "手动测试 10 个自然语言输入"
    method: manual
    location: manual:测试 10 个案例并记录到 docs/KR1-TEST-RESULTS.md，验证至少 8 个识别正确

  - dod_item: "CI 通过"
    method: auto
    location: manual:检查 GitHub Actions 所有 jobs 为绿色

  - dod_item: "文档完整性"
    method: manual
    location: manual:验证 docs/KR1-INTENT-RECOGNITION.md 包含意图类型、实体提取规则、API 示例、已知限制

RCI:
  new:
    - id: INTENT-001
      name: "意图识别 API 回归测试"
      priority: P0
      trigger: [PR, Release]
      method: auto
      steps:
        given: "Cecelia Core 服务运行中"
        when: "调用 POST /api/brain/recognize-intent"
        then: "正确识别意图类型并返回置信度、实体、建议动作"
      test: "npm test -- apps/core/src/brain/__tests__/intent-recognition.test.js"

  update: []

Reason: P0 核心功能，实现自然语言到结构化任务的转换，是 Cecelia 自驱进化的关键能力。新增意图识别 API 需要回归契约确保稳定性。优先使用自动化测试（单元测试覆盖），部分场景需要手动验证（多样化自然语言输入）。
