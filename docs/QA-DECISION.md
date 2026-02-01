# QA Decision

**Decision**: NO_RCI  
**Priority**: P2  
**RepoType**: Business

## Tests

- **dod_item**: "routes.ts 改用 fetch 调用 semantic-brain API"
  - **method**: auto
  - **location**: apps/core/src/dashboard/__tests__/routes.test.ts

- **dod_item**: "INTENT_TYPES 常量在 routes.ts 中本地定义"
  - **method**: auto
  - **location**: apps/core/src/dashboard/__tests__/routes.test.ts

- **dod_item**: "测试中 fetch 被 mock，测试通过"
  - **method**: auto
  - **location**: apps/core/src/dashboard/__tests__/routes.test.ts

- **dod_item**: "apps/core/src/brain/ 目录已删除"
  - **method**: manual
  - **location**: manual:验证目录不存在（ls apps/core/src/brain）

- **dod_item**: "无其他文件引用 brain 目录"
  - **method**: auto
  - **location**: manual:grep -r "from.*brain/" apps/core/src/ 返回空

- **dod_item**: "npm test 通过"
  - **method**: auto
  - **location**: CI 自动运行

## RCI

**new**: []  
**update**: []

## Reason

架构重构任务，删除旧代码改用新 API。仅影响内部实现，不改变外部接口或用户行为，无需纳入回归契约。测试通过后风险可控。
