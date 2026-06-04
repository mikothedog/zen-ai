#!/usr/bin/env bash
set -e

if pgrep -x rofi > /dev/null 2>&1; then
  pkill rofi
  exit 0
fi

INPUT=$(rofi -dmenu -p ':ask/:code/:think' -l 0 -mesg 'type :ask / :code / :think before your query to auto-select model')
[ -z "$INPUT" ] && exit 0

zen-ai "$INPUT"
