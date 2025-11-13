#!/bin/bash
################################################################################
# WSL2 Memory Check Utility
#
# Purpose: Monitor WSL2 memory usage and warn about high usage
# Returns: 0 (OK), 1 (Warning), 2 (Critical)
# Created: 2025-10-30
# Updated: 2025-10-30 - Added help, JSON output, configurable thresholds
################################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Default thresholds (can override via environment)
MEMORY_WARNING_THRESHOLD="${MEMORY_WARNING_THRESHOLD:-60}"
MEMORY_CRITICAL_THRESHOLD="${MEMORY_CRITICAL_THRESHOLD:-75}"

# Parse command line arguments
ARGS=$(parse_args "$@")
if [ $? -eq 1 ]; then
  show_help "check-memory.sh" \
    "Monitor WSL2 memory usage and warn about high usage" \
    "check-memory.sh [OPTIONS]" \
    "  -h, --help              Show this help message
  -v, --verbose           Enable verbose output
  -q, --quiet             Suppress normal output
  --json                  Output in JSON format
  --warning PERCENT       Warning threshold (default: 60%)
  --critical PERCENT      Critical threshold (default: 75%)
  --details               Show detailed memory breakdown" \
    "  # Check memory with default thresholds
  ./check-memory.sh

  # Check with custom thresholds
  ./check-memory.sh --warning 50 --critical 70

  # Get JSON output for automation
  ./check-memory.sh --json

  # Show detailed memory breakdown
  ./check-memory.sh --details"
  exit 0
fi

# Process remaining arguments
set -- $ARGS
while [ $# -gt 0 ]; do
  case "$1" in
    --warning)
      MEMORY_WARNING_THRESHOLD="$2"
      shift 2
      ;;
    --critical)
      MEMORY_CRITICAL_THRESHOLD="$2"
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

get_memory_info() {
  # Get memory stats
  local mem_info=$(free -b)

  # Parse values
  local total=$(echo "$mem_info" | grep Mem | awk '{print $2}')
  local used=$(echo "$mem_info" | grep Mem | awk '{print $3}')
  local free=$(echo "$mem_info" | grep Mem | awk '{print $4}')
  local available=$(echo "$mem_info" | grep Mem | awk '{print $7}')
  local swap_total=$(echo "$mem_info" | grep Swap | awk '{print $2}')
  local swap_used=$(echo "$mem_info" | grep Swap | awk '{print $3}')

  # Calculate percentages
  local mem_percent=0
  if [ "$total" -gt 0 ]; then
    mem_percent=$(awk "BEGIN {printf \"%.1f\", ($used/$total)*100}")
  fi

  local swap_percent=0
  if [ "$swap_total" -gt 0 ]; then
    swap_percent=$(awk "BEGIN {printf \"%.1f\", ($swap_used/$swap_total)*100}")
  fi

  # Convert to human readable
  local total_gb=$(awk "BEGIN {printf \"%.2f\", $total/1073741824}")
  local used_gb=$(awk "BEGIN {printf \"%.2f\", $used/1073741824}")
  local free_gb=$(awk "BEGIN {printf \"%.2f\", $free/1073741824}")
  local available_gb=$(awk "BEGIN {printf \"%.2f\", $available/1073741824}")
  local swap_total_gb=$(awk "BEGIN {printf \"%.2f\", $swap_total/1073741824}")
  local swap_used_gb=$(awk "BEGIN {printf \"%.2f\", $swap_used/1073741824}")

  # Export values for use
  export MEM_PERCENT="$mem_percent"
  export MEM_TOTAL_GB="$total_gb"
  export MEM_USED_GB="$used_gb"
  export MEM_FREE_GB="$free_gb"
  export MEM_AVAILABLE_GB="$available_gb"
  export SWAP_PERCENT="$swap_percent"
  export SWAP_TOTAL_GB="$swap_total_gb"
  export SWAP_USED_GB="$swap_used_gb"
}

get_top_processes() {
  # Get top 5 memory consumers
  ps aux --sort=-%mem | head -6 | tail -5 | awk '{printf "  %s: %.1f%%\n", $11, $4}'
}

check_memory_status() {
  local percent="${1%.*}"  # Remove decimal part for comparison

  if [ "$percent" -ge "$MEMORY_CRITICAL_THRESHOLD" ]; then
    echo "CRITICAL"
    return 2
  elif [ "$percent" -ge "$MEMORY_WARNING_THRESHOLD" ]; then
    echo "WARNING"
    return 1
  else
    echo "OK"
    return 0
  fi
}

################################################################################
# Main
################################################################################

log_debug "Checking memory status..."
get_memory_info

STATUS=$(check_memory_status "$MEM_PERCENT")
EXIT_CODE=$?

# JSON output
if [ "$HOOKS_JSON_OUTPUT" = "1" ]; then
  cat << EOF
{
  "status": "$STATUS",
  "memory": {
    "percent": $MEM_PERCENT,
    "total_gb": $MEM_TOTAL_GB,
    "used_gb": $MEM_USED_GB,
    "free_gb": $MEM_FREE_GB,
    "available_gb": $MEM_AVAILABLE_GB
  },
  "swap": {
    "percent": $SWAP_PERCENT,
    "total_gb": $SWAP_TOTAL_GB,
    "used_gb": $SWAP_USED_GB
  },
  "thresholds": {
    "warning": $MEMORY_WARNING_THRESHOLD,
    "critical": $MEMORY_CRITICAL_THRESHOLD
  },
  "exit_code": $EXIT_CODE
}
EOF
  exit $EXIT_CODE
fi

# Normal output
case "$STATUS" in
  CRITICAL)
    log_error "Memory usage CRITICAL: ${MEM_PERCENT}% (threshold: ${MEMORY_CRITICAL_THRESHOLD}%)"
    ;;
  WARNING)
    log_warning "Memory usage WARNING: ${MEM_PERCENT}% (threshold: ${MEMORY_WARNING_THRESHOLD}%)"
    ;;
  OK)
    log_success "Memory usage OK: ${MEM_PERCENT}%"
    ;;
esac

# Show details if requested
if [ "${SHOW_DETAILS:-0}" = "1" ]; then
  echo ""
  log_info "Memory Details:"
  echo "  Total: ${MEM_TOTAL_GB} GB"
  echo "  Used: ${MEM_USED_GB} GB (${MEM_PERCENT}%)"
  echo "  Free: ${MEM_FREE_GB} GB"
  echo "  Available: ${MEM_AVAILABLE_GB} GB"

  if [ "$SWAP_TOTAL_GB" != "0.00" ]; then
    echo ""
    log_info "Swap Details:"
    echo "  Total: ${SWAP_TOTAL_GB} GB"
    echo "  Used: ${SWAP_USED_GB} GB (${SWAP_PERCENT}%)"
  fi

  if [ "$EXIT_CODE" -ne 0 ]; then
    echo ""
    log_info "Top Memory Consumers:"
    get_top_processes
  fi
fi

exit $EXIT_CODE
