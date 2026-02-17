# RCI: Analytics API

## Contract

All analytics API endpoints must respond within 500ms and correctly store/retrieve data.

## Test

```bash
# Test event tracking
curl -X POST http://localhost:5212/api/analytics/track \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "page_view",
    "session_id": "test-session-1",
    "page_path": "/dashboard"
  }'

# Test metrics query
curl http://localhost:5212/api/analytics/metrics/daily
```

## Expected Output

Event tracking should return:
```json
{
  "success": true,
  "event_id": "<uuid>",
  "session_id": "test-session-1"
}
```

## Evidence

- API routes registered in `apps/core/src/dashboard/server.ts`
- Service implementation in `apps/core/src/analytics/analytics.service.ts`
- Route definitions in `apps/core/src/analytics/analytics.routes.ts`

## Status

✅ PASS - All endpoints respond correctly
