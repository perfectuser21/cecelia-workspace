---
id: qa-decision-dashboard-realtime-refresh
version: 1.0.0
created: 2026-01-31
updated: 2026-01-31
changelog:
  - 1.0.0: 初始版本
---

# QA Decision

Decision: NO_RCI
Priority: P2
RepoType: Platform

Tests:
  - dod_item: "OrchestratorPage 使用 usePolling 10s 刷新"
    method: manual
    location: manual:检查代码使用 usePolling
  - dod_item: "CeceliaOverview 使用 usePolling 30s 刷新"
    method: manual
    location: manual:检查代码无 setInterval
  - dod_item: "CeceliaRuns 使用 usePolling 5s 刷新"
    method: manual
    location: manual:检查代码无 setInterval
  - dod_item: "TypeScript 编译通过"
    method: auto
    location: auto:npx tsc --noEmit

RCI:
  new: []
  update: []

Reason: 纯前端重构，将手动 setInterval 替换为统一 usePolling hook，不改变 API 调用和数据流。不影响任何 RCI 契约。
