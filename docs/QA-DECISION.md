---
id: qa-decision-kr1-intent-recognition
version: 1.0.0
created: 2026-02-01
updated: 2026-02-01
changelog:
  - 1.0.0: 初始版本（KR1 意图识别功能）
---

# QA Decision

Decision: MUST_ADD_RCI
Priority: P0
RepoType: Business

Tests:
  - dod_item: "实现至少 5 种基本意图识别：create_goal, create_task, query_goal, update_task, query_status"
    method: auto
    location: apps/core/src/brain/__tests__/intent-recognizer.test.js

  - dod_item: "单元测试准确率 >= 85%（20 个测试用例，覆盖 5 种意图）"
    method: auto
    location: apps/core/src/brain/__tests__/intent-recognizer.test.js

  - dod_item: "API 调用返回正确意图"
    method: auto
    location: apps/core/src/brain/__tests__/intent-api.test.js

  - dod_item: "能从自然语言中提取 title、priority、deadline、status 等关键字段"
    method: auto
    location: apps/core/src/brain/__tests__/entity-extractor.test.js

  - dod_item: "测试用例验证：提取实体准确性"
    method: auto
    location: apps/core/src/brain/__tests__/entity-extractor.test.js

  - dod_item: "优先级识别：支持 '重要/紧急' → P0, '普通' → P1, '不急' → P2 的映射"
    method: auto
    location: apps/core/src/brain/__tests__/entity-extractor.test.js

  - dod_item: "实现简单的上下文存储：保存最近提到的 goal/task ID"
    method: auto
    location: apps/core/src/brain/__tests__/context-manager.test.js

  - dod_item: "代词解析：用户说 '那个目标' 时，能从上下文找到最近提到的 goal_id"
    method: auto
    location: apps/core/src/brain/__tests__/context-manager.test.js

  - dod_item: "测试：连续两次调用 API，第二次输入 '给它加个任务' 能正确关联第一次创建的 goal"
    method: auto
    location: apps/core/src/brain/__tests__/intent-integration.test.js

  - dod_item: "POST /api/brain/intent 端点实现并通过手动测试"
    method: auto
    location: apps/core/src/brain/__tests__/intent-api.test.js

  - dod_item: "返回格式包含 intent、entities、confidence 字段"
    method: auto
    location: apps/core/src/brain/__tests__/intent-api.test.js

  - dod_item: "错误处理：无法识别时返回 { intent: 'unknown', confidence: 0, suggestions: [...] }"
    method: auto
    location: apps/core/src/brain/__tests__/intent-api.test.js

  - dod_item: "添加 docs/KR1-INTENT-RECOGNITION.md 说明设计和使用方法"
    method: manual
    location: manual:验证文档存在且内容完整（包含设计说明、API 使用示例、测试方法）

  - dod_item: "单元测试覆盖率 >= 80%"
    method: auto
    location: npm test -- apps/core/src/brain/__tests__/intent-recognizer.test.js --coverage

  - dod_item: "在 Brain status 中更新 KR1 progress 到 >= 50%"
    method: manual
    location: manual:调用 GET /api/brain/status 验证 KR1 进度更新

  - dod_item: "npm run qa 通过"
    method: auto
    location: npm run qa

RCI:
  new:
    - contract_id: intent_recognition_basic
      description: 意图识别核心功能回归测试
      test_cases:
        - "识别创建目标意图：'创建一个高优先级目标：完成用户系统' → create_goal"
        - "识别查询意图：'认证系统目标进展怎么样？' → query_goal"
        - "识别创建任务意图：'添加一个任务：优化登录 API 性能' → create_task"
        - "识别更新意图：'把那个任务改成已完成' → update_task"
        - "识别状态查询：'当前有哪些进行中的任务？' → query_status"

    - contract_id: entity_extraction_core
      description: 实体提取核心功能回归测试
      test_cases:
        - "提取标题和优先级：'本月完成 P0 的认证重构' → {title: '认证重构', priority: 'P0', deadline: '2026-02-28'}"
        - "优先级关键词映射：'这个很重要' → priority: P0"
        - "时间解析：'本月' → deadline: 当月最后一天"
        - "状态关键词：'已完成' → status: 'completed'"

    - contract_id: context_management_basic
      description: 上下文管理基础功能回归测试
      test_cases:
        - "上下文存储：连续两次调用，第二次能引用第一次创建的实体"
        - "代词解析：'那个目标' → 解析为最近提到的 goal_id"
        - "会话隔离：不同 session_id 不共享上下文"

    - contract_id: intent_api_contract
      description: Intent API 接口契约测试
      test_cases:
        - "POST /api/brain/intent 返回 {intent, entities, confidence}"
        - "无法识别时返回 {intent: 'unknown', confidence: 0, suggestions: [...]}"
        - "API 响应时间 < 2s（简单规则匹配）"

  update: []

Reason: KR1 是核心 Brain 功能（意图识别），P0 优先级，涉及新增 API 端点和核心逻辑，必须建立回归契约确保未来修改不破坏基础能力。
