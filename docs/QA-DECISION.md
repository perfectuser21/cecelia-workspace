# QA Decision

Decision: UPDATE_RCI
Priority: P1
RepoType: Business

## Tests

| DoD Item | Method | Location |
|----------|--------|----------|
| GET /api/okr/trees 返回所有顶层 Objectives | auto | apps/core/src/okr/__tests__/trees.test.js |
| GET /api/okr/trees/:id 返回完整 OKR 树 | auto | apps/core/src/okr/__tests__/trees.test.js |
| POST /api/okr/trees 一次性创建 O + 多个 KR | auto | apps/core/src/okr/__tests__/trees.test.js |
| PUT /api/okr/trees/:id 支持添加/删除 KR | auto | apps/core/src/okr/__tests__/trees.test.js |
| DELETE /api/okr/trees/:id 级联删除 O 及其 KR | auto | apps/core/src/okr/__tests__/trees.test.js |

## RCI

- new: []
- update: [RCI-TASK-001]

## Reason

OKR Tree API 在 PRD 01 的数据模型基础上提供树形 CRUD 操作，复用现有 goals 表，需要更新回归契约保护新 API 端点。
