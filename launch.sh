#!/usr/bin/env bash
set -e

if pgrep -x rofi > /dev/null 2>&1; then
  pkill rofi
  exit 0
fi

INPUT=$(rofi -dmenu -p "Ask AI" -l 0)
[ -z "$INPUT" ] && exit 0

zen-ai "$INPUT"
