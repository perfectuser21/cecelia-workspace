# Changelog

## [1.9.0] - 2026-02-01

### Added
- Cecelia Overview dashboard enhancements with real-time monitoring metrics
- Seats configuration display (max concurrent, used, available)
- Tick Loop status (running state, last/next tick times, actions today, interval)
- Circuit breaker status with color-coded indicators (CLOSED/OPEN/HALF_OPEN)
- Task queue statistics visualization (queued, in_progress, completed, failed, cancelled)
- Current activity panel showing in-progress tasks
- Brain API integration (http://localhost:5221/api/brain/tick/status)
- Tasks API integration (/api/tasks/tasks)
- Auto-refresh every 30 seconds for real-time monitoring
- Comprehensive test coverage (18 tests covering API integration, edge cases, data transformations)

## [1.8.0] - 2026-02-01

### Added
- Intent Recognition API (KR1) - Natural language to OKR/Project/Task intent recognition
- POST /api/intent/recognize endpoint for intent recognition
- Support for CREATE_GOAL, CREATE_PROJECT, CREATE_TASK, QUERY_TASKS, UPDATE_TASK intents
- NLP parser with rule-based pattern matching (no ML models)
- Entity extraction (title, priority, status, project/goal references)
- Confidence scoring and explanation generation
- Integration with Brain API through suggested actions
- Comprehensive test coverage (30+ test cases)

## [1.7.0] - Previous version
