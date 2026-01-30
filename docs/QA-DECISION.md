# QA Decision - Phase 5.1 Memory Schema

Decision: NO_RCI
Priority: P1
RepoType: Business

## Tests

| DoD Item | Method | Location |
|----------|--------|----------|
| 定义 MemoryEntry 表结构 | manual | manual: SQL migration verification |
| POST /api/brain/memory 带验证 | auto | tests/memory.test.ts |
| GET /api/brain/memory 过滤查询 | auto | tests/memory.test.ts |
| 兼容旧 set-memory action | auto | tests/memory.test.ts |

## RCI

new: []
update: []

## Reason

Memory Schema 是新功能，不涉及现有核心路径的回归。属于 Phase 5 智能层基座，优先级 P1。API 兼容性通过测试保证，无需纳入全量回归契约。
