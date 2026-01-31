---
id: qa-decision-kr1-intent-recognition
version: 1.0.0
created: 2026-02-01
updated: 2026-02-01
changelog:
  - 1.0.0: 初始版本（KR1 意图识别功能）
---

# QA Decision

Decision: MUST_ADD_RCI
Priority: P0
RepoType: Business

Tests:
  - dod_item: "API 端点 POST /api/intent/recognize 接收自然语言输入并返回结构化 JSON"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts

  - dod_item: "正确识别创建 Task 意图（如"实现用户登录接口"）"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts

  - dod_item: "正确识别创建 Goal 意图（如"完成整个用户认证系统作为 P0 目标"）"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts

  - dod_item: "正确识别创建 Project 意图（如"新建一个电商项目"）"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts

  - dod_item: "正确识别查询任务意图（如"我有哪些待办任务"）"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts

  - dod_item: "正确识别更新任务意图（如"把登录功能标记为完成"）"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts

  - dod_item: "从自然语言中提取标题/名称"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts

  - dod_item: "从自然语言中提取优先级（P0/P1/P2）"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts

  - dod_item: "从自然语言中提取状态（pending/in_progress/completed）"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts

  - dod_item: "从自然语言中提取关联关系（属于哪个 Project/Goal）"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts

  - dod_item: "对于明确的创建类请求（如"创建一个任务：实现登录"），准确率达到 100%"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts

  - dod_item: "对于模糊的请求（如"搞一个登录"），能够识别为创建任务并返回确认提示"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts

  - dod_item: "能够区分 Goal（宏观目标）、Project（项目）和 Task（具体任务）的语义差异"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts

  - dod_item: "API 响应时间 < 500ms"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts

  - dod_item: "与 Brain API (/api/brain/action/*) 集成成功"
    method: auto
    location: tests/api/intent-brain-integration.test.ts

  - dod_item: "与 Task Management API 集成，支持任务 CRUD 操作"
    method: auto
    location: tests/api/intent-task-integration.test.ts

  - dod_item: "提供完整的 TypeScript 类型支持"
    method: manual
    location: manual:代码审查时检查 TypeScript 类型定义完整性

  - dod_item: "单元测试覆盖核心识别逻辑"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts

  - dod_item: "集成测试验证完整的识别→执行流程"
    method: auto
    location: tests/api/intent-end-to-end.test.ts

  - dod_item: "至少 10 个真实场景的测试用例通过"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts

  - dod_item: "npm run qa 通过"
    method: auto
    location: contract:C2-001

  - dod_item: "API 文档说明接口使用方法"
    method: manual
    location: manual:检查 API 文档完整性

  - dod_item: "代码注释解释关键算法逻辑"
    method: manual
    location: manual:代码审查时确认

  - dod_item: "输入"实现用户登录接口"，返回正确的 CREATE_TASK 意图和实体"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts

  - dod_item: "输入"完成整个用户认证系统作为 P0 目标"，返回正确的 CREATE_GOAL 意图和 P0 优先级"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts

  - dod_item: "输入"我有哪些待办任务"，返回正确的 QUERY_TASKS 意图和 pending 状态过滤"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts

  - dod_item: "输入"把登录功能标记为完成"，返回正确的 UPDATE_TASK 意图和 completed 状态"
    method: auto
    location: apps/core/src/__tests__/intent-recognition.test.ts

RCI:
  new:
    - id: KR1-001
      feature: KR1
      name: "意图识别 API 端点健康检查"
      scope: intent-recognition
      priority: P0
      trigger: [PR, Release]
      method: auto
      tags: [kr1, intent, api, health]
      owner: core
      steps:
        given: "Core API 服务运行中"
        when: "调用 POST /api/intent/recognize 并传入简单的创建任务请求"
        then: "返回正确的 JSON 结构，包含 intent 和 entities 字段"
      evidence:
        type: api
        endpoint: "/api/intent/recognize"
        method: POST
        payload: '{"text": "创建一个任务：测试意图识别"}'
        expects:
          status: 200
          body_contains: ["intent", "CREATE_TASK", "entities", "title"]
      test: "tests/api/intent-health.test.ts"

    - id: KR1-002
      feature: KR1
      name: "意图识别准确率验证"
      scope: intent-recognition
      priority: P0
      trigger: [PR, Release]
      method: auto
      tags: [kr1, intent, accuracy]
      owner: core
      steps:
        given: "意图识别服务可用"
        when: "传入 PRD 中定义的 4 个验收场景"
        then: "全部返回正确的意图类型和实体提取结果"
      evidence:
        type: test
        suite: "apps/core/src/__tests__/intent-recognition.test.ts"
        expects:
          pass_rate: "100%"
          scenarios: 4
      test: "apps/core/src/__tests__/intent-recognition.test.ts"

    - id: KR1-003
      feature: KR1
      name: "意图识别性能验证"
      scope: intent-recognition
      priority: P1
      trigger: [Release]
      method: auto
      tags: [kr1, intent, performance]
      owner: core
      steps:
        given: "意图识别 API 端点可用"
        when: "发送 10 个连续请求"
        then: "所有请求响应时间 < 500ms"
      evidence:
        type: performance
        endpoint: "/api/intent/recognize"
        expects:
          response_time_p95: "< 500ms"
      test: "tests/api/intent-performance.test.ts"

    - id: KR1-004
      feature: KR1
      name: "意图识别与 Brain API 集成验证"
      scope: intent-recognition
      priority: P0
      trigger: [PR, Release]
      method: auto
      tags: [kr1, intent, brain, integration]
      owner: core
      steps:
        given: "意图识别返回 CREATE_TASK 结果"
        when: "调用 Brain API action/create-task 执行创建"
        then: "任务成功创建到数据库"
      evidence:
        type: integration
        flow: "intent → brain → database"
        expects:
          task_created: true
      test: "tests/api/intent-brain-integration.test.ts"

  update: []

Reason: KR1 是核心功能（自然语言到任务的桥梁），属于 P0 优先级，必须建立回归契约确保质量稳定性。
