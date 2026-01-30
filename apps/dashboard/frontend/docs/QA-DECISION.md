# QA Decision: 健康检查增强

## Decision: NO_RCI
## Priority: P1
## RepoType: Business

## 问题分类
- **类型**: Feature Enhancement
- **影响范围**: 前端健康检查页面
- **风险等级**: Low

## 测试策略

### 测试需求
| DoD 条目 | 方式 | 位置 |
|---------|------|------|
| API 类型定义更新 | auto | npm run build (类型检查) |
| 健康检查页面显示多服务状态 | manual | 访问页面查看 |
| 延迟信息显示 | manual | 查看各服务延迟 |

### Tests
- dod_item: "API 类型定义与后端一致"
  method: auto
  location: manual:npm run build 无类型错误

- dod_item: "健康检查页面显示各服务状态"
  method: manual
  location: manual:访问系统状态页面，验证 brain/workspace/quality/n8n 状态显示

- dod_item: "延迟信息正确显示"
  method: manual
  location: manual:验证各服务延迟毫秒数显示

### RCI
- new: []
- update: []

## Reason
这是前端 UI 增强任务，更新 API 类型定义以匹配后端 PR #102 的多服务健康检查响应格式，并在页面上显示各服务状态和延迟信息。无需新增回归契约，通过类型检查和手动验证即可确保正确性。
