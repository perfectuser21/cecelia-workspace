---
id: qa-decision-failed-task-retry
version: 1.0.0
created: 2026-01-31
updated: 2026-01-31
changelog:
  - 1.0.0: 初始版本
---

# QA 决策 - 失败任务智能重试模块

## 决策摘要

**决策**: RCI_REQUIRED + FULL_TEST
**优先级**: P1（影响关键调度流程）
**仓库类型**: Core Brain Module（后端 Node.js）
**测试策略**: Unit + Integration + E2E 分层

| 决策维度 | 值 | 说明 |
|---------|-----|------|
| 新增 RCI | 1 | RCI-B-050: 失败任务分析与智能重试 |
| 更新 RCI | 2 | RCI-B-020 (planner), RCI-B-010 (tick) |
| 测试覆盖 | 20+ cases | Unit/Integration/E2E |
| 覆盖率目标 | > 85% | retry-analyzer.js 100% |

---

## 1. 模块范围与 RCI 关系

### 1.1 新建模块

**文件**: `apps/core/src/brain/retry-analyzer.js`
**责任**: 失败原因分析 + 参数调整 + 分析结果生成

```javascript
exports.analyzeFailure(task)           // 分类失败原因
exports.calculateRetryParameters()     // 调整重试参数
exports.generateFailureAnalysis()      // 生成完整分析对象
```

**新增 RCI**: `RCI-B-050: Intelligent Failed Task Analysis and Retry`
- 失败分类规则（4 类）
- 参数调整算法（timeout/infra_error/code_error/prd_unclear）
- Payload 结构规范

### 1.2 修改模块

| 文件 | 变更 | RCI | 影响范围 |
|------|------|-----|---------|
| `planner.js` | 调用 retry-analyzer，创建智能重试任务 | RCI-B-020 | 重试流程 |
| `tick.js` | 超时失败时写入结构化 error_details | RCI-B-010 | 错误捕获 |
| `routes.js` | 新增 retry_summary 到 task_digest | RCI-B-040 | Status API |

### 1.3 RCI 变更清单

**新增**:
```
RCI-B-050: 失败任务智能重试
├─ analyzeFailure(task) → { category, reason, adjustments }
├─ 4 分类规则 (timeout/code_error/infra_error/prd_unclear)
├─ 参数调整规范 (timeout +50%, infra_error +10min)
└─ max_retries 限制 (≥2 时 abandoned)
```

**更新**:
```
RCI-B-020 (Planner): 添加调用 retry-analyzer
  payload.failure_analysis ← analyzeFailure()

RCI-B-010 (Tick): 添加错误结构化
  error_details: { error_type, error_message, triggered_at }
```

---

## 2. 测试战略（分层）

### 2.1 分层概览

```
┌────────────────────────────────────────────┐
│  E2E (端到端)                              │
│  失败 → 分析 → 入队 → Brain tick 处理     │
│  用例数: 3  耗时: 2min  环境: 真实 DB      │
├────────────────────────────────────────────┤
│  Integration (集成)                        │
│  retry-analyzer + planner + routes         │
│  用例数: 10 耗时: 30s  环境: 真实 DB       │
├────────────────────────────────────────────┤
│  Unit (单元)                               │
│  isolated functions with mocks             │
│  用例数: 20 耗时: 2s   环境: Mock DB       │
└────────────────────────────────────────────┘
```

### 2.2 执行计划

```bash
# 开发期：单元测试快速反馈
npm test -- retry-analyzer.test.js --watch

# 提交前：完整测试套件
npm test -- --grep "retry|Retry"

# CI 自动运行：分层并行
job:unit        → npm test -- --grep "Unit"
job:integration → npm test -- --grep "Integration"
job:e2e         → npm test -- --grep "E2E"
job:regression  → npm test -- planner.test.js tick.test.js
```

---

## 3. 测试范围详解

### 3.1 Unit 测试 (20+ cases)

**文件**: `apps/core/src/brain/__tests__/retry-analyzer.test.js`
**环境**: Vitest + Mock pg.Pool
**耗时**: 2-3 秒

#### 3.1.1 analyzeFailure() 分类逻辑

```javascript
describe('analyzeFailure - 失败分类', () => {
  // timeout 类
  ✓ 识别 error_type = "timeout"
  ✓ 识别含 "timeout" 的 error_message
  ✓ 识别含 "exceed" 的超时错误
  ✓ 正确提取失败原因文本

  // code_error 类
  ✓ 识别 error_type = "code_error"
  ✓ 识别 JS 异常 (ReferenceError, SyntaxError 等)
  ✓ 识别 exception 字段不为空
  ✓ 提取堆栈跟踪信息

  // infra_error 类
  ✓ 识别 error_type = "infra_error"
  ✓ 识别 "database", "network", "connection" 错误
  ✓ 识别 HTTP 5xx 错误

  // prd_unclear 类
  ✓ 识别 error_type = "prd_unclear"
  ✓ 识别含 "unclear", "ambiguous" 的描述

  // 边界情况
  ✓ 空 error_details → 默认分类 (code_error)
  ✓ null/undefined → 处理异常
  ✓ 超过 retry_count 限制 → should_not_retry=true
  ✓ retry_count 恰好等于 max_retries → should_not_retry=true
  ✓ 多行错误消息 → 正确解析
});
```

#### 3.1.2 calculateRetryParameters() 参数调整

```javascript
describe('calculateRetryParameters - 参数调整', () => {
  // timeout 类
  ✓ dispatch_timeout 增加 50%
  ✓ 新值 = 原值 * 1.5
  ✓ min/max 边界（1800 → 2700，3600 → 5400）
  ✓ max_retries 保持不变

  // infra_error 类
  ✓ 添加 retry_delay_ms = 600000 (10 分钟)
  ✓ dispatch_timeout 保持原值
  ✓ 多次调用不堆积 retry_delay

  // code_error/prd_unclear 类
  ✓ 参数不修改（返回原值）
  ✓ adjustments 对象为空

  // 边界
  ✓ 空参数对象 → 创建必要字段
  ✓ 未定义字段 → 设置默认值
});
```

#### 3.1.3 generateFailureAnalysis() 完整对象

```javascript
describe('generateFailureAnalysis - 生成分析对象', () => {
  ✓ 返回 {category, reason, adjustments}
  ✓ category ∈ {timeout, code_error, infra_error, prd_unclear}
  ✓ reason 为非空字符串
  ✓ adjustments 为对象且包含相关字段
  ✓ timestamp 字段自动添加
  ✓ retry_count 记录在分析中
});
```

### 3.2 Integration 测试 (10+ cases)

**文件**: `apps/core/src/brain/__tests__/retry-analyzer.integration.test.js`
**环境**: Vitest + Real PostgreSQL
**耗时**: 30-40 秒
**先决条件**: 需要 `docker-compose up postgres` 或测试数据库

#### 3.2.1 与 planner.js 集成

```javascript
describe('Planner ↔ RetryAnalyzer Integration', () => {
  // 完整流程
  ✓ 失败任务 → 分析 → 创建重试任务
  ✓ 重试任务 title 包含 "[Retry]"
  ✓ payload.failure_analysis 正确写入数据库
  ✓ failure_analysis.category 正确记录

  // 参数传递
  ✓ timeout 类重试：dispatch_timeout 增加 50%
  ✓ infra_error 类重试：创建 retry_delay_ms
  ✓ prd_unclear 类：标记 abandoned

  // 边界
  ✓ 第 1 次失败 → 创建重试 (retry_count = 1)
  ✓ 第 2 次失败 → 创建重试 (retry_count = 2)
  ✓ 第 3 次失败 (超过 max_retries=2) → 标记 abandoned，不创建重试
  ✓ abandoned 任务的 failure_analysis 记录最终失败原因
});
```

#### 3.2.2 与 tick.js 集成

```javascript
describe('Tick ↔ RetryAnalyzer Integration', () => {
  ✓ autoFailTimedOutTasks() 写入 error_type="timeout"
  ✓ error_details 包含 triggered_at, dispatch_timeout, timed_out_at
  ✓ error_message 由 error_details 提供
  ✓ 并发 timeout 检查不遗漏任务
  ✓ 已删除任务的检查安全处理
});
```

#### 3.2.3 与 routes.js 集成

```javascript
describe('Routes ↔ RetryAnalyzer Integration', () => {
  ✓ GET /api/brain/status 返回 task_digest
  ✓ task_digest.retry_summary 存在
  ✓ retry_summary 包含 failed_count, retrying_count, abandoned_count
  ✓ 数值正确聚合（不重复计数）
  ✓ 无失败任务时值为 0
});
```

### 3.3 E2E 测试 (3+ cases)

**文件**: `apps/core/src/brain/__tests__/retry-e2e.test.js`
**环境**: Vitest + Real Brain Loop
**耗时**: 2+ 分钟
**启动**: Brain orchestrator 完整启动

```javascript
describe('E2E: Complete Retry Flow', () => {
  // 场景 1: timeout 重试
  ✓ 创建超时任务 → 等待 tick → 自动 fail
    → 分析为 timeout → 创建重试 (dispatch_timeout +50%)
    → retry_summary.retrying_count += 1

  // 场景 2: infra_error 延迟重试
  ✓ 创建基础设施错误任务 → tick 处理
    → 创建重试 + retry_delay_ms=10min
    → 该重试任务暂不入队（等待延迟）

  // 场景 3: 超过重试限制自动 abandon
  ✓ 手动设置 retry_count=2, max_retries=2
    → tick 触发重新分析 → 标记 abandoned
    → 不创建新重试任务
    → retry_summary.abandoned_count += 1
});
```

### 3.4 回归测试

**执行现有测试套件**，确保无破坏性修改：

```bash
npm test -- planner.test.js           # planner.js 所有逻辑
npm test -- tick.test.js               # tick.js 所有逻辑
npm test -- routes.test.js             # routes.js 所有端点
```

**预期**: 所有现有测试仍需通过

---

## 4. 测试代码示例

### 4.1 Unit 测试模板

```javascript
// apps/core/src/brain/__tests__/retry-analyzer.test.js

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  analyzeFailure,
  calculateRetryParameters,
  generateFailureAnalysis
} from '../retry-analyzer.js';

describe('retry-analyzer', () => {
  describe('analyzeFailure', () => {
    it('应识别 timeout 类失败', () => {
      const task = {
        id: 'task-1',
        error_details: {
          error_type: 'timeout',
          error_message: 'Task execution exceeded 30 minutes'
        },
        retry_count: 0,
        max_retries: 2
      };

      const analysis = analyzeFailure(task);

      expect(analysis.category).toBe('timeout');
      expect(analysis.reason).toContain('timeout');
      expect(analysis.should_not_retry).toBe(false);
    });

    it('应在超过 max_retries 时标记不重试', () => {
      const task = {
        id: 'task-1',
        error_details: { error_type: 'code_error' },
        retry_count: 3,
        max_retries: 2
      };

      const analysis = analyzeFailure(task);

      expect(analysis.should_not_retry).toBe(true);
    });

    it('应处理空 error_details', () => {
      const task = {
        id: 'task-1',
        error_details: null,
        retry_count: 0
      };

      const analysis = analyzeFailure(task);

      expect(analysis).toBeDefined();
      expect(analysis.category).toBeDefined();
    });
  });

  describe('calculateRetryParameters', () => {
    it('timeout 类应增加 dispatch_timeout 50%', () => {
      const params = calculateRetryParameters(
        'timeout',
        { dispatch_timeout: 1800 }
      );

      expect(params.dispatch_timeout).toBe(2700); // 1800 * 1.5
    });

    it('infra_error 应添加 retry_delay_ms', () => {
      const params = calculateRetryParameters('infra_error', {});

      expect(params.retry_delay_ms).toBe(600000); // 10 min
    });

    it('code_error 不应修改参数', () => {
      const original = { dispatch_timeout: 1800 };
      const params = calculateRetryParameters('code_error', original);

      expect(params).toEqual(original);
    });
  });

  describe('generateFailureAnalysis', () => {
    it('应生成完整分析对象', () => {
      const task = {
        id: 'task-1',
        error_details: { error_type: 'timeout' },
        retry_count: 0,
        max_retries: 2
      };

      const analysis = generateFailureAnalysis(task);

      expect(analysis).toHaveProperty('category');
      expect(analysis).toHaveProperty('reason');
      expect(analysis).toHaveProperty('adjustments');
      expect(analysis).toHaveProperty('timestamp');
    });
  });
});
```

### 4.2 Integration 测试模板

```javascript
// 关键片段：验证 DB 写入

describe('Retry Analyzer Integration', () => {
  it('应创建带 failure_analysis 的重试任务', async () => {
    // 创建失败任务
    const original = await pool.query(`
      INSERT INTO tasks (
        title, status, error_details, dispatch_timeout, retry_count
      ) VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [
      'Original',
      'failed',
      JSON.stringify({
        error_type: 'timeout',
        error_message: 'Timeout after 30 minutes'
      }),
      1800,
      0
    ]);

    // 调用分析并创建重试
    const retry = await analyzeAndCreateRetryTask(original.rows[0]);

    // 验证 DB 中的重试任务
    const inDb = await pool.query(
      'SELECT * FROM tasks WHERE id = $1',
      [retry.id]
    );

    expect(inDb.rows[0].title).toContain('[Retry]');
    expect(inDb.rows[0].dispatch_timeout).toBe(2700); // 增加 50%
    expect(inDb.rows[0].payload.failure_analysis).toBeDefined();
    expect(inDb.rows[0].payload.failure_analysis.category).toBe('timeout');
  });
});
```

---

## 5. 风险评估与缓解

### 5.1 技术风险

| # | 风险 | 严重度 | 缓解措施 | 验证方式 |
|---|------|--------|---------|---------|
| 1 | 失败分类规则不完整 | 高 | 4 分类全覆盖 unit test | `grep -r "code_error\|timeout\|infra_error\|prd_unclear"` |
| 2 | payload.failure_analysis 遗漏 | 高 | Integration test 验证 DB 字段 | SELECT payload->'failure_analysis' 非 NULL |
| 3 | max_retries 边界错误 | 高 | Unit + Integration 边界测试 | retry_count >= max_retries → abandoned |
| 4 | 参数调整越界 | 中 | timeout 最大值限制 | dispatch_timeout ≤ 10800s (3h) |
| 5 | retry_summary 计数错误 | 中 | Routes integration test | 验证 sum(retrying) ≠ sum(abandoned) |
| 6 | 并发重试创建重复 | 中 | Tick 单线程保证 | afterEach cleanup 验证唯一性 |

### 5.2 数据一致性风险

| 场景 | 风险 | 缓解 |
|------|------|------|
| 并发 tick 调用 | 创建多个重试 | Tick runTickSafe() 互斥锁 |
| task 被外部删除 | FK 错误 | afterEach cleanup；异常捕获 |
| error_details 格式变化 | 分析失败 | 防御性编程；默认分类；log 错误 |
| 重试链过长 | 资源浪费 | max_retries ≤ 2 硬限制；abandoned 标记 |

### 5.3 回归风险

| 模块 | 变更类型 | 影响范围 | 验证 |
|------|---------|---------|------|
| planner.js | 新增分支（retry） | 原有逻辑不变 | planner.test.js 全部通过 |
| tick.js | 添加 error_details 写入 | 超时检查逻辑不变 | tick.test.js 全部通过 |
| routes.js | 添加 retry_summary 字段 | 原有字段不变 | routes.test.js 全部通过 |

---

## 6. CI/CD 集成

### 6.1 GitHub Actions 工作流

```yaml
name: Retry Analyzer Tests

on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm install
      - run: npm test -- retry-analyzer.test.js --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: cecelia_test
          POSTGRES_USER: n8n_user
          POSTGRES_PASSWORD: n8n_password_2025
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test -- --grep "Integration" --coverage

  regression:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: cecelia_test
          POSTGRES_USER: n8n_user
          POSTGRES_PASSWORD: n8n_password_2025
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test -- planner.test.js tick.test.js routes.test.js
```

### 6.2 覆盖率门禁

```javascript
// vitest.config.js
export default {
  test: {
    coverage: {
      lines: 85,           // 全项目最低 85%
      branches: 80,
      functions: 85,
      statements: 85
    }
  }
};
```

**注**: retry-analyzer.js 应达到 100% 覆盖率

---

## 7. 完成标准清单

### 7.1 代码完成

- [ ] `retry-analyzer.js` 实现完整
  - [ ] analyzeFailure() 覆盖 4 分类
  - [ ] calculateRetryParameters() 实现参数调整
  - [ ] generateFailureAnalysis() 生成完整对象
- [ ] `planner.js` 调用 retry-analyzer
  - [ ] 创建重试任务时使用 analyzeFailure()
  - [ ] payload 包含 failure_analysis
- [ ] `tick.js` 写入 error_details
  - [ ] autoFailTimedOutTasks() 结构化错误
- [ ] `routes.js` 添加 retry_summary
  - [ ] GET /api/brain/status 包含聚合数据

### 7.2 测试完成

- [ ] Unit 测试 20+ cases 全绿
  ```bash
  npm test -- retry-analyzer.test.js
  ```
- [ ] Integration 测试 10+ cases 全绿
  ```bash
  npm test -- --grep "Integration"
  ```
- [ ] E2E 测试 3+ cases 全绿
  ```bash
  npm test -- --grep "E2E"
  ```
- [ ] 回归测试全绿
  ```bash
  npm test -- planner.test.js tick.test.js routes.test.js
  ```
- [ ] 覆盖率达标：> 85%
  ```bash
  npm test -- --coverage
  ```

### 7.3 质量关卡

- [ ] ESLint 无新警告
  ```bash
  npm run lint
  ```
- [ ] TypeScript 编译通过（如有）
  ```bash
  npm run typecheck
  ```
- [ ] 所有 JSDoc 注释完整
- [ ] 提交消息格式正确

### 7.4 文档完成

- [ ] 本 QA-DECISION.md 已记录
- [ ] retry-analyzer.js 有完整 JSDoc
- [ ] .prd.md 成功标准对应验证方式
- [ ] DoD 检查清单全勾选

---

## 8. 测试执行检查表

### Phase 1: 开发期（本地）

```bash
# Day 1: 单元测试推动开发
npm test -- retry-analyzer.test.js --watch

# 验证分类逻辑
✓ 4 分类 + 边界 (12 cases)

# 验证参数调整
✓ timeout +50%, infra_error +10min (6 cases)

# 验证完整对象
✓ generateFailureAnalysis (2+ cases)
```

### Phase 2: 集成期（真实 DB）

```bash
# 启动测试 DB
docker-compose up -d postgres

# Integration 测试
npm test -- --grep "Integration"

# 验证
✓ planner ↔ retry-analyzer (7 cases)
✓ tick ↔ error_details (2 cases)
✓ routes ↔ retry_summary (3 cases)

# 回归测试
npm test -- planner.test.js tick.test.js
```

### Phase 3: E2E 验证（完整 Brain）

```bash
# 启动 Brain
npm start &

# 手工场景 1: timeout 重试
curl -X POST http://localhost:5212/api/brain/action/create-task \
  -d '{"title":"Timeout Task","dispatch_timeout":1800}'

# 等待 > 30 分钟，观察:
# - 任务状态 → failed
# - 重试任务被创建
# - dispatch_timeout = 2700 (1800 * 1.5)
# - retry_summary 更新

# 手工场景 2: 超过重试限制
# (通过 UPDATE 手动设置 retry_count=3)
# 验证不创建新重试，标记 abandoned

# E2E 自动化测试
npm test -- --grep "E2E"
```

### Phase 4: CI 门禁（GitHub）

```
Push → GitHub Actions:
  ✓ unit tests
  ✓ integration tests (with postgres service)
  ✓ regression tests
  ✓ coverage > 85%
  → Auto-merge if all green
```

---

## 9. 相关文件参考

| 文件 | 类型 | 说明 |
|------|------|------|
| `.prd.md` | PRD | 功能规格书，成功标准 |
| `.dod.md` | DoD | 验收清单 |
| `QA-DECISION.md` | 本文件 | 测试战略与风险评估 |
| `vitest.config.js` | 配置 | Vitest 测试框架配置 |
| `.github/workflows/ci.yml` | CI | GitHub Actions 工作流 |

---

## 10. 获批与签署

| 角色 | 签字 | 日期 | 备注 |
|------|------|------|------|
| QA Lead | ___ | ___ | QA 决策负责人 |
| Dev Lead | ___ | ___ | 代码审核负责人 |
| PM | ___ | ___ | 产品需求确认 |

---

**文档版本**: 1.0.0
**最后更新**: 2026-01-31
**有效期**: 直到发布上线
**分类**: Internal / Engineering Decision
