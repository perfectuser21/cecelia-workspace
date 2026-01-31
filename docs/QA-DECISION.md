# QA Decision

Decision: NO_RCI
Priority: P1
RepoType: Business

Tests:
  - dod_item: "analyzeFailure() 归类 5 种失败类型"
    method: auto
    location: tests/brain/retry-analyzer.test.js
  - dod_item: "execution-callback 自动重试入队"
    method: auto
    location: tests/brain/retry-analyzer.test.js
  - dod_item: "autoFailTimedOutTasks 集成重试"
    method: auto
    location: tests/brain/retry-analyzer.test.js
  - dod_item: "retry-policy API"
    method: manual
    location: manual:curl GET /api/brain/retry-policy
  - dod_item: "手动重试 API"
    method: manual
    location: manual:curl POST /api/brain/tasks/:id/retry

RCI:
  new: []
  update: []

Reason: 新增失败重试模块，不涉及 Engine 核心（Hook/Gate/CI），业务逻辑用单元测试覆盖即可。
