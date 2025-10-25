#!/bin/bash

# WSL2 Health Check Script
# Purpose: Diagnose WSL2 responsiveness and recommend recovery actions
# Usage: ./.claude/wsl2-health-check.sh
# Can also be run from Windows PowerShell: wsl bash /home/novi/quotation-app/.claude/wsl2-health-check.sh

set +e  # Don't exit on errors - we want to show all diagnostics

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

print_section() {
    echo ""
    echo -e "${BOLD}$1${NC}"
    echo "----------------------------------------"
}

# Issue counter
ISSUES_FOUND=0

# Start diagnostic
print_header "WSL2 Health Check"

echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Check 1: Memory Usage
print_section "1. Memory Usage"

MEM_INFO=$(free -h 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "$MEM_INFO"
    echo ""

    MEM_PERCENT=$(free | grep Mem | awk '{printf "%.0f", ($3/$2)*100}')
    SWAP_PERCENT=$(free | grep Swap | awk '{if ($2 > 0) printf "%.0f", ($3/$2)*100; else print "0"}')

    print_info "Memory: ${MEM_PERCENT}% used"
    print_info "Swap: ${SWAP_PERCENT}% used"

    if [ "$MEM_PERCENT" -lt 60 ]; then
        print_success "Memory usage healthy"
    elif [ "$MEM_PERCENT" -lt 75 ]; then
        print_warning "Memory usage moderate (${MEM_PERCENT}%)"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    elif [ "$MEM_PERCENT" -lt 85 ]; then
        print_warning "Memory usage high (${MEM_PERCENT}%)"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    else
        print_error "Memory usage critical (${MEM_PERCENT}%)"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi

    if [ "$SWAP_PERCENT" -gt 50 ]; then
        print_warning "Swap usage high (${SWAP_PERCENT}%) - system may be slow"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
else
    print_error "Failed to check memory usage"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Check 2: Chrome Processes
print_section "2. Chrome Processes"

CHROME_PROCS=$(pgrep -f chrome 2>/dev/null)
if [ -n "$CHROME_PROCS" ]; then
    CHROME_COUNT=$(echo "$CHROME_PROCS" | wc -l)
    print_warning "Found $CHROME_COUNT Chrome processes"

    # Show Chrome memory usage
    CHROME_MEM=$(ps aux | grep -E '[c]hrome|[C]hrome' | awk '{sum+=$4} END {printf "%.1f", sum}')
    print_info "Chrome memory usage: ${CHROME_MEM}%"

    # Show top Chrome processes
    echo ""
    echo "Top Chrome processes by memory:"
    ps aux | grep -E '[c]hrome|[C]hrome' | sort -k4 -r | head -5 | awk '{printf "  PID %-7s  MEM %5s%%  CMD %s\n", $2, $4, $11}'

    if [ $(echo "$CHROME_MEM > 30" | bc -l 2>/dev/null || echo 0) -eq 1 ]; then
        print_warning "Chrome using excessive memory (${CHROME_MEM}%)"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
else
    print_success "No Chrome processes running"
fi

# Check 3: Development Servers
print_section "3. Development Servers"

# Check Next.js
NEXT_PROCS=$(pgrep -f "node.*next" 2>/dev/null)
if [ -n "$NEXT_PROCS" ]; then
    print_info "Next.js dev server running (PID: $(echo $NEXT_PROCS | tr '\n' ' '))"
else
    print_info "Next.js dev server not running"
fi

# Check FastAPI
UVICORN_PROCS=$(pgrep -f "uvicorn" 2>/dev/null)
if [ -n "$UVICORN_PROCS" ]; then
    print_info "FastAPI backend running (PID: $(echo $UVICORN_PROCS | tr '\n' ' '))"
else
    print_info "FastAPI backend not running"
fi

# Check 4: Zombie Processes
print_section "4. Zombie Processes"

ZOMBIES=$(ps aux | awk '{if ($8 == "Z") print $0}' 2>/dev/null)
if [ -n "$ZOMBIES" ]; then
    ZOMBIE_COUNT=$(echo "$ZOMBIES" | wc -l)
    print_warning "Found $ZOMBIE_COUNT zombie processes"
    echo "$ZOMBIES"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    print_success "No zombie processes"
fi

# Check 5: Disk Usage
print_section "5. Disk Usage"

DISK_INFO=$(df -h / 2>/dev/null | tail -1)
if [ $? -eq 0 ]; then
    echo "$DISK_INFO"

    DISK_PERCENT=$(echo "$DISK_INFO" | awk '{print $5}' | sed 's/%//')
    print_info "Disk usage: ${DISK_PERCENT}%"

    if [ "$DISK_PERCENT" -gt 85 ]; then
        print_warning "Disk usage high (${DISK_PERCENT}%)"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    else
        print_success "Disk usage healthy"
    fi
fi

# Check 6: System Load
print_section "6. System Load"

LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
CPU_COUNT=$(nproc)
LOAD_PERCENT=$(echo "scale=0; ($LOAD_AVG / $CPU_COUNT) * 100" | bc 2>/dev/null || echo "0")

print_info "Load average: $LOAD_AVG (CPUs: $CPU_COUNT)"
print_info "Load percentage: ${LOAD_PERCENT}%"

if [ "$LOAD_PERCENT" -gt 80 ]; then
    print_warning "System load high (${LOAD_PERCENT}%)"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    print_success "System load healthy"
fi

# Check 7: Chrome DevTools MCP
print_section "7. Chrome DevTools MCP"

MCP_PROCS=$(pgrep -f "chrome-devtools-mcp" 2>/dev/null)
if [ -n "$MCP_PROCS" ]; then
    print_info "Chrome DevTools MCP running (PID: $(echo $MCP_PROCS | tr '\n' ' '))"

    # Check if Chrome is actually connected
    CHROME_PORT=9222
    if curl -s "http://127.0.0.1:$CHROME_PORT/json" > /dev/null 2>&1; then
        print_success "Chrome remote debugging accessible on port $CHROME_PORT"
    else
        print_warning "Chrome DevTools MCP running but Chrome not accessible on port $CHROME_PORT"
        print_info "This may be an orphaned process from a previous session"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
else
    print_info "Chrome DevTools MCP not running"
fi

# Check 8: VS Code Remote WSL Processes
print_section "8. VS Code Remote WSL"

VSCODE_PROCS=$(pgrep -f "vscode-server" 2>/dev/null)
if [ -n "$VSCODE_PROCS" ]; then
    VSCODE_COUNT=$(echo "$VSCODE_PROCS" | wc -l)
    print_info "VS Code server processes: $VSCODE_COUNT"

    # Check if any are hung (using high CPU for extended time)
    HIGH_CPU=$(ps aux | grep -E '[v]scode-server' | awk '{if ($3 > 50) print $2}')
    if [ -n "$HIGH_CPU" ]; then
        print_warning "VS Code server processes with high CPU usage"
        echo "$HIGH_CPU" | while read pid; do
            print_info "  PID $pid"
        done
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    else
        print_success "VS Code server processes healthy"
    fi
else
    print_warning "No VS Code server processes found - VS Code not connected"
fi

# Summary
print_header "Health Check Summary"

if [ $ISSUES_FOUND -eq 0 ]; then
    print_success "WSL2 is healthy - no issues found"
    echo ""
    echo "System is operating normally."
else
    print_warning "Found $ISSUES_FOUND potential issues"
    echo ""
    print_header "Recommended Actions"

    # Recommendations based on findings
    MEM_PERCENT=$(free | grep Mem | awk '{printf "%.0f", ($3/$2)*100}')

    if [ "$MEM_PERCENT" -ge 75 ]; then
        echo "1. High Memory Usage (${MEM_PERCENT}%):"

        if pgrep -f chrome > /dev/null 2>&1; then
            echo "   → Kill Chrome: pkill -9 chrome"
        fi

        if pgrep -f "node.*next" > /dev/null 2>&1; then
            echo "   → Stop Next.js: pkill -f 'node.*next'"
        fi

        if pgrep -f uvicorn > /dev/null 2>&1; then
            echo "   → Stop FastAPI: pkill -f uvicorn"
        fi

        echo "   → Free cache: sync && echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null"
        echo ""
    fi

    if pgrep -f "chrome-devtools-mcp" > /dev/null 2>&1 && ! curl -s "http://127.0.0.1:9222/json" > /dev/null 2>&1; then
        echo "2. Orphaned Chrome DevTools MCP:"
        echo "   → Kill MCP process: pkill -f chrome-devtools-mcp"
        echo ""
    fi

    if [ $ISSUES_FOUND -ge 3 ]; then
        echo "3. Multiple Issues Detected:"
        echo "   → Restart WSL2 (from Windows PowerShell):"
        echo "     wsl --shutdown"
        echo "     (wait 8 seconds, then: wsl)"
        echo ""
    fi

    if [ "$MEM_PERCENT" -ge 85 ]; then
        echo "4. Critical Memory Usage:"
        echo "   → Consider reducing .wslconfig memory limit"
        echo "   → Location: C:\\Users\\Lenovo\\.wslconfig"
        echo "   → Try: memory=4GB instead of 6GB"
        echo ""
    fi
fi

# Exit with status code
if [ $ISSUES_FOUND -eq 0 ]; then
    exit 0
else
    exit 1
fi
