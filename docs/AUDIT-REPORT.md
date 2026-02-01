---
id: audit-report-kr1-advance
version: 1.5.0
created: 2026-02-01
updated: 2026-02-01
changelog:
  - 1.5.0: Iteration 2 re-audit after fixes - found 2 L1 and 5 L2 new issues
  - 1.4.0: New audit for TypeScript intent module migration
  - 1.3.0: Reclassified issues as L3 based on project context
  - 1.2.0: Added audit for suggestedQuestions feature
  - 1.1.0: Updated for KR1 intent recognition audit
  - 1.0.0: Initial version (KR2 audit)
---

# Audit Report

Branch: cp-02011006--Retry-Advance-KR1-OKR-Project
Date: 2026-02-01
Scope: apps/core/src/intent/*, apps/core/src/dashboard/server.ts
Target Level: L2
Iteration: 2 (Re-audit after fixes)

Summary:
  L1: 2
  L2: 5
  L3: 0
  L4: 0

Decision: FAIL

## Previous Fixes Verification

### ✅ A2-001: Missing Input Length Validation - FIXED
- **Location**: apps/core/src/intent/controller.ts:41-48
- **Fix Applied**: Added MAX_INPUT_LENGTH = 1000 with validation
- **Status**: Properly implemented, prevents DoS attacks

### ✅ A2-002: Intent Detection False Positive - FIXED
- **Location**: apps/core/src/intent/nlp-parser.ts:70-76
- **Fix Applied**: isTaskCreation now returns false early if goal/project keywords detected
- **Status**: Properly prevents "创建目标" from being misidentified as task creation

### ✅ A2-003: Default Priority Assumption - FIXED
- **Location**: apps/core/src/intent/service.ts:99-101
- **Fix Applied**: Changed default priority from P1 to P2
- **Status**: More conservative default applied

---

## New Critical Issues Found

Findings:
  - id: L1-001
    layer: L1
    file: apps/core/src/intent/controller.ts
    line: 51
    issue: Missing context injection - controller never validates or enriches request.context, breaking all context-dependent features
    fix: Add context validation and session management, or remove context features from documentation
    status: pending

  - id: L1-002
    layer: L1
    file: apps/core/src/intent/service.ts
    line: 104-115
    issue: Missing entity validation - extracted title can be empty string, allowing creation of goals/projects/tasks with no title
    fix: Validate that extracted title is non-empty before returning result, reduce confidence if title missing
    status: pending

  - id: L2-004
    layer: L2
    file: apps/core/src/intent/nlp-parser.ts
    line: 14-105
    issue: Regex special characters not escaped - patterns use unescaped chars that may fail with edge case inputs
    fix: Escape regex special chars or use string.includes() for literal matching
    status: pending

  - id: L2-005
    layer: L2
    file: apps/core/src/intent/service.ts
    line: 59-82
    issue: Intent detection order creates ambiguity - isTaskUpdate checked before isTaskQuery, can misclassify inputs
    fix: Refine isTaskUpdate to require explicit status keywords, prioritize query for ambiguous cases
    status: pending

  - id: L2-006
    layer: L2
    file: apps/core/src/intent/nlp-parser.ts
    line: 116-131
    issue: extractTitle removes too much context - aggressive regex removes meaningful content from titles
    fix: Be more conservative, only remove when followed by clear action words
    status: pending

  - id: L2-007
    layer: L2
    file: apps/core/src/intent/routes.ts
    line: 42
    issue: Missing HTTP method validation - non-POST methods get 404 instead of 405 Method Not Allowed
    fix: Add explicit method handler to reject non-POST with 405
    status: pending

  - id: L2-008
    layer: L2
    file: apps/core/src/intent/controller.ts
    line: 54-63
    issue: No response time logging - calculated but never logged for monitoring
    fix: Add console.log for response time and intent detection results
    status: pending

Blockers:
  - L1-001: Context features completely broken - no session management or context enrichment implemented
  - L1-002: Empty title validation missing - can create entities with no title, breaking data integrity
  - L2-004: Regex accuracy issues with special characters
  - L2-005: Intent detection ambiguity between update and query
  - L2-006: Title extraction loses meaningful content
  - L2-007: Poor API error messages for wrong HTTP methods
  - L2-008: No performance observability

## Detailed Analysis

### L1-001: Missing Context Injection in Controller

**File**: apps/core/src/intent/controller.ts
**Line**: 51
**Severity**: L1 (Blocking)

**Issue**: The controller calls `recognizeIntent(request)` but never constructs or injects context. The service expects `context?: { currentProject?: string, currentGoal?: string }` from the request body, but there's no validation or enrichment of context data.

**Impact**:
- Context-dependent features (like "给那个目标添加任务") completely broken
- No session management or context persistence
- Documentation promises context support that doesn't exist

**Evidence**:
```typescript
// controller.ts:51
const result = recognizeIntent(request);
// request.context is never validated or enriched
```

**Fix Required**:
```typescript
// Validate context structure
if (request.context && typeof request.context !== 'object') {
  res.status(400).json({
    success: false,
    error: 'Invalid context format',
  });
  return;
}

// Option 1: Session-based context (requires session store)
if (request.context?.session_id) {
  const sessionContext = await getSessionContext(request.context.session_id);
  request.context.currentProject = sessionContext.currentProject;
  request.context.currentGoal = sessionContext.currentGoal;
}

// Option 2: Just validate and pass through (current minimal implementation)
// User must provide currentProject/currentGoal explicitly
```

---

### L1-002: Missing Entity Validation Before Database Operations

**File**: apps/core/src/intent/service.ts
**Line**: 104-115
**Severity**: L1 (Blocking)

**Issue**: Extracted title can be empty string after `extractTitle()` processing. The code never validates that required entities are non-empty before returning them.

**Impact**:
- Can create goals/projects/tasks with empty titles
- Database may accept invalid data
- Breaks data integrity constraints

**Evidence**:
```typescript
// service.ts:105
entities.title = extractTitle(text);
// No validation that title is non-empty
```

**Reproduction**:
```bash
curl -X POST http://localhost:5212/api/intent/recognize \
  -H "Content-Type: application/json" \
  -d '{"input": "创建一个任务"}'
# Returns: { title: "" } - invalid but allowed
```

**Fix Required**:
```typescript
if (intent === 'CREATE_GOAL' || intent === 'CREATE_PROJECT' || intent === 'CREATE_TASK') {
  const title = extractTitle(text);

  if (!title || title.trim().length === 0) {
    return {
      intent,
      entities: { priority: 'P2' },
      confidence: 0.3,
      needsConfirmation: true,
      understanding: `无法提取${intent === 'CREATE_GOAL' ? '目标' : intent === 'CREATE_PROJECT' ? '项目' : '任务'}标题，请提供更明确的描述`
    };
  }

  entities.title = title;
}
```

---

### L2-004: Regex Special Characters Not Escaped

**File**: apps/core/src/intent/nlp-parser.ts
**Lines**: Multiple (14, 17, 20, 33, 36, 39, 42, 54, 63, 79, 82, 93, 105)
**Severity**: L2 (Functional)

**Issue**: All regex patterns use unescaped special characters inside character classes and word boundaries without considering user input injection.

**Impact**: If user input contains regex special chars in keywords, matching may fail unexpectedly. Not a security issue (no ReDoS risk) but affects accuracy.

**Fix**: Use string methods where appropriate:
```javascript
if (normalized.includes('p0') || normalized.includes('最高')) {
  return 'P0';
}
```

---

### L2-005: Intent Detection Order Creates Ambiguity

**File**: apps/core/src/intent/service.ts
**Line**: 59-82
**Severity**: L2 (Functional)

**Issue**: `isTaskUpdate` checked before `isTaskQuery`, but both can match similar inputs like "查看任务状态".

**Fix**: Refine `isTaskUpdate` to require explicit status keywords:
```typescript
export function isTaskUpdate(text: string): boolean {
  const normalized = text.toLowerCase();
  const hasStatus = extractStatus(text) !== undefined;
  const strongUpdate = /(标记|完成|mark.*done|complete)/.test(normalized);

  return (hasTaskWord && hasStatus) || strongUpdate;
}
```

---

### L2-006: extractTitle Removes Too Much Context

**File**: apps/core/src/intent/nlp-parser.ts
**Line**: 116-131
**Severity**: L2 (Functional)

**Issue**: Aggressive regex removes meaningful content from titles.

**Examples**:
- Input: "实现一个新建用户功能" → Output: "用户功能" (lost "实现" and "新建")
- Input: "帮我优化代码" → Output: "优化代码" (lost "帮我")

**Fix**: Only remove when followed by clear action words:
```typescript
title = title.replace(/^(请|帮我|我想|我要)\s*(创建|新建|添加)/i, '$2');
```

---

### L2-007: Missing HTTP Method Validation

**File**: apps/core/src/intent/routes.ts
**Line**: 42
**Severity**: L2 (Functional)

**Issue**: Only POST is defined, but other methods get 404 instead of 405.

**Fix**:
```typescript
router.post('/recognize', recognize);
router.all('/recognize', (req, res) => {
  res.status(405).json({ success: false, error: `Method ${req.method} not allowed` });
});
```

---

### L2-008: No Response Time Logging

**File**: apps/core/src/intent/controller.ts
**Line**: 54, 63
**Severity**: L2 (Functional)

**Issue**: Response time calculated but never logged.

**Fix**:
```typescript
console.log(`[Intent] ${request.input.substring(0, 50)}... | ${result.intent} | ${responseTime}ms`);
```

---

## What Works Well

1. Previous L2 fixes properly implemented (input validation, false positive fix, P2 default)
2. Type safety and error handling remain solid
3. Clean module structure and separation of concerns
4. Comprehensive regex patterns for Chinese and English

---

## Testing Recommendations

### Critical Test Cases to Add

1. **Empty Title After Extraction**:
```bash
curl -X POST http://localhost:5212/api/intent/recognize \
  -d '{"input": "创建一个任务"}'
# Should fail gracefully, not return empty title
```

2. **Ambiguous Update vs Query**:
```bash
curl -X POST http://localhost:5212/api/intent/recognize \
  -d '{"input": "查看任务状态"}'
# Should be QUERY_TASKS, not UPDATE_TASK
```

3. **Title Preservation**:
```bash
curl -X POST http://localhost:5212/api/intent/recognize \
  -d '{"input": "实现一个新建用户功能"}'
# Should preserve meaningful content
```

---

## Recommendation

**FAIL** - Must fix 2 L1 blockers + 5 L2 issues before merge.

**L1 Issues (Must Fix)**:
1. L1-001: Context features broken - add validation or remove from docs
2. L1-002: Empty title validation missing

**L2 Issues (Should Fix)**:
1. L2-004: Regex accuracy issues
2. L2-005: Intent detection ambiguity
3. L2-006: Title extraction loses content
4. L2-007: Missing HTTP method validation
5. L2-008: No performance logging

**Estimated fix time**: 2-3 hours for all L1+L2 issues

After fixes, re-audit and verify all edge cases before merge.

---

## Architecture Concerns (Observations, Not Blockers)

1. **No Integration with Task System**: Intent recognition service doesn't actually create tasks/goals. It only returns structured data. The caller must integrate with `/api/tasks/*` endpoints.

2. **No Session Store**: Context manager referenced in docs doesn't exist in this implementation. Session-based context requires external state management.

3. **Synchronous Processing**: All parsing is synchronous. For future ML integration, async processing will be needed.

4. **No Confidence Threshold Enforcement**: System returns low-confidence results without forcing user confirmation. Caller must check `needsConfirmation` flag.

---

## Conclusion

The three previously identified L2 issues (A2-001, A2-002, A2-003) have been properly fixed. However, this re-audit discovered **2 new L1 blockers** and **5 new L2 issues** that must be addressed before merging.

The most critical issues are:
1. Context features are documented but completely broken (no session management)
2. Empty title validation is missing (can create entities with no title)

These issues must be fixed or the corresponding features removed from documentation to match actual implementation.
