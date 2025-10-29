#!/bin/bash

# WSL2 Resource Monitor
# Purpose: Monitor WSL2 resource usage in real-time to prevent freezing
# Usage: ./monitor-wsl-resources.sh

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Clear screen and show header
clear
echo -e "${BOLD}Monitoring WSL2 Resources (Press Ctrl+C to stop)${NC}"
echo "================================================"
echo ""

# Trap Ctrl+C to exit gracefully
trap 'echo -e "\n\nMonitoring stopped."; exit 0' INT

while true; do
    # Get current time
    TIMESTAMP=$(date +"%H:%M:%S")

    # Get memory info
    MEM_INFO=$(free | grep Mem)
    MEM_TOTAL=$(echo $MEM_INFO | awk '{print $2}')
    MEM_USED=$(echo $MEM_INFO | awk '{print $3}')
    MEM_PERCENT=$(awk "BEGIN {printf \"%.0f\", ($MEM_USED/$MEM_TOTAL)*100}")

    # Get swap info
    SWAP_INFO=$(free | grep Swap)
    SWAP_TOTAL=$(echo $SWAP_INFO | awk '{print $2}')
    SWAP_USED=$(echo $SWAP_INFO | awk '{print $3}')
    if [ "$SWAP_TOTAL" -eq 0 ]; then
        SWAP_PERCENT=0
    else
        SWAP_PERCENT=$(awk "BEGIN {printf \"%.0f\", ($SWAP_USED/$SWAP_TOTAL)*100}")
    fi

    # Get CPU usage (average over 1 second)
    CPU_PERCENT=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}' | awk '{printf "%.0f", $1}')

    # Get Chrome memory usage if running
    CHROME_MEM=""
    CHROME_PERCENT=""
    if pgrep -x "chrome" > /dev/null; then
        CHROME_MEM_KB=$(ps aux | grep -E '[c]hrome|[C]hrome' | awk '{sum+=$6} END {print sum}')
        if [ ! -z "$CHROME_MEM_KB" ]; then
            CHROME_PERCENT=$(awk "BEGIN {printf \"%.1f\", ($CHROME_MEM_KB/$MEM_TOTAL)*100}")
            CHROME_MEM=" | Chrome: ${CHROME_PERCENT}%"
        fi
    fi

    # Determine color based on memory usage
    if [ "$MEM_PERCENT" -lt 60 ]; then
        COLOR=$GREEN
        STATUS=""
    elif [ "$MEM_PERCENT" -lt 75 ]; then
        COLOR=$YELLOW
        STATUS=" ⚠️  WARNING"
    else
        COLOR=$RED
        STATUS=" 🔴 CRITICAL"
    fi

    # Print status line with color
    echo -e "${COLOR}${TIMESTAMP} | Memory: ${MEM_PERCENT}% | Swap: ${SWAP_PERCENT}% | CPU: ${CPU_PERCENT}%${CHROME_MEM}${STATUS}${NC}"

    # Show recommendations if critical
    if [ "$MEM_PERCENT" -ge 75 ]; then
        echo ""
        echo -e "${RED}${BOLD}⚠️  CRITICAL: Memory usage above 75%!${NC}"
        echo "Recommendations:"

        # Check if Chrome is running
        if pgrep -x "chrome" > /dev/null; then
            echo -e "  ${YELLOW}→ Kill Chrome: ${NC}pkill -9 chrome"
        fi

        # Check if Next.js dev server is running
        if pgrep -f "node.*next" > /dev/null; then
            echo -e "  ${YELLOW}→ Stop Next.js dev server: ${NC}pkill -f 'node.*next'"
        fi

        # Check if uvicorn is running
        if pgrep -f "uvicorn" > /dev/null; then
            echo -e "  ${YELLOW}→ Stop FastAPI backend: ${NC}pkill -f 'uvicorn'"
        fi

        # General recommendations
        echo -e "  ${YELLOW}→ Free memory: ${NC}sync && echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null"
        echo -e "  ${YELLOW}→ Restart WSL2: ${NC}wsl --shutdown (from Windows PowerShell)"
        echo ""

        # Add extra spacing before next update
        sleep 3
    fi

    # Wait 2 seconds before next update
    sleep 2
done
