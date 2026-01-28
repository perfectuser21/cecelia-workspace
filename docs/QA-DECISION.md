# QA Decision

Decision: MUST_ADD_RCI
Priority: P1
RepoType: Business

## Tests

| DoD Item | Method | Location |
|----------|--------|----------|
| goals 表包含 parent_id, type, weight 字段 | auto | apps/core/src/task-system/__tests__/goals.test.js |
| 可以创建 Objective 和关联的 Key Results | auto | apps/core/src/task-system/__tests__/goals.test.js |
| 更新 KR 进度时 O 进度自动更新 | auto | apps/core/src/task-system/__tests__/goals.test.js |
| API 返回层级结构 | auto | apps/core/src/task-system/__tests__/goals.test.js |

## RCI

- new: [RCI-TASK-001]
- update: []

## Reason

OKR 层级是任务管理系统的核心功能扩展，影响数据模型和 API，需要回归保护确保 O→KR 关系和自动进度计算不被破坏。
