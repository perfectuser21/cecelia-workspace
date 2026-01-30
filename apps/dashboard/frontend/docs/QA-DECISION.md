# QA Decision: 性能监控 API 封装

## Decision: NO_RCI
## Priority: P1
## RepoType: Business

## 问题分类
- **类型**: Feature Enhancement / Code Refactor
- **影响范围**: 前端性能监控页面、API 层
- **风险等级**: Low

## 测试策略

### 测试需求
| DoD 条目 | 方式 | 位置 |
|---------|------|------|
| system.api.ts 创建 | auto | npm run build (类型检查) |
| PerformanceMonitoring 使用新 API | auto | npm run build |
| API 文档更新 | manual | 检查 docs/API.md |

### Tests
- dod_item: "创建 system.api.ts 封装系统指标 API"
  method: auto
  location: manual:npm run build 无类型错误

- dod_item: "PerformanceMonitoring.tsx 使用封装的 API"
  method: auto
  location: manual:npm run build 通过

- dod_item: "API 文档包含 System API"
  method: manual
  location: manual:检查 docs/API.md System API 章节

### RCI
- new: []
- update: []

## Reason
这是前端代码重构任务，将性能监控页面的直接 fetch 调用改为使用封装的 API 模块，符合项目的 API 调用规范。改动局限于前端，不影响后端逻辑，通过 TypeScript 类型检查和构建验证即可确保正确性。无需新增回归契约。
