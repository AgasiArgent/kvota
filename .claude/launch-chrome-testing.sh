#!/bin/bash
# Optimized Chrome launch script for testing with resource management
# Prevents WSL2 freezing by limiting Chrome memory usage

set -e

# Configuration
CHROME_PORT=9222
CHROME_PROFILE="/tmp/chrome-wsl-profile"
DEFAULT_URL="http://localhost:3001/quotes/create"
CHROME_LOG="/tmp/chrome-wsl.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function: Kill existing Chrome instances
kill_chrome() {
  echo -e "${YELLOW}Killing existing Chrome instances...${NC}"
  pkill -9 chrome 2>/dev/null || true
  sleep 2
}

# Function: Clear old Chrome profile to free memory
clear_profile() {
  echo -e "${YELLOW}Clearing old Chrome profile...${NC}"
  rm -rf "$CHROME_PROFILE"
  mkdir -p "$CHROME_PROFILE"
}

# Function: Check if DISPLAY is set
check_display() {
  if [ -z "$DISPLAY" ]; then
    echo -e "${YELLOW}DISPLAY not set. Setting to :0${NC}"
    export DISPLAY=:0
  fi
}

# Function: Launch Chrome with memory limits
launch_chrome() {
  local url="${1:-$DEFAULT_URL}"

  echo -e "${GREEN}Launching Chrome with resource limits...${NC}"
  echo "  URL: $url"
  echo "  Debug Port: $CHROME_PORT"
  echo "  Profile: $CHROME_PROFILE"
  echo "  Log: $CHROME_LOG"

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
  echo -e "${GREEN}Chrome launched with PID: $chrome_pid${NC}"

  # Wait for Chrome to be ready
  echo -e "${YELLOW}Waiting for Chrome to start...${NC}"
  sleep 3

  # Verify Chrome is running
  if curl -s http://localhost:$CHROME_PORT/json > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Chrome is ready for testing${NC}"
    echo ""
    echo "Chrome DevTools Protocol: http://localhost:$CHROME_PORT"
    echo "To view pages: curl -s http://localhost:$CHROME_PORT/json | jq"
    echo "To kill Chrome: pkill -9 chrome"
    return 0
  else
    echo -e "${RED}✗ Chrome failed to start. Check log: $CHROME_LOG${NC}"
    tail -20 "$CHROME_LOG"
    return 1
  fi
}

# Function: Launch headless Chrome (lower memory usage)
launch_chrome_headless() {
  local url="${1:-$DEFAULT_URL}"

  echo -e "${GREEN}Launching Chrome in headless mode (lower memory)...${NC}"
  echo "  URL: $url"
  echo "  Debug Port: $CHROME_PORT"

  google-chrome \
    --headless=new \
    --remote-debugging-port=$CHROME_PORT \
    --user-data-dir="$CHROME_PROFILE" \
    --disable-dev-shm-usage \
    --no-sandbox \
    --disable-gpu \
    --js-flags="--max-old-space-size=256" \
    --disable-extensions \
    "$url" \
    > "$CHROME_LOG" 2>&1 &

  local chrome_pid=$!
  echo -e "${GREEN}Headless Chrome launched with PID: $chrome_pid${NC}"
  sleep 2
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
  local mode="${1:-full}"
  local url="${2:-$DEFAULT_URL}"

  case "$mode" in
    full)
      kill_chrome
      clear_profile
      check_display
      launch_chrome "$url"
      ;;
    headless)
      kill_chrome
      clear_profile
      launch_chrome_headless "$url"
      ;;
    status)
      show_memory
      ;;
    kill)
      kill_chrome
      echo -e "${GREEN}Chrome killed${NC}"
      ;;
    *)
      echo "Usage: $0 [full|headless|status|kill] [url]"
      echo ""
      echo "  full       - Launch Chrome with GUI (default)"
      echo "  headless   - Launch Chrome in headless mode (60% less memory)"
      echo "  status     - Show memory usage and Chrome processes"
      echo "  kill       - Kill all Chrome instances"
      echo ""
      echo "Examples:"
      echo "  $0 full http://localhost:3001/quotes/create"
      echo "  $0 headless"
      echo "  $0 status"
      exit 1
      ;;
  esac
}

# Run main function
main "$@"
