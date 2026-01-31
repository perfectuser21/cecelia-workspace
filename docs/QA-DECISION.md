---
id: qa-decision-tick-auto-loop
version: 1.0.0
created: 2026-01-31
updated: 2026-01-31
changelog:
  - 1.0.0: 初始版本
---

# QA Decision - Tick Auto Loop

## Decision Summary

```yaml
Decision: NO_RCI
Priority: P0
RepoType: Engine
```

## Tests

| DoD Item | Method | Location |
|----------|--------|----------|
| startTickLoop 启动循环 | auto | apps/core/src/brain/__tests__/tick-loop.test.js |
| stopTickLoop 停止循环 | auto | apps/core/src/brain/__tests__/tick-loop.test.js |
| 防重入锁 | auto | apps/core/src/brain/__tests__/tick-loop.test.js |
| 超时释放 | auto | apps/core/src/brain/__tests__/tick-loop.test.js |
| getTickStatus 返回 loop_running | auto | apps/core/src/brain/__tests__/tick-loop.test.js |

## RCI Impact

```yaml
new: []
update: []
```

## Reason

tick 循环是 Brain 内部机制增强，不改变任何外部 API 契约。现有 API 端点行为不变，只是 enable/disable 时联动启停内部定时器。

## Test Strategy

1. **Unit Tests**: 测试循环启停、防重入、超时
2. **No E2E**: 内部机制，无前端界面
