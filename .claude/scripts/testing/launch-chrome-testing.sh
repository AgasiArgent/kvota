#!/bin/bash

# Chrome Testing Launch Script
# Purpose: Launch Chrome with remote debugging in different modes (full GUI, headless, or kill)
# Prevents WSL2 freezing by limiting Chrome memory usage

set -e

# Configuration
CHROME_PORT=9222
CHROME_PROFILE="/tmp/chrome-wsl-profile"
DEFAULT_URL="http://localhost:3000/quotes/create"
CHROME_LOG="/tmp/chrome-wsl.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
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

# Function: Pre-flight safety check before launching Chrome
pre_flight_check() {
  print_info "Running pre-flight safety checks..."

  # Get script directory for sourcing utilities
  local script_dir="$(dirname "$0")"
  local utils_dir="$script_dir/../../hooks/utils"

  # Check memory usage
  bash "$utils_dir/check-memory.sh"
  local mem_status=$?

  if [ $mem_status -eq 2 ]; then
    print_error "Memory usage CRITICAL (>75%). Cannot launch Chrome safely."
    print_info "Actions to free memory:"
    echo "  1. pkill -9 chrome"
    echo "  2. pkill -f 'node.*next'"
    echo "  3. wsl --shutdown (from Windows PowerShell, wait 8 seconds)"
    exit 1
  elif [ $mem_status -eq 1 ]; then
    print_warning "Memory usage HIGH (>60%). Chrome may cause WSL2 instability."
    read -p "Continue anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      print_info "Aborted. Free memory first or use headless mode."
      exit 0
    fi
  fi

  print_success "Pre-flight safety checks passed"
}

# Function: Check if Chrome is installed
check_chrome_installed() {
    if ! command -v google-chrome &> /dev/null; then
        print_error "Chrome is not installed"
        print_info "Install Chrome in WSL2 with:"
        echo "  wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb"
        echo "  sudo apt install ./google-chrome-stable_current_amd64.deb"
        exit 1
    fi
}

# Function: Kill existing Chrome instances
kill_chrome() {
  local chrome_pids=$(pgrep -f "chrome.*remote-debugging-port=$CHROME_PORT" 2>/dev/null || true)

  if [ -z "$chrome_pids" ]; then
    print_warning "No Chrome instances with remote debugging on port $CHROME_PORT found"
    return 0
  fi

  print_info "Killing Chrome processes: $chrome_pids"
  echo "$chrome_pids" | xargs kill -9 2>/dev/null || true
  sleep 2

  # Verify they're dead
  if pgrep -f "chrome.*remote-debugging-port=$CHROME_PORT" > /dev/null 2>&1; then
    print_error "Failed to kill some Chrome processes"
    return 1
  else
    print_success "All Chrome processes killed"
    return 0
  fi
}

# Function: Clear old Chrome profile to free memory
clear_profile() {
  if [ -d "$CHROME_PROFILE" ]; then
    print_info "Cleaning up user data directory..."
    rm -rf "$CHROME_PROFILE"
  fi
  mkdir -p "$CHROME_PROFILE"
}

# Function: Check if DISPLAY is set
check_display() {
  if [ -z "$DISPLAY" ]; then
    print_warning "DISPLAY not set. Setting to :0"
    export DISPLAY=:0
  fi
}

# Function: Launch Chrome in full GUI mode with memory limits
launch_chrome() {
  local url="${1:-$DEFAULT_URL}"

  echo -e "${BLUE}🚀 Launching Chrome in full GUI mode...${NC}"
  print_info "URL: $url"
  print_info "Remote debugging port: $CHROME_PORT"

  DISPLAY=:0 google-chrome \
    --remote-debugging-port=$CHROME_PORT \
    --user-data-dir="$CHROME_PROFILE" \
    --disable-dev-shm-usage \
    --no-sandbox \
    --disable-gpu \
    --disable-software-rasterizer \
    --js-flags="--max-old-space-size=512" \
    --disable-extensions \
    --disable-background-networking \
    --disable-sync \
    --metrics-recording-only \
    --no-first-run \
    --no-default-browser-check \
    "$url" \
    > "$CHROME_LOG" 2>&1 &

  local chrome_pid=$!

  # Wait for Chrome to be ready
  sleep 3

  # Verify Chrome is running
  if ps -p $chrome_pid > /dev/null 2>&1 && curl -s http://localhost:$CHROME_PORT/json > /dev/null 2>&1; then
    print_success "Chrome started successfully"
    echo -e "${GREEN}🔗 Remote debugging: http://localhost:$CHROME_PORT${NC}"
    print_warning "Memory usage: ~1.2 GB"
    return 0
  else
    print_error "Chrome failed to start"
    print_info "Check logs: tail -f $CHROME_LOG"
    return 1
  fi
}

# Function: Launch headless Chrome (lower memory usage)
launch_chrome_headless() {
  local url="${1:-$DEFAULT_URL}"

  echo -e "${BLUE}🚀 Launching Chrome in headless mode...${NC}"
  print_info "URL: $url"
  print_info "Remote debugging port: $CHROME_PORT"

  DISPLAY=:0 google-chrome \
    --headless=new \
    --remote-debugging-port=$CHROME_PORT \
    --user-data-dir="$CHROME_PROFILE" \
    --disable-dev-shm-usage \
    --no-sandbox \
    --disable-gpu \
    --disable-software-rasterizer \
    --js-flags="--max-old-space-size=256" \
    --disable-extensions \
    --disable-background-networking \
    --disable-sync \
    --no-first-run \
    --no-default-browser-check \
    "$url" \
    > "$CHROME_LOG" 2>&1 &

  local chrome_pid=$!

  # Wait for Chrome to be ready
  sleep 3

  # Verify Chrome is running
  if ps -p $chrome_pid > /dev/null 2>&1 && curl -s http://localhost:$CHROME_PORT/json > /dev/null 2>&1; then
    print_success "Chrome started successfully"
    echo -e "${GREEN}🔗 Remote debugging: http://localhost:$CHROME_PORT${NC}"
    print_success "Memory usage: ~500 MB (60% less than full GUI)"
    return 0
  else
    print_error "Chrome failed to start"
    print_info "Check logs: tail -f $CHROME_LOG"
    return 1
  fi
}

# Function: Show memory usage
show_memory() {
  echo -e "${YELLOW}Current memory usage:${NC}"
  free -h | grep -E "Mem|Swap"
  echo ""
  echo -e "${YELLOW}Chrome processes:${NC}"
  ps aux | grep chrome | grep -v grep | awk '{printf "  PID %-7s  MEM %5s%%  CPU %5s%%\n", $2, $4, $3}'
}

# Main script
main() {
  local mode="${1:-}"
  local url="${2:-$DEFAULT_URL}"

  # Show usage if no arguments
  if [ -z "$mode" ]; then
    echo "Chrome Testing Launch Script"
    echo ""
    echo "Usage:"
    echo "  $0 full [url]      - Launch Chrome with full GUI"
    echo "  $0 headless [url]  - Launch Chrome in headless mode (60% less memory)"
    echo "  $0 kill            - Kill all Chrome processes"
    echo "  $0 status          - Show memory usage and Chrome processes"
    echo ""
    echo "Default URL: $DEFAULT_URL"
    echo "Remote debugging port: $CHROME_PORT"
    echo ""
    echo "Examples:"
    echo "  $0 full http://localhost:3001/quotes/create"
    echo "  $0 headless"
    echo "  $0 kill"
    exit 0
  fi

  case "$mode" in
    full)
      check_chrome_installed
      pre_flight_check
      kill_chrome
      clear_profile
      check_display
      launch_chrome "$url"
      ;;
    headless)
      check_chrome_installed
      pre_flight_check
      kill_chrome
      clear_profile
      launch_chrome_headless "$url"
      ;;
    status)
      show_memory
      ;;
    kill)
      kill_chrome
      clear_profile
      ;;
    *)
      print_error "Invalid mode: $mode"
      echo "Valid modes: full, headless, kill, status"
      exit 1
      ;;
  esac
}

# Run main function
main "$@"
