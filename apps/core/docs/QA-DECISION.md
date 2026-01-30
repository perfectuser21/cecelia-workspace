# QA Decision - Goal Comparison (Stage 3)

Decision: NO_RCI
Priority: P1
RepoType: Engine

## Tests

| DoD Item | Method | Location |
|----------|--------|----------|
| Goal Compare API | manual | manual:调用 compare API 验证返回 |
| Decide API | manual | manual:调用 decide API 验证 |
| Execute Decision API | manual | manual:调用 execute API 验证 |
| Decision History API | manual | manual:调用 decisions API 验证 |
| Tick Integration | manual | manual:检查 tick 日志 |

## RCI

- new: []
- update: []

## Reason

1. **Engine 类型项目**：Brain API 决策引擎
2. **API 测试为主**：验证决策生成和执行
3. **手动验证**：首次实现，需观察决策质量

## 测试计划

### 手动验证步骤

1. **AC1 验证 - Goal Compare**：
   ```bash
   curl -X POST http://localhost:5212/api/brain/goal/compare \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

2. **AC2 验证 - Decide**：
   ```bash
   curl -X POST http://localhost:5212/api/brain/decide \
     -H "Content-Type: application/json" \
     -d '{"context": {"trigger": "manual"}}'
   ```

3. **AC3 验证 - Execute**：
   ```bash
   curl -X POST http://localhost:5212/api/brain/decision/<id>/execute
   ```

4. **AC4 验证 - Decision History**：
   ```bash
   curl http://localhost:5212/api/brain/decisions
   ```
