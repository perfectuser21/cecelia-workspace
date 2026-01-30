# QA Decision - Tick + cecelia-run 集成

Decision: NO_RCI
Priority: P1
RepoType: Engine

## Tests

| DoD Item | Method | Location |
|----------|--------|----------|
| Tick 触发执行 | manual | manual:调用 tick API 观察 cecelia-run 启动 |
| 回调更新状态 | manual | manual:检查 task 状态变化 |
| 连续执行 | manual | manual:创建多个 task 验证连续执行 |

## RCI

- new: []
- update: []

## Reason

1. **Engine 类型项目**：Brain API 是核心基础设施
2. **集成测试为主**：功能涉及外部进程调用（cecelia-run），单元测试难以覆盖
3. **手动验证**：首次集成，需要人工观察执行流程
4. **后续迭代**：功能稳定后再补充自动化测试

## 测试计划

### 手动验证步骤

1. **AC1 验证**：
   ```bash
   # 1. 创建测试 task
   curl -X POST http://localhost:5212/api/brain/action/create-task \
     -H "Content-Type: application/json" \
     -d '{"title":"Test tick execution","priority":"P1","prd_content":"/dev test"}'

   # 2. 触发 tick
   curl -X POST http://localhost:5212/api/brain/tick

   # 3. 检查 task 状态
   curl http://localhost:5212/api/brain/tasks

   # 4. 检查进程
   ps aux | grep cecelia-run
   ```

2. **AC2 验证**：等待 cecelia-run 完成，检查状态更新
3. **AC3 验证**：创建多个 tasks，观察连续执行
