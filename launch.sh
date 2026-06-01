#!/usr/bin/env bash
set -e

if pgrep -x rofi > /dev/null 2>&1; then
  pkill rofi
  exit 0
fi

INPUT=$(rofi -dmenu -p "Ask AI" -l 0)
[ -z "$INPUT" ] && exit 0

if ! curl -sfo /dev/null http://localhost:8765/api/models 2>/dev/null; then
  zen-ai &
  sleep 0.3
fi

ENCODED=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.stdin.read().strip()))" <<< "$INPUT" 2>/dev/null)
[ -z "$ENCODED" ] && ENCODED="$INPUT"

zen-browser -P zen-ai -no-remote "http://localhost:8765?q=$ENCODED" &
