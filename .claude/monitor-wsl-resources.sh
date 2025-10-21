#!/bin/bash
# WSL2 Resource Monitor - Prevents freezing by warning when memory/CPU is high
# Run this in a separate terminal while testing to monitor resource usage

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
WARNING_THRESHOLD=75    # Warn at 75% memory usage
CRITICAL_THRESHOLD=85   # Critical alert at 85% memory usage
CHECK_INTERVAL=5        # Check every 5 seconds

# Flags for one-time warnings
warned=false
critical_warned=false

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}WSL2 Resource Monitor${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Monitoring memory and CPU usage..."
echo "Warning threshold: ${WARNING_THRESHOLD}%"
echo "Critical threshold: ${CRITICAL_THRESHOLD}%"
echo "Press Ctrl+C to stop"
echo ""

# Function: Get memory usage percentage
get_memory_usage() {
  free -m | awk 'NR==2{printf "%.0f", $3*100/$2}'
}

# Function: Get swap usage percentage
get_swap_usage() {
  free -m | awk 'NR==3{if($2>0) printf "%.0f", $3*100/$2; else print "0"}'
}

# Function: Get CPU usage percentage
get_cpu_usage() {
  top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{printf "%.0f", 100 - $1}'
}

# Function: Get Chrome memory usage
get_chrome_memory() {
  ps aux | grep chrome | grep -v grep | awk '{sum+=$4} END {printf "%.1f", sum}'
}

# Function: Display current status
display_status() {
  local mem_usage=$1
  local swap_usage=$2
  local cpu_usage=$3
  local chrome_mem=$4
  local timestamp=$(date '+%H:%M:%S')

  # Determine color based on usage
  local mem_color=$GREEN
  if [ "$mem_usage" -ge "$CRITICAL_THRESHOLD" ]; then
    mem_color=$RED
  elif [ "$mem_usage" -ge "$WARNING_THRESHOLD" ]; then
    mem_color=$YELLOW
  fi

  # Clear line and print status
  echo -ne "\r${timestamp} | Memory: ${mem_color}${mem_usage}%${NC} | Swap: ${swap_usage}% | CPU: ${cpu_usage}% | Chrome: ${chrome_mem}%  "
}

# Function: Show detailed breakdown
show_breakdown() {
  echo -e "\n"
  echo -e "${YELLOW}Detailed Resource Breakdown:${NC}"
  echo ""

  # Memory
  echo -e "${BLUE}Memory:${NC}"
  free -h | grep -E "Mem|Swap"
  echo ""

  # Top processes by memory
  echo -e "${BLUE}Top 5 processes by memory:${NC}"
  ps aux --sort=-%mem | head -6 | awk 'NR==1 || NR>1 {printf "  %-20s %5s%%  %8s  %s\n", $11, $4, $6, $2}'
  echo ""

  # Chrome processes
  echo -e "${BLUE}Chrome processes:${NC}"
  local chrome_count=$(ps aux | grep chrome | grep -v grep | wc -l)
  if [ "$chrome_count" -gt 0 ]; then
    ps aux | grep chrome | grep -v grep | awk '{printf "  PID %-7s  MEM %5s%%  CPU %5s%%  %s\n", $2, $4, $3, $11}' | head -5
    if [ "$chrome_count" -gt 5 ]; then
      echo "  ... and $((chrome_count - 5)) more Chrome processes"
    fi
  else
    echo "  No Chrome processes running"
  fi
  echo ""
}

# Function: Auto-cleanup recommendation
recommend_cleanup() {
  echo -e "\n${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}⚠️  CRITICAL MEMORY USAGE!${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "${YELLOW}Recommended actions:${NC}"
  echo "  1. Kill Chrome:        pkill -9 chrome"
  echo "  2. Stop frontend:      pkill -f 'node.*next'"
  echo "  3. Stop backend:       pkill -f 'uvicorn.*main:app'"
  echo "  4. Restart WSL:        wsl --shutdown (from Windows PowerShell)"
  echo ""
  show_breakdown
}

# Function: Warning message
show_warning() {
  echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}⚠️  High memory usage detected${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "Consider stopping unnecessary processes to prevent freezing."
  echo ""
  show_breakdown
}

# Main monitoring loop
main() {
  while true; do
    mem_usage=$(get_memory_usage)
    swap_usage=$(get_swap_usage)
    cpu_usage=$(get_cpu_usage)
    chrome_mem=$(get_chrome_memory)

    # Display current status
    display_status "$mem_usage" "$swap_usage" "$cpu_usage" "$chrome_mem"

    # Check for warnings
    if [ "$mem_usage" -ge "$CRITICAL_THRESHOLD" ]; then
      if [ "$critical_warned" = false ]; then
        recommend_cleanup
        critical_warned=true
        warned=true
      fi
    elif [ "$mem_usage" -ge "$WARNING_THRESHOLD" ]; then
      if [ "$warned" = false ]; then
        show_warning
        warned=true
      fi
    else
      # Reset warnings when usage drops
      warned=false
      critical_warned=false
    fi

    sleep "$CHECK_INTERVAL"
  done
}

# Handle Ctrl+C
trap 'echo -e "\n\n${GREEN}Monitoring stopped${NC}\n"; exit 0' INT

# Run monitor
main
