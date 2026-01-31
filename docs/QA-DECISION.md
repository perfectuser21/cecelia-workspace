---
id: qa-decision-tick-dispatch
version: 1.0.0
created: 2026-01-31
updated: 2026-01-31
changelog:
  - 1.0.0: 初始版本
---

# QA Decision - Tick Dispatch

## Decision Summary

```yaml
Decision: NO_RCI
Priority: P0
RepoType: Engine
```

## Tests

| DoD Item | Method | Location |
|----------|--------|----------|
| dispatchNextTask 选择正确任务 | auto | apps/core/src/brain/__tests__/tick-dispatch.test.js |
| 并发限制 | auto | tick-dispatch.test.js |
| 依赖跳过 | auto | tick-dispatch.test.js |
| 超时检测 | auto | tick-dispatch.test.js |
| callback 回写 | auto | tick-dispatch.test.js |

## Reason

Tick dispatch 是 Brain 内部调度机制，不改变外部 API 契约。只在 executeTick() 中新增 dispatch 阶段，复用现有 executor.js。
