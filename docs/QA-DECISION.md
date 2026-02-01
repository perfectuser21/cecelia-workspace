# QA Decision

Decision: MUST_ADD_RCI
Priority: P0
RepoType: Business

Tests:
  - dod_item: "POST /api/intent/recognize 端点可访问，返回 200 状态码"
    method: auto
    location: tests/api/intent-api.test.ts
  - dod_item: "GET /api/intent/health 端点返回 healthy 状态"
    method: auto
    location: tests/api/intent-api.test.ts
  - dod_item: "curl 测试成功返回 JSON 响应（符合 IntentRecognitionResult 类型）"
    method: manual
    location: manual:使用 curl POST /api/intent/recognize -d '{"text":"创建目标"}' 并验证 JSON 格式
  - dod_item: "能识别 '创建目标：完成 KR1' 并返回 create-goal action"
    method: auto
    location: tests/api/intent-api.test.ts
  - dod_item: "能识别 '查看所有待办任务' 并返回 query-tasks action"
    method: auto
    location: tests/api/intent-api.test.ts
  - dod_item: "API 响应时间 < 500ms"
    method: manual
    location: manual:使用 curl 测试并记录响应时间
  - dod_item: "现有测试通过：npm run test -- intent-recognition.test.ts"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts
  - dod_item: "集成测试通过：tests/api/intent-api.test.ts 中的所有测试用例通过（包括 POST /recognize、GET /health、意图识别功能验证）"
    method: auto
    location: tests/api/intent-api.test.ts

RCI:
  new:
    - contract_id: kr1-intent-api-integration
      description: "KR1 意图识别 API 集成回归测试"
      priority: P0
      tests:
        - tests/api/intent-api.test.ts
        - apps/core/src/__tests__/intent-recognition.test.ts
      scenarios:
        - name: "Intent API 端点可访问性"
          steps:
            - "POST /api/intent/recognize 返回 200"
            - "GET /api/intent/health 返回 healthy 状态"
        - name: "意图识别功能正确性"
          steps:
            - "识别创建目标意图并返回正确 action"
            - "识别查询任务意图并返回正确 action"
            - "响应时间符合性能要求 (< 500ms)"
        - name: "单元测试覆盖"
          steps:
            - "Intent Recognition Service 单元测试全部通过"
            - "NLP Parser 工具函数测试全部通过"
  update: []

Reason: KR1 是核心功能（意图识别是整个 Brain 系统的关键能力），P0 优先级，需要添加回归契约确保未来修改不会破坏该功能。
