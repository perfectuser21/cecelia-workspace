
### [2026-01-19] Autopilot 导航结构重构

**任务**: 将侧边栏从按 Feature 分组改为按场景分组（工作台/新媒体运营/设置）

**Bug**: 无严重问题

**技术要点**:
1. `MediaScenarioPage` 使用 React Router 的嵌套 `<Routes>` 实现内部 Tab 路由
2. 场景页内部子路由通过 `path="content/*"` 方式捕获，避免路由冲突
3. 旧路由使用 `additionalRoutes` 配置重定向保持兼容性

**优化点**:
1. PR Gate Hook 的 `.quality-report.json` 格式需要严格遵循（layers.L1_automated 等字段名）
2. 开发环境需要飞书 OAuth 才能验证登录后的 UI，建议增加 mock 登录功能

**影响程度**: Low

---

### [2026-01-19] AI 员工功能 - n8n 工作流抽象

**任务**: 将 n8n 工作流抽象成「AI 员工」概念，按部门组织展示

**Bug**: 无严重问题

**技术要点**:
1. 使用 `workflowKeywords` 数组匹配工作流名称到员工职能
2. API 聚合层复用 n8n-live-status API，按员工 ID 过滤和统计
3. 员工卡片组件支持展开/收起交互，显示职能范围和最近任务

**优化点**:
1. PR Gate Hook 的质检报告格式要求 `layers.L1_automated.status` 等字段，初次容易写错
2. auto-backup 会在写代码过程中自动提交，可能导致 commit 历史混乱，建议在开始前暂停 auto-backup
3. 前端页面需要登录才能验证效果，Layer 2 验证受限

**影响程度**: Low
