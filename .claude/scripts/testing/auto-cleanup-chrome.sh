#!/bin/bash

# Auto-Cleanup Chrome Script
# Purpose: Monitors WSL2 memory and automatically kills Chrome when usage exceeds threshold
# Usage: ./.claude/auto-cleanup-chrome.sh [threshold_percent]
# Default threshold: 85%

set -e

# Configuration
THRESHOLD=${1:-85}  # Default to 85% if not specified
CHECK_INTERVAL=5    # Check every 5 seconds
LOG_FILE="/tmp/chrome-auto-cleanup.log"
CHROME_PORT=9222

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Colored log function
log_color() {
    local color=$1
    shift
    echo -e "${color}[$(date '+%Y-%m-%d %H:%M:%S')] $*${NC}" | tee -a "$LOG_FILE"
}

# Initialize log
log "=========================================="
log "Auto-Cleanup Chrome Script Started"
log "Memory threshold: ${THRESHOLD}%"
log "Check interval: ${CHECK_INTERVAL}s"
log "=========================================="

# Trap to handle script termination
trap 'log "Auto-cleanup script stopped"; exit 0' INT TERM

# Function to get memory percentage
get_memory_percent() {
    free | grep Mem | awk '{printf "%.0f", ($3/$2)*100}'
}

# Function to get Chrome memory usage
get_chrome_memory() {
    if pgrep -f "chrome.*remote-debugging-port=$CHROME_PORT" > /dev/null 2>&1; then
        ps aux | grep -E '[c]hrome.*remote-debugging' | awk '{sum+=$4} END {printf "%.1f", sum}'
    else
        echo "0"
    fi
}

# Function to kill Chrome
kill_chrome() {
    local chrome_pids=$(pgrep -f "chrome.*remote-debugging-port=$CHROME_PORT" 2>/dev/null || true)

    if [ -z "$chrome_pids" ]; then
        log_color "$YELLOW" "No Chrome processes found to kill"
        return 1
    fi

    log_color "$RED" "🔴 KILLING CHROME - Memory threshold exceeded!"
    log "Chrome PIDs: $chrome_pids"

    # Kill Chrome processes
    echo "$chrome_pids" | xargs kill -9 2>/dev/null || true
    sleep 2

    # Verify killed
    if pgrep -f "chrome.*remote-debugging-port=$CHROME_PORT" > /dev/null 2>&1; then
        log_color "$RED" "⚠️  Failed to kill some Chrome processes"
        return 1
    else
        log_color "$GREEN" "✓ Chrome killed successfully"

        # Clean up profile directory
        local profile_dir="/tmp/chrome-wsl-profile"
        if [ -d "$profile_dir" ]; then
            rm -rf "$profile_dir" 2>/dev/null || true
            log "Cleaned up Chrome profile directory"
        fi

        return 0
    fi
}

# Function to check and cleanup if needed
check_and_cleanup() {
    local mem_percent=$(get_memory_percent)
    local chrome_mem=$(get_chrome_memory)

    # Log current status (every 10th check = 50 seconds)
    if [ $((SECONDS % 50)) -lt $CHECK_INTERVAL ]; then
        log_color "$BLUE" "Status: Memory ${mem_percent}% | Chrome ${chrome_mem}% | Threshold ${THRESHOLD}%"
    fi

    # Check if memory exceeds threshold
    if [ "$mem_percent" -ge "$THRESHOLD" ]; then
        log_color "$YELLOW" "⚠️  ALERT: Memory usage at ${mem_percent}% (threshold: ${THRESHOLD}%)"

        # Check if Chrome is running
        if pgrep -f "chrome.*remote-debugging-port=$CHROME_PORT" > /dev/null 2>&1; then
            log_color "$YELLOW" "Chrome is using ${chrome_mem}% of total memory"

            # Kill Chrome to prevent WSL2 freeze
            kill_chrome

            # Log post-cleanup memory
            sleep 2
            local new_mem_percent=$(get_memory_percent)
            log_color "$GREEN" "Memory after cleanup: ${new_mem_percent}% (freed $((mem_percent - new_mem_percent))%)"
        else
            log_color "$YELLOW" "Memory high but Chrome not running - check other processes"
        fi
    fi
}

# Main monitoring loop
log_color "$GREEN" "Monitoring started (Ctrl+C to stop)"
echo ""
echo -e "${BOLD}Auto-Cleanup Chrome - Memory Monitor${NC}"
echo "Memory threshold: ${THRESHOLD}%"
echo "Check interval: ${CHECK_INTERVAL}s"
echo "Log file: $LOG_FILE"
echo ""
echo -e "${GREEN}Monitoring... (Press Ctrl+C to stop)${NC}"
echo ""

while true; do
    check_and_cleanup
    sleep "$CHECK_INTERVAL"
done
