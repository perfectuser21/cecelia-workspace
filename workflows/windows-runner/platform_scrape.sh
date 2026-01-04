#!/bin/bash
# Platform data scraping script - VPS 端直接通过 CDP 控制 Windows Chrome
# Usage: ./platform_scrape.sh <platform>

PLATFORM=$1

if [ -z "$PLATFORM" ]; then
  echo '{"error": "Platform not specified"}'
  exit 1
fi

# Map old platform names to new ones
case "$PLATFORM" in
  douyin) PLATFORM_NEW="douyin" ;;
  kuaishou) PLATFORM_NEW="kuaishou" ;;
  xiaohongshu) PLATFORM_NEW="xiaohongshu" ;;
  toutiao) PLATFORM_NEW="toutiao-main" ;;
  toutiao-2|toutiao2) PLATFORM_NEW="toutiao-sub" ;;
  weibo) PLATFORM_NEW="weibo" ;;
  channels|shipinhao) PLATFORM_NEW="shipinhao" ;;
  gongzhonghao) PLATFORM_NEW="gongzhonghao" ;;
  zhihu) PLATFORM_NEW="zhihu" ;;
  *) echo "{\"error\": \"Unknown platform: $PLATFORM\"}" && exit 1 ;;
esac

# Run VPS scraper from project directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" && node vps_scraper.js "$PLATFORM_NEW"
