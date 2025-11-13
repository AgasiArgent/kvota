#!/bin/bash

# Safe Test Session Manager
# Purpose: Wrapper for Chrome DevTools MCP testing with automatic resource management
# Usage: ./.claude/safe-test-session.sh [full|headless] [url] [timeout_minutes]
# Example: ./.claude/safe-test-session.sh full http://localhost:3001/quotes/create 15

set -e

# Configuration
MODE="${1:-headless}"  # Default to headless (less memory)
URL="${2:-http://localhost:3000/quotes/create}"
TIMEOUT_MINUTES="${3:-10}"  # Default 10 minute timeout
MEMORY_THRESHOLD=85  # Kill Chrome at 85% memory

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAUNCH_SCRIPT="$SCRIPT_DIR/launch-chrome-testing.sh"
AUTO_CLEANUP_SCRIPT="$SCRIPT_DIR/auto-cleanup-chrome.sh"
MONITOR_SCRIPT="$SCRIPT_DIR/monitor-wsl-resources.sh"

# PIDs for cleanup
MONITOR_PID=""
CLEANUP_PID=""
CHROME_PID=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

# Print functions
print_header() {
    echo ""
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}$1${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Cleanup function - called on exit or interrupt
cleanup() {
    local exit_code=$?

    print_header "Cleaning Up Test Session"

    # Kill Chrome
    if [ -n "$CHROME_PID" ] && ps -p "$CHROME_PID" > /dev/null 2>&1; then
        print_info "Stopping Chrome..."
        "$LAUNCH_SCRIPT" kill || true
    fi

    # Kill auto-cleanup script
    if [ -n "$CLEANUP_PID" ] && ps -p "$CLEANUP_PID" > /dev/null 2>&1; then
        print_info "Stopping auto-cleanup monitor..."
        kill "$CLEANUP_PID" 2>/dev/null || true
    fi

    # Kill resource monitor
    if [ -n "$MONITOR_PID" ] && ps -p "$MONITOR_PID" > /dev/null 2>&1; then
        print_info "Stopping resource monitor..."
        kill "$MONITOR_PID" 2>/dev/null || true
    fi

    # Final memory check
    local final_mem=$(free | grep Mem | awk '{printf "%.0f", ($3/$2)*100}')
    print_info "Final memory usage: ${final_mem}%"

    print_success "Cleanup complete"
    echo ""

    exit "$exit_code"
}

# Trap all exit signals
trap cleanup EXIT INT TERM

# Show session configuration
print_header "Safe Test Session Manager"

echo "Configuration:"
echo "  Mode: $MODE"
echo "  URL: $URL"
echo "  Timeout: $TIMEOUT_MINUTES minutes"
echo "  Memory threshold: $MEMORY_THRESHOLD%"
echo ""

# Validate scripts exist
if [ ! -f "$LAUNCH_SCRIPT" ]; then
    print_error "Launch script not found: $LAUNCH_SCRIPT"
    exit 1
fi

if [ ! -f "$AUTO_CLEANUP_SCRIPT" ]; then
    print_error "Auto-cleanup script not found: $AUTO_CLEANUP_SCRIPT"
    exit 1
fi

# Step 1: Check initial memory
print_header "Step 1: Pre-flight Checks"

INITIAL_MEM=$(free | grep Mem | awk '{printf "%.0f", ($3/$2)*100}')
print_info "Initial memory usage: ${INITIAL_MEM}%"

if [ "$INITIAL_MEM" -gt 70 ]; then
    print_warning "Memory usage already high (${INITIAL_MEM}%) - recommend restarting WSL2"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

print_success "Memory check passed"

# Step 2: Start auto-cleanup monitor
print_header "Step 2: Starting Auto-Cleanup Monitor"

"$AUTO_CLEANUP_SCRIPT" "$MEMORY_THRESHOLD" > /tmp/auto-cleanup-output.log 2>&1 &
CLEANUP_PID=$!

sleep 2

if ps -p "$CLEANUP_PID" > /dev/null 2>&1; then
    print_success "Auto-cleanup monitor started (PID: $CLEANUP_PID)"
    print_info "Will auto-kill Chrome if memory exceeds ${MEMORY_THRESHOLD}%"
else
    print_error "Failed to start auto-cleanup monitor"
    exit 1
fi

# Step 3: Launch Chrome
print_header "Step 3: Launching Chrome ($MODE mode)"

"$LAUNCH_SCRIPT" "$MODE" "$URL"

if [ $? -eq 0 ]; then
    CHROME_PID=$(pgrep -f "chrome.*remote-debugging-port=9222" | head -1)
    print_success "Chrome launched successfully"
    print_info "Chrome PID: ${CHROME_PID:-unknown}"
else
    print_error "Failed to launch Chrome"
    exit 1
fi

# Step 4: Show status and wait for testing
print_header "Step 4: Testing Session Active"

echo -e "${GREEN}✓ All systems ready${NC}"
echo ""
echo "Chrome is running and ready for testing"
echo "Auto-cleanup will kill Chrome if memory exceeds ${MEMORY_THRESHOLD}%"
echo ""
echo -e "${YELLOW}Session will timeout in ${TIMEOUT_MINUTES} minutes${NC}"
echo -e "${YELLOW}Press Ctrl+C to end session early${NC}"
echo ""
print_info "Auto-cleanup log: tail -f /tmp/chrome-auto-cleanup.log"
echo ""

# Wait for timeout or user interrupt
SECONDS=0
TIMEOUT_SECONDS=$((TIMEOUT_MINUTES * 60))

while [ $SECONDS -lt $TIMEOUT_SECONDS ]; do
    # Check if Chrome is still running
    if ! pgrep -f "chrome.*remote-debugging-port=9222" > /dev/null 2>&1; then
        print_warning "Chrome was terminated (possibly by auto-cleanup)"
        break
    fi

    # Show progress every 30 seconds
    if [ $((SECONDS % 30)) -eq 0 ] && [ $SECONDS -gt 0 ]; then
        local remaining=$((TIMEOUT_SECONDS - SECONDS))
        local remaining_min=$((remaining / 60))
        local mem_now=$(free | grep Mem | awk '{printf "%.0f", ($3/$2)*100}')
        print_info "Time remaining: ${remaining_min}m | Memory: ${mem_now}%"
    fi

    sleep 5
done

# Check if timeout occurred
if [ $SECONDS -ge $TIMEOUT_SECONDS ]; then
    print_warning "Session timeout reached (${TIMEOUT_MINUTES} minutes)"
fi

# Step 5: Summary
print_header "Session Summary"

FINAL_MEM=$(free | grep Mem | awk '{printf "%.0f", ($3/$2)*100}')
MEM_DELTA=$((FINAL_MEM - INITIAL_MEM))

echo "Memory usage:"
echo "  Initial: ${INITIAL_MEM}%"
echo "  Final: ${FINAL_MEM}%"
if [ $MEM_DELTA -gt 0 ]; then
    echo -e "  Change: ${RED}+${MEM_DELTA}%${NC}"
else
    echo -e "  Change: ${GREEN}${MEM_DELTA}%${NC}"
fi
echo ""

DURATION_MIN=$((SECONDS / 60))
echo "Session duration: ${DURATION_MIN} minutes"
echo ""

# Check cleanup log for auto-kills
if grep -q "KILLING CHROME" /tmp/chrome-auto-cleanup.log 2>/dev/null; then
    print_warning "Chrome was auto-killed during session (check /tmp/chrome-auto-cleanup.log)"
else
    print_success "No auto-cleanup triggered"
fi

print_success "Session completed safely"

# Cleanup will happen automatically via trap
