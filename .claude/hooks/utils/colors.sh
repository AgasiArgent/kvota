#!/bin/bash
################################################################################
# Color Output Helpers for Hooks
#
# Purpose: ANSI color codes and formatting helpers
# Created: 2025-10-30
# Updated: 2025-10-30 - Added more colors and formatting options
################################################################################

# Basic colors
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export MAGENTA='\033[0;35m'
export CYAN='\033[0;36m'
export WHITE='\033[0;37m'
export GRAY='\033[0;90m'

# Bold colors
export BOLD_RED='\033[1;31m'
export BOLD_GREEN='\033[1;32m'
export BOLD_YELLOW='\033[1;33m'
export BOLD_BLUE='\033[1;34m'
export BOLD_MAGENTA='\033[1;35m'
export BOLD_CYAN='\033[1;36m'

# Formatting
export BOLD='\033[1m'
export DIM='\033[2m'
export ITALIC='\033[3m'
export UNDERLINE='\033[4m'
export BLINK='\033[5m'
export REVERSE='\033[7m'
export HIDDEN='\033[8m'
export STRIKETHROUGH='\033[9m'

# Reset
export NC='\033[0m'  # No Color / Reset

# Background colors
export BG_RED='\033[41m'
export BG_GREEN='\033[42m'
export BG_YELLOW='\033[43m'
export BG_BLUE='\033[44m'
export BG_MAGENTA='\033[45m'
export BG_CYAN='\033[46m'
export BG_WHITE='\033[47m'

################################################################################
# Print Functions
################################################################################

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

print_debug() {
  echo -e "${DIM}[DEBUG] $1${NC}"
}

print_header() {
  echo -e "${BOLD}${1}${NC}"
}

print_section() {
  echo -e "${BOLD_CYAN}▶ $1${NC}"
}

print_step() {
  echo -e "${CYAN}→ $1${NC}"
}

print_highlight() {
  echo -e "${REVERSE}$1${NC}"
}

################################################################################
# Progress Bar
################################################################################

show_progress() {
  local current=$1
  local total=$2
  local width=${3:-50}
  local percent=$((current * 100 / total))
  local filled=$((width * current / total))

  printf "\r["
  printf "%${filled}s" | tr ' ' '='
  printf "%$((width - filled))s" | tr ' ' '.'
  printf "] %3d%% (%d/%d)" $percent $current $total

  if [ $current -eq $total ]; then
    echo ""  # New line when complete
  fi
}

################################################################################
# Styled Messages
################################################################################

print_box() {
  local message="$1"
  local color="${2:-$CYAN}"
  local width=${#message}
  local border=$(printf '━%.0s' $(seq 1 $((width + 4))))

  echo -e "${color}┏${border}┓${NC}"
  echo -e "${color}┃  ${BOLD}${message}${NC}${color}  ┃${NC}"
  echo -e "${color}┗${border}┛${NC}"
}

print_divider() {
  local width="${1:-50}"
  local char="${2:-━}"
  printf "${DIM}%${width}s${NC}\n" | tr ' ' "$char"
}

################################################################################
# Export Functions
################################################################################

export -f print_success print_warning print_error print_info print_debug
export -f print_header print_section print_step print_highlight
export -f show_progress print_box print_divider
