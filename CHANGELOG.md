# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] - 2026-02-01

### Changed
- **Brain API Migration**: Removed local Brain code, migrated to semantic-brain service
  - Deleted `apps/core/src/brain/` directory (17 source files + 13 test files)
  - Updated `apps/core/src/dashboard/routes.ts` to use fetch API calls to semantic-brain service (http://localhost:5221)
  - Exported `parseIntent`, `parseAndCreate`, and `INTENT_TYPES` from routes.ts for testability
  - Added comprehensive tests with fetch mocking in `apps/core/src/dashboard/__tests__/routes.test.ts`
  - Updated build script in `apps/core/package.json` to remove brain directory copy
  - All functionality preserved, internal implementation changed to API-based architecture

## [1.5.0] - 2026-02-01

### Added
- **Intent Recognition (KR1)**: Natural language to OKR/Project/Task mapping
  - New POST `/api/brain/intent` API endpoint for simplified intent recognition
  - Context Manager for session-based entity storage and pronoun resolution
  - Support for 10+ intent types (create_goal, create_task, query_status, etc.)
  - Entity extraction (title, priority, deadline, status)
  - Pronoun resolution across multiple API calls ("那个目标", "that task")
  - Session isolation and automatic cleanup (30-minute timeout)
  - Comprehensive test coverage (context-manager, intent-api, intent-integration tests)
  - Documentation: `docs/KR1-INTENT-RECOGNITION.md`

### Changed
- Updated Brain routes.js to integrate context manager
- Enhanced intent/create endpoint to store entities in context for future reference

### Fixed
- NaN propagation in KR/O progress calculation
- Empty session_id handling in intent API
- Resource leak in context manager cleanup timer

## [1.4.1] - Previous version
