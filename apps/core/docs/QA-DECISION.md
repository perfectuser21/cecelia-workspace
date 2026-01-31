---
id: qa-decision-cecelia-revival-phase1
version: 1.0.0
created: 2026-01-31
updated: 2026-01-31
changelog:
  - 1.0.0: 初始版本
---

# QA Decision - Cecelia Revival Phase 1

## Decision

**Strategy**: FULL_REGRESSION + UNIT_FOCUSED

**Priority**: P0

**Test Command**: `npx vitest run src/brain/`

---

## Testing Strategy

### 1. Unit Tests (Primary Focus)

**Objective**: Ensure modified functions work correctly in isolation

**Modified Modules**:
- `tick.js` — Concurrency configuration, callback validation
- `executor.js` — Callback URL, task execution trigger
- `decision.js` — Decision threshold logic, recommendation generation

**Requirements**:
- All 217+ existing tests must pass
- New tests for configuration loading (MAX_CONCURRENT_TASKS)
- New tests for callback URL correctness
- New tests for decision threshold adjustments (-20% → -10%)

**Test Types**:
- **Configuration Tests**: Verify env var reading, default values
  - `MAX_CONCURRENT_TASKS` defaults to 3
  - `CECELIA_MAX_CONCURRENT` environment variable override works
  - Fallback mechanism if env var missing

- **Callback Tests**: Verify executor generates correct callback paths
  - Callback URL points to `http://localhost:5212/api/brain/execution-callback`
  - Not pointing to N8N (5679) or other services

- **Decision Threshold Tests**: Verify new deviation thresholds
  - Negative deviation < -10% triggers "at_risk" status
  - Negative deviation < -20% triggers "behind" status (critical)
  - Blocked task detection and recommendations generated

### 2. Integration Tests (Regression)

**Objective**: Ensure tick loop → dispatch → callback flow works end-to-end

**Coverage**:
- `tick-dispatch.test.js` — Task selection and dispatch logic
- `tick-loop.test.js` — Tick activation, loop state management
- `tick.test.js` — Core tick mechanics

**Validation**:
- Manual POST `/api/brain/tick` successfully dispatches task
- Callback `/api/brain/execution-callback` updates task status to `completed` (not stuck in `in_progress`)
- Concurrent task limiting prevents overload (max 3 running)
- Cooldown mechanism prevents rapid re-dispatch (60s)
- Timeout mechanism auto-fails stale tasks (30 min)

### 3. Decision Engine Tests

**Objective**: Verify decision logic generates non-empty recommendations

**Coverage**:
- Goal comparison with new thresholds
- Blocked task detection (stale > 24h)
- Recommendation generation
- Next action prioritization

**Validation**:
- `POST /api/brain/goal/compare` returns non-empty `recommendations` array
- Decision engine doesn't "spin idle" (empty recommendations)
- Fallback logic triggers when no active goals

---

## Test Coverage by Task

### Task 1.1: Scheduler Concurrency Configuration

**Files**: `src/brain/tick.js`

**Tests Required**:
```
✓ MAX_CONCURRENT_TASKS reads from env var CECELIA_MAX_CONCURRENT
✓ MAX_CONCURRENT_TASKS defaults to 3 if env var not set
✓ Concurrent limit enforced when dispatching tasks
✓ Export constant for test verification (tick-dispatch.test.js line 28)
```

**Validation Method**: Unit test mocking `process.env.CECELIA_MAX_CONCURRENT`

---

### Task 1.2: Tick Closure Fix

**Files**:
- `src/brain/executor.js` — Callback URL
- `src/brain/tick.js` — Callback invocation
- `src/brain/actions.js` — Task status update

**Tests Required**:
```
✓ executor.js callback URL = http://localhost:5212/api/brain/execution-callback
✓ Callback triggered when Cecelia run completes
✓ Task status updates from in_progress → completed via callback
✓ Callback payload contains correct fields (task_id, run_id, status)
✓ Manual dispatch cooldown respected (60s minimum between dispatches)
✓ Task timeout auto-fails stale dispatches (30 min threshold)
```

**Validation Method**:
- Integration test (tick-dispatch.test.js)
- Mock pool.query and verify callback invocation
- Verify updateTask called with status='completed'

---

### Task 1.3: Decision Engine Threshold Adjustment

**Files**: `src/brain/decision.js`

**Changes**:
- Deviation threshold from -20% to -10% for "at_risk" status
- Ensure recommendations generated for at_risk goals
- Blocked task detection and retry action generation

**Tests Required**:
```
✓ Goal with -15% deviation = "at_risk" status (was ignored before)
✓ Goal with -25% deviation = "behind" status (critical)
✓ Recommendations array non-empty for at_risk goals
✓ Blocked tasks (>24h in_progress) detected and reported
✓ Fallback: empty recommendations when no issues detected
✓ compareGoalProgress exports for testing (line 87)
✓ generateRecommendations logic verified (line 64)
```

**Validation Method**: Unit tests with mocked database results

---

### Regression Tests (No Degradation)

**Command**: `npx vitest run src/brain/`

**Acceptance Criteria**:
```
✓ All 217+ existing tests pass
✓ No new test failures introduced
✓ TypeScript type checking passes (if applicable)
✓ No console errors in test output
✓ Test execution completes within 60 seconds
```

---

## Out of Scope (Do Not Test)

❌ Frontend components (not in scope)
❌ N8N workflow logic (not in scope)
❌ Media, Panorama, Scraper modules (not in scope)
❌ Circuit Breaker pattern (Phase 2)
❌ Notifier system (Phase 3)
❌ Planner V2 (Phase 3)
❌ Other task-system modules beyond tick → dispatch → callback

---

## Test Execution Checklist

### Pre-Test
- [ ] Clone fresh from develop branch
- [ ] Install dependencies: `npm install`
- [ ] Database migrated to latest schema
- [ ] No test database contamination

### Test Run
- [ ] Run unit tests: `npx vitest run src/brain/`
- [ ] Verify all 217+ tests pass
- [ ] Verify test execution time < 60 seconds
- [ ] No warnings or deprecations

### Manual Verification (If Unit Tests Pass)
- [ ] POST `/api/brain/tick` with test goal
- [ ] Verify task transitions: queued → dispatched → in_progress
- [ ] Verify callback webhook received at `/api/brain/execution-callback`
- [ ] Verify task status updated to `completed`
- [ ] Check logs for no errors in tick cycle

### Post-Test
- [ ] Document any test additions in commit message
- [ ] Verify no test files left in `.archive/` or `/tmp/`
- [ ] Confirm TypeScript compilation succeeds (if applicable)

---

## Risk Assessment

**Low Risk**: Configuration reading (MAX_CONCURRENT_TASKS)
- ✅ Non-breaking change, backward-compatible default
- ✅ No database schema changes
- ✅ No API contract changes

**Medium Risk**: Callback URL fix (executor.js)
- ⚠️ Affects production tick loop behavior
- ⚠️ Must verify callback handler exists at new URL
- ✅ Covered by integration tests

**Medium Risk**: Decision threshold change (-20% → -10%)
- ⚠️ May increase alert frequency
- ⚠️ Could trigger false positives if expectations wrong
- ✅ Covered by unit tests with clear thresholds

---

## Success Criteria Summary

| Criterion | Type | Status |
|-----------|------|--------|
| MAX_CONCURRENT_TASKS configurable | Unit | Required |
| Callback URL = localhost:5212 | Unit + Integration | Required |
| Task completes via callback | Integration | Required |
| Recommendations non-empty | Unit | Required |
| All 217+ tests pass | Regression | Required |
| No new console errors | Regression | Required |
| Execution time < 60s | Performance | Target |

---

## Notes for QA Team

1. **Idempotency**: Test with repeated ticks (should not create duplicate tasks)
2. **Cooldown**: Verify 60s cooldown prevents rapid dispatch spam
3. **Timeout**: Verify 30m auto-fail prevents infinite in_progress stuck state
4. **Concurrency**: With MAX_CONCURRENT_TASKS=3, verify only 3 runs execute simultaneously
5. **Database**: Ensure working_memory table has tick status keys populated correctly

---

## Related Documents

- PRD: `apps/core/.prd.md` (Cecelia Revival Phase 1 requirements)
- DoD: `apps/core/.dod.md` (Acceptance criteria)
- Test Files:
  - `src/brain/__tests__/tick-dispatch.test.js`
  - `src/brain/__tests__/tick-loop.test.js`
  - `src/brain/__tests__/tick.test.js`
