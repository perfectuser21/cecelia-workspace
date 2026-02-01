# QA Decision

## Task Info
Branch: cp-02011428--intent-js-phrase-patterns
Title: 扩展 intent.js phrase patterns 覆盖率

Decision: UPDATE_RCI
Priority: P0
RepoType: Engine
ChangeType: feature

## Tests

- dod_item: "CREATE_GOAL 至少 15 个 patterns"
  method: auto
  location: apps/core/src/__tests__/intent-recognition.test.ts

- dod_item: "CREATE_PROJECT 至少 15 个 patterns"
  method: auto
  location: apps/core/src/__tests__/intent-recognition.test.ts

- dod_item: "CREATE_TASK 至少 15 个 patterns"
  method: auto
  location: apps/core/src/__tests__/intent-recognition.test.ts

- dod_item: "QUERY_TASKS 至少 15 个 patterns"
  method: auto
  location: apps/core/src/__tests__/intent-recognition.test.ts

- dod_item: "UPDATE_TASK 至少 15 个 patterns"
  method: auto
  location: apps/core/src/__tests__/intent-recognition.test.ts

- dod_item: "每个意图类型至少包含 5 个中文口语化表达"
  method: auto
  location: apps/core/src/__tests__/intent-recognition.test.ts

- dod_item: "每个意图类型至少包含 3 个英文表达"
  method: auto
  location: apps/core/src/__tests__/intent-recognition.test.ts

- dod_item: "手动验证: 帮我创建一个任务叫做XX 能正确识别为 CREATE_TASK"
  method: manual
  location: "manual:启动 Core API, 调用 /api/intent/recognize 验证"

## RCI

new: []
update:
  - RCI-KR1-intent-recognition

## Reason

这是 KR1 意图识别的核心功能扩展，直接影响 Golden Path（自然语言→OKR/Task），属于 Engine 级别修改。需要更新现有的 RCI 回归契约以覆盖新增的 phrase patterns。由于涉及核心意图识别逻辑，优先级为 P0。
