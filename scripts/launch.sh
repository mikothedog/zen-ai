#!/usr/bin/env bash
set -e

if pgrep -x rofi > /dev/null 2>&1; then
  pkill rofi
  exit 0
fi

if command -v jq &>/dev/null; then
  MODELS=$(curl -sf http://localhost:11434/api/tags | jq -r '.models[].name' 2>/dev/null || true)
elif command -v python3 &>/dev/null; then
  MODELS=$(curl -sf http://localhost:11434/api/tags | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for m in data.get('models', []):
        print(m['name'])
except: pass
" 2>/dev/null || true)
fi

if [ -n "$MODELS" ]; then
  SELECTION=$(printf '%s\n' "$MODELS" | rofi -dmenu -p "Ask AI" -l 5)
else
  SELECTION=$(rofi -dmenu -p "Ask AI" -l 0)
fi

[ -z "$SELECTION" ] && exit 0

if printf '%s\n' "$MODELS" | grep -Fxq -- "$SELECTION" 2>/dev/null; then
  zen-ai --model "$SELECTION"
else
  zen-ai "$SELECTION"
fi
