---
id: qa-decision-trd-template-engine-kr
version: 1.0.0
created: 2026-01-31
updated: 2026-01-31
changelog:
  - 1.0.0: 初始版本
---

# QA Decision

## 测试策略

| 类型 | 范围 | 工具 |
|------|------|------|
| 单元测试 | generateTrdFromGoalKR 函数 | Vitest |
| 集成验证 | API 端点 trd-from-kr | curl |

## 测试场景

1. **有 KR 上下文** - 传入 title + kr + project，验证 TRD 输出含 KR 信息
2. **无 KR 退化** - 只传 title，验证正常返回
3. **有 milestones** - 传入 milestones 数组，验证实施计划章节
4. **验证通过** - generateTrdFromGoalKR 输出 → validateTrd → valid: true

## 回归范围

- 现有 templates.test.js 中的测试不受影响（不修改现有函数）
