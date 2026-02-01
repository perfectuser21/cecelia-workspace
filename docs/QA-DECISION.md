# QA Decision - KR1 Intent Recognition API

## Metadata
- **Decision**: NO_RCI
- **Priority**: P1
- **RepoType**: Engine
- **ChangeType**: feature
- **Date**: 2026-02-01

## Tests

### 自动化测试
- **dod_item**: "API 端点 POST /api/intent/recognize 实现并可正确识别 Goal/Project/Task 意图"
  - method: auto
  - location: apps/core/tests/intent-api.test.ts

- **dod_item**: "实体提取功能实现"
  - method: auto
  - location: apps/core/tests/intent-recognizer.test.ts

- **dod_item**: "置信度评估功能实现"
  - method: auto
  - location: apps/core/tests/intent-recognizer.test.ts

- **dod_item**: "关联推理功能实现"
  - method: auto
  - location: apps/core/tests/intent-recognizer.test.ts

- **dod_item**: "实体提取准确率 > 85%"
  - method: auto
  - location: apps/core/tests/intent-recognizer.test.ts

- **dod_item**: "单元测试覆盖主要场景（至少 10 个测试用例）"
  - method: auto
  - location: apps/core/tests/intent-recognizer.test.ts

- **dod_item**: "API 响应格式符合规范"
  - method: auto
  - location: apps/core/tests/intent-api.test.ts

- **dod_item**: "错误处理完善"
  - method: auto
  - location: apps/core/tests/intent-api.test.ts

### 手动测试
- **dod_item**: "日志记录完整"
  - method: manual
  - location: manual:查看控制台日志输出

- **dod_item**: "npm run typecheck 通过"
  - method: manual
  - location: manual:运行命令验证

- **dod_item**: "npm run lint 通过"
  - method: manual
  - location: manual:运行命令验证

- **dod_item**: "API 使用说明文档更新"
  - method: manual
  - location: manual:检查 docs/ 目录

## RCI
- **new**: []
- **update**: []

## Reason
新增功能且为独立 API 模块，不影响现有回归路径，使用完整单元测试覆盖即可。

## Golden Path Impact
NO - 此 API 为新增功能，暂不属于关键用户路径，不需要 E2E 测试。

## Test Strategy
- 使用 Jest 单元测试覆盖核心逻辑
- 至少 10 个测试用例覆盖各种意图类型和边界情况
- 测试准确率需要 > 85%
- 错误处理和边界条件测试
