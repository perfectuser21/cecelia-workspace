# QA Decision

Decision: NO_RCI
Priority: P1
RepoType: Business

## Tests

| DoD Item | Method | Location |
|----------|--------|----------|
| 算法能自动选择合理的焦点 | auto | apps/core/src/brain/__tests__/focus.test.js |
| 支持手动覆盖 | auto | apps/core/src/brain/__tests__/focus.test.js |
| Decision Pack 包含焦点信息 | auto | apps/core/src/brain/__tests__/focus.test.js |

## RCI

- new: []
- update: []

## Reason

新增 Brain Focus API，属于内部工具功能增强，不涉及已有核心路径。优先级 P1，无需纳入回归契约。测试通过单元测试验证算法正确性和 API 行为即可。
