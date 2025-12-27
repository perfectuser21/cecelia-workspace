# AI Factory Analytics

This directory contains automated analytics reports for AI Factory runs.

## Quick Start

```bash
# Generate latest report
factory-stats all

# View latest report
factory-stats show

# Get JSON for automation
factory-stats json | jq '.summary'
```

## Files

- `latest.json` - Symlink to most recent JSON report
- `latest.md` - Symlink to most recent Markdown report
- `factory-analytics-YYYYMMDD-HHMMSS.json` - Historical JSON reports
- `factory-analytics-YYYYMMDD-HHMMSS.md` - Historical Markdown reports

## Report Contents

### Key Metrics
- **Success Rate**: Percentage of PASS runs
- **Average Duration**: Mean execution time for successful runs
- **Model Usage**: Distribution of opus/sonnet/haiku usage
- **Estimated Cost**: Approximate API costs
- **Reliability Score**: Overall system health (100% - fail% - incomplete%)
- **Efficiency Score**: Performance based on rework and duration

### Data Sections
1. Executive Summary
2. Performance Metrics
3. Model Usage Analysis
4. Decision Breakdown (PASS/FAIL/INCOMPLETE)
5. Status Breakdown
6. Task Complexity Distribution
7. Common Failure Reasons
8. Recommendations
9. Quality Metrics

## Commands

### Analysis Commands
```bash
factory-stats today    # Today's runs
factory-stats week     # Last 7 days
factory-stats month    # Last 30 days
factory-stats all      # All historical data
```

### View Commands
```bash
factory-stats show     # Display latest report
factory-stats json     # Show JSON report
factory-stats open     # Open in less
```

### Maintenance
```bash
factory-stats clean    # Remove old reports (keep last 10)
```

## Automation Examples

### Daily Email Report
```bash
#!/bin/bash
factory-stats today > /tmp/report.txt
mail -s "AI Factory Daily Report" admin@example.com < /tmp/report.txt
```

### Feishu Notification
```bash
#!/bin/bash
STATS=$(factory-stats json | jq -r '.summary | "Runs: \(.total_runs)\nSuccess: \(.success_rate)"')
curl -X POST "$FEISHU_WEBHOOK" -d "{\"text\": \"$STATS\"}"
```

### n8n Integration
Use SSH node to execute:
```bash
factory-stats json
```
Then parse the JSON output in downstream nodes.

## Scheduled Reports

Add to crontab:
```cron
# Daily at 4 AM
0 4 * * * /home/xx/bin/factory-stats today

# Weekly summary on Sundays
0 5 * * 0 /home/xx/bin/factory-stats week
```

## Documentation

See `ANALYTICS_GUIDE.md` in parent directory for detailed documentation.

## Support

- Script location: `/home/xx/bin/analyze-factory-history.sh`
- Data source: `/home/xx/data/runs/`
- Full guide: `/home/xx/dev/n8n-workflows/ANALYTICS_GUIDE.md`
