#!/bin/bash
# Chrome Process Check Utility
# Returns: 0 (not running), 1 (running)

if pgrep -x "chrome" > /dev/null; then
  echo "Chrome is running"
  ps aux | grep chrome | grep -v grep | awk '{printf "PID %s  MEM %s%%\n", $2, $4}'
  exit 1
else
  echo "Chrome not running"
  exit 0
fi
