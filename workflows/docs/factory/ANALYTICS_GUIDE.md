# AI Factory Analytics Guide

## Overview

The Factory History Analyzer provides comprehensive analytics for AI factory runs, tracking success rates, performance metrics, model usage, and generating actionable recommendations.

## Location

- **Script**: `/home/xx/bin/analyze-factory-history.sh`
- **Data Source**: `/home/xx/data/runs/`
- **Reports**: `/home/xx/dev/n8n-workflows/analytics/`

## Usage

### Basic Usage

```bash
# Analyze all runs
bash /home/xx/bin/analyze-factory-history.sh

# Analyze last 7 days only
bash /home/xx/bin/analyze-factory-history.sh --days 7

# Analyze last 30 days
bash /home/xx/bin/analyze-factory-history.sh --days 30
```

### Output Options

```bash
# Generate both JSON and Markdown (default)
bash /home/xx/bin/analyze-factory-history.sh --format both

# Generate only JSON
bash /home/xx/bin/analyze-factory-history.sh --format json

# Generate only Markdown
bash /home/xx/bin/analyze-factory-history.sh --format md
```

### Custom Output Directory

```bash
# Save reports to custom location
bash /home/xx/bin/analyze-factory-history.sh --output /path/to/output
```

### Combined Options

```bash
# Analyze last 14 days, JSON only, custom output
bash /home/xx/bin/analyze-factory-history.sh \
  --days 14 \
  --format json \
  --output /home/xx/reports
```

## Output Files

The script generates timestamped reports:

```
analytics/
├── factory-analytics-20251225-080423.json
├── factory-analytics-20251225-080423.md
├── latest.json -> factory-analytics-20251225-080423.json
└── latest.md -> factory-analytics-20251225-080423.md
```

### Latest Reports

Symlinks always point to the most recent reports:
- `analytics/latest.json` - Latest JSON report
- `analytics/latest.md` - Latest Markdown report

## Report Contents

### JSON Report Structure

```json
{
  "meta": {
    "generated_at": "ISO timestamp",
    "analyzer_version": "1.0.0",
    "runs_directory": "/home/xx/data/runs"
  },
  "period": "YYYY-MM-DD to YYYY-MM-DD",
  "summary": {
    "total_runs": 15,
    "successful_runs": 1,
    "failed_runs": 0,
    "incomplete_runs": 14,
    "success_rate": "6.7%",
    "fail_rate": "0.0%",
    "incomplete_rate": "93.3%"
  },
  "performance": {
    "total_duration_seconds": 335,
    "average_duration_seconds": 335,
    "total_tasks_executed": 1,
    "average_tasks_per_run": 0.1,
    "total_rework_count": 0,
    "average_rework_per_run": 0.00
  },
  "model_usage": {
    "opus": 0,
    "sonnet": 9,
    "haiku": 0
  },
  "model_statistics": {
    "total_model_calls": 9,
    "opus_percentage": 0.0,
    "sonnet_percentage": 100.0,
    "haiku_percentage": 0.0
  },
  "decision_breakdown": {
    "PASS": 1,
    "FAIL": 0,
    "REWORK": 0,
    "INCOMPLETE": 14
  },
  "status_breakdown": {
    "decomposing": 7,
    "executing": 3,
    "completed": 1,
    "documenting": 4
  },
  "complexity_distribution": {
    "complexity_1": 0,
    "complexity_2": 0,
    "complexity_3": 0,
    "complexity_4": 0,
    "complexity_5": 0
  },
  "common_failures": [
    {"reason": "timeout", "count": 2},
    {"reason": "validation", "count": 1}
  ],
  "recommendations": [
    "Recommendation 1",
    "Recommendation 2"
  ]
}
```

### Markdown Report Sections

1. **Executive Summary** - High-level metrics
2. **Performance Metrics** - Duration, tasks, rework
3. **Model Usage Analysis** - Model calls and estimated costs
4. **Decision Breakdown** - PASS/FAIL/INCOMPLETE distribution
5. **Status Breakdown** - Run statuses
6. **Task Complexity Distribution** - Complexity levels
7. **Common Failure Reasons** - Top failure categories
8. **Recommendations** - Actionable suggestions
9. **Quality Metrics** - Reliability and efficiency scores
10. **Next Steps** - Standard improvement checklist

## Metrics Explained

### Success Rate
Percentage of runs that completed with PASS decision.

### Failure Rate
Percentage of runs that completed with FAIL decision.

### Incomplete Rate
Percentage of runs that did not complete (stuck in decomposing, executing, etc.).

### Average Duration
Average time for successful runs (in seconds).

### Model Usage
Count of tasks assigned to each Claude model (opus/sonnet/haiku).

### Estimated Cost
Approximate cost based on model usage:
- Opus: $0.015 per task
- Sonnet: $0.003 per task
- Haiku: $0.00025 per task

*Note: These are rough estimates, actual costs vary by token count.*

### Reliability Score
`100% - fail_rate - incomplete_rate`

Rating:
- 90%+ = Excellent
- 75-90% = Good
- 60-75% = Fair
- <60% = Poor

### Efficiency Score
Based on rework rate and average duration:
- Lower rework = higher efficiency
- Faster completion = higher efficiency

Rating:
- 85%+ = Excellent
- 70-85% = Good
- 50-70% = Fair
- <50% = Poor

## Automation

### Daily Report via Cron

Add to crontab (`crontab -e`):

```bash
# Daily analytics at 4:00 AM (after nightly maintenance)
0 4 * * * /home/xx/bin/analyze-factory-history.sh --days 7 --format both > /dev/null 2>&1

# Weekly comprehensive report (Sundays at 5:00 AM)
0 5 * * 0 /home/xx/bin/analyze-factory-history.sh --format both > /dev/null 2>&1
```

### n8n Workflow Integration

Create an n8n workflow to:
1. Schedule trigger (daily/weekly)
2. SSH node to run analysis script
3. Read generated JSON report
4. Send to Feishu/Notion/Email

Example SSH command:
```bash
bash /home/xx/bin/analyze-factory-history.sh --days 7 --format json && cat /home/xx/dev/n8n-workflows/analytics/latest.json
```

## Troubleshooting

### No Runs Found

Check if runs directory exists and has data:
```bash
ls -la /home/xx/data/runs/
```

### Permission Denied

Make script executable:
```bash
chmod +x /home/xx/bin/analyze-factory-history.sh
```

### Missing Dependencies

Required commands:
- `jq` - JSON processor
- `bc` - Calculator for float operations
- `date` - Date operations

Install if missing:
```bash
sudo apt-get install jq bc coreutils
```

### Incomplete Data

Some runs may not have all files (summary.json, plan.json, etc.) if they were interrupted. The analyzer handles this gracefully and marks them as INCOMPLETE.

## Best Practices

1. **Run After Maintenance**: Schedule after nightly backups (04:00) to ensure all data is available

2. **Archive Old Reports**: Keep reports organized:
   ```bash
   mkdir -p /home/xx/dev/n8n-workflows/analytics/archive/$(date +%Y-%m)
   mv /home/xx/dev/n8n-workflows/analytics/*.json archive/$(date +%Y-%m)/
   ```

3. **Monitor Trends**: Compare weekly reports to track improvements

4. **Act on Recommendations**: Review and address recommendations in each report

5. **Clean Old Runs**: Archive runs older than 90 days:
   ```bash
   find /home/xx/data/runs -type d -mtime +90 -exec mv {} /home/xx/data/runs/archive/ \;
   ```

## Integration Examples

### Feishu Notification

```bash
#!/bin/bash
REPORT_JSON="/home/xx/dev/n8n-workflows/analytics/latest.json"
bash /home/xx/bin/analyze-factory-history.sh --days 7

SUCCESS_RATE=$(jq -r '.summary.success_rate' "$REPORT_JSON")
TOTAL_RUNS=$(jq -r '.summary.total_runs' "$REPORT_JSON")

curl -X POST "$FEISHU_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d "{
    \"msg_type\": \"text\",
    \"content\": {
      \"text\": \"AI Factory Weekly Report\n\nTotal Runs: $TOTAL_RUNS\nSuccess Rate: $SUCCESS_RATE\"
    }
  }"
```

### Export to CSV

```bash
#!/bin/bash
bash /home/xx/bin/analyze-factory-history.sh --format json

jq -r '["Date", "Total Runs", "Success Rate", "Avg Duration"],
       [.period, .summary.total_runs, .summary.success_rate, .performance.average_duration_seconds]
       | @csv' /home/xx/dev/n8n-workflows/analytics/latest.json > report.csv
```

## Version History

- **1.0.0** (2025-12-25): Initial release
  - Basic analytics and reporting
  - JSON and Markdown output
  - Time-based filtering
  - Model usage tracking
  - Recommendations engine

## Support

For issues or feature requests:
1. Check CLAUDE.md for project context
2. Review run logs in `/home/xx/data/runs/*/async.log`
3. Test with single run: `--days 1`
4. Check script with `bash -x` for debugging
