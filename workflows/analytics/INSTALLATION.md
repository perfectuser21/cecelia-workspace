# Factory Analytics Installation

## Files Created

### Scripts
- `/home/xx/bin/analyze-factory-history.sh` - Main analysis engine (19KB)
- `/home/xx/bin/factory-stats` - Convenience wrapper (4.6KB)

### Documentation
- `/home/xx/dev/zenithjoy-autopilot/workflows/ANALYTICS_GUIDE.md` - Complete user guide
- `/home/xx/dev/zenithjoy-autopilot/workflows/analytics/README.md` - Quick reference
- `/home/xx/dev/zenithjoy-autopilot/workflows/analytics/INSTALLATION.md` - This file

### Configuration Updated
- `/home/xx/dev/zenithjoy-autopilot/workflows/CLAUDE.md` - Added analytics section

## Quick Test

```bash
# Generate a report
bash /home/xx/bin/analyze-factory-history.sh --days 1

# View summary
bash /home/xx/bin/factory-stats summary

# View JSON
bash /home/xx/bin/factory-stats json | jq '.summary'
```

## Add to PATH (Optional)

To use `factory-stats` without full path:

```bash
# Add to ~/.bashrc or ~/.profile
echo 'export PATH="$PATH:/home/xx/bin"' >> ~/.bashrc
source ~/.bashrc

# Now you can use:
factory-stats summary
```

## Dependencies

Required tools (should already be installed):
- `jq` - JSON processor
- `bc` - Floating point calculations
- `date` - Date manipulation

Check dependencies:
```bash
which jq bc date
```

Install if missing:
```bash
sudo apt-get update
sudo apt-get install jq bc coreutils
```

## Directory Structure

```
/home/xx/
├── bin/
│   ├── analyze-factory-history.sh    # Main script
│   └── factory-stats                  # Wrapper
├── data/
│   └── runs/                          # Source data
│       ├── 20251224133524-y3jt8x/
│       ├── 20251224134906-qz3mou/
│       └── ...
└── dev/n8n-workflows/
    ├── ANALYTICS_GUIDE.md             # Full documentation
    └── analytics/                     # Reports directory
        ├── README.md
        ├── INSTALLATION.md
        ├── latest.json -> ...         # Symlink
        ├── latest.md -> ...           # Symlink
        ├── factory-analytics-*.json   # Historical reports
        └── factory-analytics-*.md
```

## Automation Setup

### Daily Cron Job

```bash
# Edit crontab
crontab -e

# Add this line for daily reports at 4 AM
0 4 * * * /home/xx/bin/analyze-factory-history.sh --days 7 --format both >> /var/log/factory-analytics.log 2>&1
```

### Weekly Summary

```bash
# Weekly comprehensive report on Sundays at 5 AM
0 5 * * 0 /home/xx/bin/analyze-factory-history.sh --format both >> /var/log/factory-analytics.log 2>&1
```

## n8n Integration

Create a workflow with:

1. **Schedule Trigger** - Daily/Weekly
2. **SSH Node** - Execute command:
   ```bash
   /home/xx/bin/analyze-factory-history.sh --days 7 --format json && cat /home/xx/dev/zenithjoy-autopilot/workflows/analytics/latest.json
   ```
3. **Code Node** - Parse JSON output
4. **Feishu/Notion Node** - Send notification

## Troubleshooting

### Script Permission Denied

```bash
chmod +x /home/xx/bin/analyze-factory-history.sh
chmod +x /home/xx/bin/factory-stats
```

### No Data Found

Check if runs directory has data:
```bash
ls -la /home/xx/data/runs/
```

### JSON Parse Error

Ensure `jq` is installed:
```bash
sudo apt-get install jq
```

### Float Comparison Error

Ensure `bc` is installed:
```bash
sudo apt-get install bc
```

## Verification

Run this test script:

```bash
#!/bin/bash
echo "=== Factory Analytics System Check ==="
echo ""

# Check scripts exist
echo "1. Checking scripts..."
test -x /home/xx/bin/analyze-factory-history.sh && echo "✓ Main script found" || echo "✗ Main script missing"
test -x /home/xx/bin/factory-stats && echo "✓ Wrapper found" || echo "✗ Wrapper missing"

# Check dependencies
echo ""
echo "2. Checking dependencies..."
command -v jq >/dev/null 2>&1 && echo "✓ jq installed" || echo "✗ jq missing"
command -v bc >/dev/null 2>&1 && echo "✓ bc installed" || echo "✗ bc missing"
command -v date >/dev/null 2>&1 && echo "✓ date installed" || echo "✗ date missing"

# Check data
echo ""
echo "3. Checking data..."
runs_count=$(find /home/xx/data/runs -maxdepth 1 -type d -name "202*" | wc -l)
echo "Found $runs_count run directories"

# Test run
echo ""
echo "4. Running test..."
bash /home/xx/bin/analyze-factory-history.sh --days 1 --format json > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✓ Analysis successful"
  test -f /home/xx/dev/zenithjoy-autopilot/workflows/analytics/latest.json && echo "✓ Report generated" || echo "✗ Report missing"
else
  echo "✗ Analysis failed"
fi

echo ""
echo "=== Check Complete ==="
```

## Uninstallation

To remove the analytics system:

```bash
# Remove scripts
rm /home/xx/bin/analyze-factory-history.sh
rm /home/xx/bin/factory-stats

# Remove reports
rm -rf /home/xx/dev/zenithjoy-autopilot/workflows/analytics/

# Remove documentation
rm /home/xx/dev/zenithjoy-autopilot/workflows/ANALYTICS_GUIDE.md

# Restore CLAUDE.md
# (manually remove the "AI 工厂分析" section)
```

## Support

For issues or questions:
1. Check `/home/xx/dev/zenithjoy-autopilot/workflows/ANALYTICS_GUIDE.md`
2. Review run logs in `/home/xx/data/runs/*/async.log`
3. Test with minimal data: `--days 1`
4. Enable debug mode: `bash -x /home/xx/bin/analyze-factory-history.sh`

## Version

- **Version**: 1.0.0
- **Date**: 2025-12-25
- **Author**: AI Factory Analytics System
