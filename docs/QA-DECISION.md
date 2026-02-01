# QA Decision

Decision: NO_RCI
Priority: P1
RepoType: Business

Tests:
  - dod_item: "API 端点 /api/intent/parse 能够接收 POST 请求，参数包含 text 字段"
    method: auto
    location: tests/api/intent.test.ts
  - dod_item: "能够识别 create_task 意图类型（输入'我想创建一个任务'时返回 create_task）"
    method: auto
    location: tests/lib/intent-parser.test.ts
  - dod_item: "能够识别 query_status 意图类型（输入'查看当前任务状态'时返回 query_status）"
    method: auto
    location: tests/lib/intent-parser.test.ts
  - dod_item: "能够识别 update_progress 意图类型（输入'更新任务进度到50%'时返回 update_progress）"
    method: auto
    location: tests/lib/intent-parser.test.ts
  - dod_item: "对于 create_task 意图，能够提取标题、优先级（P0/P1/P2）"
    method: auto
    location: tests/lib/intent-parser.test.ts
  - dod_item: "对于 create_task 意图，能够关联当前 Brain 状态中的 current_focus 项目"
    method: auto
    location: tests/api/intent.test.ts
  - dod_item: "API 返回包含：intent_type、confidence、entities、suggested_action"
    method: auto
    location: tests/api/intent.test.ts
  - dod_item: "API 响应时间 < 500ms（不含 LLM 调用）"
    method: auto
    location: tests/api/intent.test.ts
  - dod_item: "边界情况：空字符串输入返回错误提示"
    method: auto
    location: tests/api/intent.test.ts
  - dod_item: "边界情况：模糊输入返回低置信度 + 建议澄清"
    method: auto
    location: tests/lib/intent-parser.test.ts
  - dod_item: "npm run qa 通过"
    method: auto
    location: contract:C2-001
  - dod_item: "TypeScript 类型检查通过"
    method: auto
    location: npm run build

RCI:
  new: []
  update: []

Reason: 这是业务仓库的新功能开发（意图识别API），不涉及核心 Hook/Gate/CI 系统，且为 P1 优先级，所有功能均可通过单元测试和现有回归契约覆盖，无需添加或更新 RCI。
