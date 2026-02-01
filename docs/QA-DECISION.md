# QA Decision - KR1 意图识别功能

Decision: UPDATE_RCI
Priority: P0
RepoType: Business

## Tests

### 核心功能测试
- dod_item: "API 端点 POST /api/intent/recognize 可以接收自然语言输入"
  method: auto
  location: tests/intent-recognition.test.ts

- dod_item: "API 返回结构化的 JSON 响应，包含识别的意图类型和提取的实体"
  method: auto
  location: tests/intent-recognition.test.ts

- dod_item: "能够正确识别至少 5 种意图类型"
  method: auto
  location: tests/intent-recognition.test.ts

- dod_item: "对于明确的创建类请求，准确率 100%"
  method: auto
  location: tests/intent-recognition.test.ts

- dod_item: "能够区分 Goal/Project/Task 的语义差异"
  method: auto
  location: tests/intent-recognition.test.ts

- dod_item: "从自然语言中提取标题信息"
  method: auto
  location: tests/intent-recognition.test.ts

- dod_item: "从自然语言中提取优先级信息（P0/P1/P2）"
  method: auto
  location: tests/intent-recognition.test.ts

- dod_item: "从自然语言中提取关联关系等关键信息"
  method: auto
  location: tests/intent-recognition.test.ts

- dod_item: "模糊请求识别并提示用户确认"
  method: auto
  location: tests/intent-recognition.test.ts

- dod_item: "在执行操作前向用户展示理解的内容"
  method: auto
  location: tests/intent-recognition.test.ts

- dod_item: "用户确认机制正常工作"
  method: auto
  location: tests/intent-recognition.test.ts

- dod_item: "API 响应时间 < 500ms"
  method: auto
  location: tests/intent-recognition.test.ts

### 集成测试
- dod_item: "与 Brain API 集成"
  method: auto
  location: tests/integration/brain-intent.test.ts

- dod_item: "与 Task Management API 集成"
  method: auto
  location: tests/integration/task-intent.test.ts

### 测试覆盖
- dod_item: "单元测试覆盖核心识别逻辑"
  method: auto
  location: tests/intent-recognition.test.ts

- dod_item: "至少 10 个真实场景的测试用例"
  method: auto
  location: tests/intent-recognition.test.ts

- dod_item: "集成测试验证完整的识别→执行流程"
  method: auto
  location: tests/integration/brain-intent.test.ts

### 验收场景测试
- dod_item: "场景1：创建 Task"
  method: auto
  location: tests/intent-recognition.test.ts

- dod_item: "场景2：创建 Goal"
  method: auto
  location: tests/intent-recognition.test.ts

- dod_item: "场景3：查询任务"
  method: auto
  location: tests/intent-recognition.test.ts

- dod_item: "场景4：更新状态"
  method: auto
  location: tests/intent-recognition.test.ts

### 自动化测试
- dod_item: "npm run typecheck && npm run lint && npm test 通过"
  method: auto
  location: CI pipeline

### 手动验证
- dod_item: "TypeScript 类型支持"
  method: manual
  location: manual:编译通过且无类型错误

- dod_item: "API 文档完整"
  method: manual
  location: manual:检查文档存在且说明使用方法

- dod_item: "代码注释质量"
  method: manual
  location: manual:审计时检查关键算法注释

## RCI

new: []

update:
  - id: C2-001
    reason: "KR1 意图识别功能集成到 Brain API 和任务管理系统，需要验证意图识别→任务创建的完整流程稳定性"

## Reason

KR1 是 Cecelia 自驱进化的核心能力（P0 目标），与 Brain API 和 Task Management API 深度集成。虽然是 Business 仓库，但鉴于其核心地位和集成复杂度，需要更新现有的任务管理回归契约（C2-001）以覆盖意图识别系统。功能质量通过充分的自动化测试保证（单元测试覆盖核心逻辑 + 集成测试验证完整流程 + 至少 10 个真实场景用例 + 性能测试）。
