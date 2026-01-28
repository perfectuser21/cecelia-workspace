# QA Decision

Decision: NO_RCI
Priority: P1
RepoType: Business

Tests:
  - dod_item: "创建 QuickActionsBar 组件"
    method: manual
    location: manual:验证按钮渲染和布局

  - dod_item: "实现 Run QA Now 按钮"
    method: manual
    location: manual:点击按钮验证 API 调用

  - dod_item: "实现 Sync Notion 按钮"
    method: manual
    location: manual:点击按钮验证同步触发

  - dod_item: "实现 Health Check 按钮"
    method: manual
    location: manual:点击按钮验证健康检查结果

  - dod_item: "创建 ConfirmDialog 组件"
    method: manual
    location: manual:验证对话框显示和交互

  - dod_item: "实现 Clear Queue 按钮（带确认）"
    method: manual
    location: manual:验证确认弹窗和清空操作

  - dod_item: "实现 Restart Worker 按钮（带确认）"
    method: manual
    location: manual:验证确认弹窗和重启操作

  - dod_item: "API: POST /api/quality/trigger/runQA"
    method: auto
    location: tests/api/quality-trigger-runqa.test.ts

  - dod_item: "API: POST /api/quality/trigger/syncNotion"
    method: auto
    location: tests/api/quality-trigger-notion.test.ts

  - dod_item: "API: POST /api/quality/trigger/healthCheck"
    method: auto
    location: tests/api/quality-trigger-health.test.ts

  - dod_item: "API: DELETE /api/quality/queue/clear"
    method: auto
    location: tests/api/quality-queue-clear.test.ts

  - dod_item: "API: POST /api/quality/worker/restart"
    method: auto
    location: tests/api/quality-worker-restart.test.ts

RCI:
  new: []
  update: []

Reason: 业务仓库的 UI 控制层功能，提供手动操作能力。前端交互以手动验证为主，API 端点需要单元测试覆盖。不涉及核心路径，无需纳入回归契约。
