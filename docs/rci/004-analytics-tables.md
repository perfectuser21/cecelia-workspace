# RCI-004: Analytics Tables

## Contract

Database migration 004 must create three tables for user behavior tracking:
- `analytics_events`
- `analytics_sessions`
- `analytics_daily_metrics`

## Test

```bash
# Run migration
psql -h localhost -U cecelia -d cecelia -f apps/core/src/db/migrations/004-create-analytics-tables.sql

# Verify tables exist
psql -h localhost -U cecelia -d cecelia -c "\dt analytics_*"
```

## Expected Output

```
                List of relations
 Schema |          Name           | Type  |  Owner
--------+-------------------------+-------+---------
 public | analytics_daily_metrics | table | cecelia
 public | analytics_events        | table | cecelia
 public | analytics_sessions      | table | cecelia
```

## Evidence

- Migration file: `apps/core/src/db/migrations/004-create-analytics-tables.sql`
- Tables created with correct schema
- Indexes created for performance
- Trigger function for session duration calculation

## Status

✅ PASS - Migration creates all required tables
