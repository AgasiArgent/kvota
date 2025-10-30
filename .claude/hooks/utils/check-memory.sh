#!/bin/bash
# WSL2 Memory Check Utility
# Returns: 0 (OK <60%), 1 (Warning 60-75%), 2 (Critical >75%)

get_memory_percent() {
  free | grep Mem | awk '{printf "%.0f", ($3/$2)*100}'
}

MEM_PERCENT=$(get_memory_percent)

if [ "$MEM_PERCENT" -ge 75 ]; then
  echo "CRITICAL: Memory at ${MEM_PERCENT}%"
  exit 2
elif [ "$MEM_PERCENT" -ge 60 ]; then
  echo "WARNING: Memory at ${MEM_PERCENT}%"
  exit 1
else
  echo "OK: Memory at ${MEM_PERCENT}%"
  exit 0
fi
