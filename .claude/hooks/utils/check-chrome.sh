#!/bin/bash
################################################################################
# Chrome Process Check Utility
#
# Purpose: Detect and manage Chrome processes
# Returns: 0 (not running), 1 (running)
# Created: 2025-10-30
# Updated: 2025-10-30 - Added help, JSON output, kill option
################################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Parse command line arguments
ARGS=$(parse_args "$@")
if [ $? -eq 1 ]; then
  show_help "check-chrome.sh" \
    "Detect and manage Chrome processes" \
    "check-chrome.sh [OPTIONS]" \
    "  -h, --help              Show this help message
  -v, --verbose           Enable verbose output
  -q, --quiet             Suppress normal output
  --json                  Output in JSON format
  --kill                  Kill all Chrome processes
  --kill-if-high          Kill if memory usage > 1GB
  --details               Show detailed process information
  --threshold MB          Memory threshold for --kill-if-high (default: 1024)" \
    "  # Check if Chrome is running
  ./check-chrome.sh

  # Kill Chrome if using > 2GB
  ./check-chrome.sh --kill-if-high --threshold 2048

  # Get JSON output for automation
  ./check-chrome.sh --json

  # Kill all Chrome processes
  ./check-chrome.sh --kill"
  exit 0
fi

# Process remaining arguments
KILL_CHROME=0
KILL_IF_HIGH=0
SHOW_DETAILS=0
MEMORY_THRESHOLD_MB=1024

set -- $ARGS
while [ $# -gt 0 ]; do
  case "$1" in
    --kill)
      KILL_CHROME=1
      shift
      ;;
    --kill-if-high)
      KILL_IF_HIGH=1
      shift
      ;;
    --threshold)
      MEMORY_THRESHOLD_MB="$2"
      shift 2
      ;;
    --details)
      SHOW_DETAILS=1
      shift
      ;;
    *)
      shift
      ;;
  esac
done

################################################################################
# Functions
################################################################################

get_chrome_processes() {
  ps aux | grep -E "(chrome|chromium)" | grep -v grep | grep -v "check-chrome"
}

get_chrome_stats() {
  local processes=$(get_chrome_processes)

  if [ -z "$processes" ]; then
    export CHROME_RUNNING=0
    export CHROME_PROCESS_COUNT=0
    export CHROME_TOTAL_MEMORY_MB=0
    export CHROME_CPU_USAGE=0
    return 0
  fi

  export CHROME_RUNNING=1

  # Count processes
  export CHROME_PROCESS_COUNT=$(echo "$processes" | wc -l)

  # Calculate total memory (RSS in KB -> MB)
  export CHROME_TOTAL_MEMORY_MB=$(echo "$processes" | awk '{sum+=$6} END {printf "%.0f", sum/1024}')

  # Calculate total CPU usage
  export CHROME_CPU_USAGE=$(echo "$processes" | awk '{sum+=$3} END {printf "%.1f", sum}')

  # Get individual processes for details
  if [ "$SHOW_DETAILS" = "1" ] || [ "$HOOKS_VERBOSE" = "1" ]; then
    export CHROME_PROCESS_DETAILS=$(echo "$processes" | awk '{
      cmd = $11;
      for (i=12; i<=NF; i++) {
        if (length(cmd " " $i) <= 50) {
          cmd = cmd " " $i;
        } else {
          cmd = cmd "...";
          break;
        }
      }
      printf "  PID %-8s CPU %5.1f%%  MEM %6.0f MB  %s\n", $2, $3, $6/1024, cmd
    }')
  fi
}

kill_chrome_processes() {
  local signal="${1:-TERM}"
  local killed_count=0

  log_info "Sending $signal signal to Chrome processes..."

  # Get all Chrome PIDs
  local pids=$(get_chrome_processes | awk '{print $2}')

  if [ -z "$pids" ]; then
    log_warning "No Chrome processes found"
    return 0
  fi

  for pid in $pids; do
    if kill -$signal "$pid" 2>/dev/null; then
      ((killed_count++))
      log_debug "Killed process $pid"
    fi
  done

  # Wait a moment and check if any remain
  sleep 2

  local remaining=$(get_chrome_processes | wc -l)
  if [ "$remaining" -gt 0 ] && [ "$signal" = "TERM" ]; then
    log_warning "$remaining processes still running, sending KILL signal..."
    kill_chrome_processes "KILL"
  else
    log_success "Killed $killed_count Chrome processes"
  fi

  return 0
}

################################################################################
# Main
################################################################################

log_debug "Checking Chrome processes..."
get_chrome_stats

# Kill if requested
if [ "$KILL_CHROME" = "1" ]; then
  kill_chrome_processes
  exit 0
fi

# Kill if memory high
if [ "$KILL_IF_HIGH" = "1" ] && [ "$CHROME_RUNNING" = "1" ]; then
  if [ "$CHROME_TOTAL_MEMORY_MB" -ge "$MEMORY_THRESHOLD_MB" ]; then
    log_warning "Chrome using ${CHROME_TOTAL_MEMORY_MB} MB (threshold: ${MEMORY_THRESHOLD_MB} MB)"
    kill_chrome_processes
    exit 0
  else
    log_info "Chrome memory OK: ${CHROME_TOTAL_MEMORY_MB} MB < ${MEMORY_THRESHOLD_MB} MB"
  fi
fi

# JSON output
if [ "$HOOKS_JSON_OUTPUT" = "1" ]; then
  if [ "$CHROME_RUNNING" = "1" ]; then
    cat << EOF
{
  "running": true,
  "process_count": $CHROME_PROCESS_COUNT,
  "total_memory_mb": $CHROME_TOTAL_MEMORY_MB,
  "cpu_usage_percent": $CHROME_CPU_USAGE,
  "exit_code": 1
}
EOF
  else
    cat << EOF
{
  "running": false,
  "process_count": 0,
  "total_memory_mb": 0,
  "cpu_usage_percent": 0,
  "exit_code": 0
}
EOF
  fi
  exit $CHROME_RUNNING
fi

# Normal output
if [ "$CHROME_RUNNING" = "0" ]; then
  log_success "Chrome not running"
  exit 0
else
  log_warning "Chrome is running ($CHROME_PROCESS_COUNT processes)"
  echo "  Total Memory: ${CHROME_TOTAL_MEMORY_MB} MB"
  echo "  CPU Usage: ${CHROME_CPU_USAGE}%"

  if [ "$SHOW_DETAILS" = "1" ] || [ "$HOOKS_VERBOSE" = "1" ]; then
    echo ""
    log_info "Process Details:"
    echo "$CHROME_PROCESS_DETAILS"
  fi

  # Warn if memory is high
  if [ "$CHROME_TOTAL_MEMORY_MB" -ge "$MEMORY_THRESHOLD_MB" ]; then
    echo ""
    log_warning "Chrome memory usage high! Consider killing with: $0 --kill"
  fi

  exit 1
fi