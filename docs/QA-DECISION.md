---
id: qa-decision-core-frontend-restructure
version: 1.1.0
created: 2026-01-31
updated: 2026-01-31
changelog:
  - 1.1.0: 修正 RepoType/Priority/RCI，补充测试项
  - 1.0.0: 初始版本
---

# QA Decision

Decision: NO_RCI
Priority: P0
RepoType: Engine

Tests:
  - dod_item: "npm run build 通过"
    method: manual
    location: manual:运行 npm run build 确认无错误
  - dod_item: "6 条线导航显示"
    method: manual
    location: manual:localhost:5212 截图验证
  - dod_item: "GET /api/areas 返回 9 个 Area"
    method: manual
    location: manual:curl http://localhost:5212/api/areas | jq length
  - dod_item: "旧路由 redirect 正确"
    method: manual
    location: manual:访问 /planning 验证 redirect 到 /planner
  - dod_item: "Dashboard Area 卡片显示"
    method: manual
    location: manual:localhost:5212 截图验证 Area 卡片
  - dod_item: "Console 无 Error"
    method: manual
    location: manual:打开 DevTools Console 确认无红色错误
  - dod_item: "projects 查询不受影响"
    method: manual
    location: manual:curl http://localhost:5212/api/tasks/projects 返回正常

RCI:
  new: []
  update: []

Reason: 前端目录重组 + 后端新增 areas 表。areas 表是全新表无迁移风险，area_id 是 nullable 字段不影响现有查询。NO_RCI 因为不涉及回归契约覆盖的核心功能（Hook/Gate/CI）。
