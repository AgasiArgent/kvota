#!/bin/bash
################################################################################
# Common Utilities for All Hooks
#
# Purpose: Shared functions for help, configuration, logging, and error handling
# Created: 2025-10-30
################################################################################

# Version tracking
HOOKS_VERSION="2.0.0"

# Configuration from environment with defaults
export HOOKS_VERBOSE="${HOOKS_VERBOSE:-0}"
export HOOKS_QUIET="${HOOKS_QUIET:-0}"
export HOOKS_LOG_FILE="${HOOKS_LOG_FILE:-}"
export HOOKS_RETRY_COUNT="${HOOKS_RETRY_COUNT:-3}"
export HOOKS_TIMEOUT="${HOOKS_TIMEOUT:-300}"  # 5 minutes default
export HOOKS_CONTINUE_ON_ERROR="${HOOKS_CONTINUE_ON_ERROR:-0}"
export HOOKS_JSON_OUTPUT="${HOOKS_JSON_OUTPUT:-0}"
export HOOKS_COLOR="${HOOKS_COLOR:-auto}"

# Detect color support
if [ "$HOOKS_COLOR" = "auto" ]; then
  if [ -t 1 ] && command -v tput >/dev/null 2>&1; then
    HOOKS_COLOR=1
  else
    HOOKS_COLOR=0
  fi
elif [ "$HOOKS_COLOR" = "never" ]; then
  HOOKS_COLOR=0
elif [ "$HOOKS_COLOR" = "always" ]; then
  HOOKS_COLOR=1
fi

# Source colors if enabled (use _UTILS_DIR to avoid overwriting SCRIPT_DIR from calling script)
_UTILS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "$HOOKS_COLOR" = "1" ]; then
  source "$_UTILS_DIR/colors.sh"
else
  # Define empty color variables
  RED="" GREEN="" YELLOW="" BLUE="" NC="" BOLD="" DIM=""

  # Define minimal versions of display functions when colors are disabled
  print_success() { echo "✓ $1"; }
  print_warning() { echo "⚠ $1"; }
  print_error() { echo "✗ $1"; }
  print_info() { echo "ℹ $1"; }
  print_debug() { echo "[DEBUG] $1"; }
  print_header() { echo "$1"; }
  print_divider() { printf '%*s\n' "${1:-50}" '' | tr ' ' '-'; }
  print_box() { echo "$1"; }
  print_section() { echo "▶ $1"; }
  print_step() { echo "→ $1"; }
  print_highlight() { echo "$1"; }
  export -f print_success print_warning print_error print_info print_debug
  export -f print_header print_divider print_box print_section print_step print_highlight
fi

################################################################################
# Help System
################################################################################

show_help() {
  local script_name="$1"
  local description="$2"
  local usage="$3"
  local options="$4"
  local examples="$5"

  cat << EOF
${BOLD}${script_name}${NC} - ${description}

${BOLD}USAGE:${NC}
  ${usage}

${BOLD}OPTIONS:${NC}
${options}

${BOLD}ENVIRONMENT VARIABLES:${NC}
  HOOKS_VERBOSE=1         Enable verbose output
  HOOKS_QUIET=1           Enable quiet mode (errors only)
  HOOKS_LOG_FILE=path     Log output to file
  HOOKS_RETRY_COUNT=n     Number of retries for failed operations (default: 3)
  HOOKS_TIMEOUT=seconds   Timeout for long operations (default: 300)
  HOOKS_CONTINUE_ON_ERROR=1  Continue despite errors
  HOOKS_JSON_OUTPUT=1     Output in JSON format
  HOOKS_COLOR=auto|always|never  Control colored output

${BOLD}EXAMPLES:${NC}
${examples}

${BOLD}VERSION:${NC} ${HOOKS_VERSION}
EOF
}

################################################################################
# Logging Functions
################################################################################

log_message() {
  local level="$1"
  local message="$2"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  # Skip if quiet mode (unless error)
  if [ "$HOOKS_QUIET" = "1" ] && [ "$level" != "ERROR" ]; then
    return
  fi

  # Skip debug unless verbose
  if [ "$level" = "DEBUG" ] && [ "$HOOKS_VERBOSE" != "1" ]; then
    return
  fi

  # Format message
  local formatted_msg
  case "$level" in
    ERROR)
      formatted_msg="${RED}✗ ${message}${NC}"
      ;;
    WARNING)
      formatted_msg="${YELLOW}⚠ ${message}${NC}"
      ;;
    SUCCESS)
      formatted_msg="${GREEN}✓ ${message}${NC}"
      ;;
    INFO)
      formatted_msg="${BLUE}ℹ ${message}${NC}"
      ;;
    DEBUG)
      formatted_msg="${DIM}[DEBUG] ${message}${NC}"
      ;;
    *)
      formatted_msg="$message"
      ;;
  esac

  # Output to console
  if [ "$HOOKS_JSON_OUTPUT" != "1" ]; then
    echo -e "$formatted_msg"
  fi

  # Log to file if specified
  if [ -n "$HOOKS_LOG_FILE" ]; then
    echo "[$timestamp] [$level] $message" >> "$HOOKS_LOG_FILE"
  fi
}

# Convenience wrappers
log_error() { log_message "ERROR" "$1"; }
log_warning() { log_message "WARNING" "$1"; }
log_success() { log_message "SUCCESS" "$1"; }
log_info() { log_message "INFO" "$1"; }
log_debug() { log_message "DEBUG" "$1"; }

################################################################################
# Error Handling
################################################################################

# Trap handler for cleanup
cleanup_on_exit() {
  local exit_code=$?
  log_debug "Cleaning up (exit code: $exit_code)"

  # Kill any background processes started by this script
  if [ -n "${HOOK_BACKGROUND_PIDS:-}" ]; then
    for pid in $HOOK_BACKGROUND_PIDS; do
      if kill -0 "$pid" 2>/dev/null; then
        log_debug "Killing background process $pid"
        kill "$pid" 2>/dev/null || true
      fi
    done
  fi

  # Remove temp files
  if [ -n "${HOOK_TEMP_FILES:-}" ]; then
    for file in $HOOK_TEMP_FILES; do
      if [ -f "$file" ]; then
        log_debug "Removing temp file $file"
        rm -f "$file"
      fi
    done
  fi

  return $exit_code
}

# Set up error handling
setup_error_handling() {
  set -o pipefail  # Pipe failures propagate
  trap cleanup_on_exit EXIT INT TERM
}

################################################################################
# Retry Mechanism
################################################################################

retry_command() {
  local max_attempts="${HOOKS_RETRY_COUNT:-3}"
  local delay=2
  local attempt=1
  local command="$@"

  log_debug "Running command with retry (max $max_attempts attempts): $command"

  while [ $attempt -le $max_attempts ]; do
    if eval "$command"; then
      log_debug "Command succeeded on attempt $attempt"
      return 0
    fi

    if [ $attempt -eq $max_attempts ]; then
      log_error "Command failed after $max_attempts attempts"
      return 1
    fi

    log_warning "Attempt $attempt failed, retrying in ${delay}s..."
    sleep $delay
    attempt=$((attempt + 1))
    delay=$((delay * 2))  # Exponential backoff
  done

  return 1
}

################################################################################
# Timeout Support
################################################################################

run_with_timeout() {
  local timeout="${1:-$HOOKS_TIMEOUT}"
  shift
  local command="$@"

  log_debug "Running command with ${timeout}s timeout: $command"

  # Use timeout command if available
  if command -v timeout >/dev/null 2>&1; then
    timeout "$timeout" bash -c "$command"
    local exit_code=$?
    if [ $exit_code -eq 124 ]; then
      log_error "Command timed out after ${timeout}s"
    fi
    return $exit_code
  else
    # Fallback: run in background and monitor
    eval "$command" &
    local pid=$!
    local count=0

    while [ $count -lt $timeout ]; do
      if ! kill -0 "$pid" 2>/dev/null; then
        wait "$pid"
        return $?
      fi
      sleep 1
      count=$((count + 1))
    done

    # Timeout reached
    kill -TERM "$pid" 2>/dev/null || true
    sleep 2
    kill -KILL "$pid" 2>/dev/null || true
    log_error "Command timed out after ${timeout}s"
    return 124
  fi
}

################################################################################
# JSON Output
################################################################################

json_output() {
  local status="$1"
  local message="$2"
  local details="$3"
  local timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

  if [ "$HOOKS_JSON_OUTPUT" = "1" ]; then
    cat << EOF
{
  "timestamp": "$timestamp",
  "status": "$status",
  "message": "$message",
  "details": $details,
  "version": "$HOOKS_VERSION"
}
EOF
  fi
}

################################################################################
# Dependency Checking
################################################################################

check_command() {
  local cmd="$1"
  local package="${2:-$1}"

  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "Required command '$cmd' not found. Please install $package"
    return 1
  fi
  log_debug "Found command: $cmd"
  return 0
}

check_python_module() {
  local module="$1"

  if ! python3 -c "import $module" 2>/dev/null; then
    log_error "Required Python module '$module' not found. Please install with: pip install $module"
    return 1
  fi
  log_debug "Found Python module: $module"
  return 0
}

check_npm_package() {
  local package="$1"
  local location="${2:-.}"

  if ! (cd "$location" && npm list "$package" --depth=0 >/dev/null 2>&1); then
    log_error "Required npm package '$package' not found in $location"
    return 1
  fi
  log_debug "Found npm package: $package"
  return 0
}

################################################################################
# Configuration Loading
################################################################################

load_config() {
  local config_file="${HOOKS_CONFIG_FILE:-$HOME/.claude-hooks.conf}"

  if [ -f "$config_file" ]; then
    log_debug "Loading configuration from $config_file"
    source "$config_file"
  fi

  # Also check project-specific config (dynamically find it relative to this script)
  local common_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local project_config="$common_script_dir/../config.conf"
  if [ -f "$project_config" ]; then
    log_debug "Loading project configuration from $project_config"
    source "$project_config"
  fi
}

################################################################################
# Parse Arguments
################################################################################

parse_args() {
  local args=()

  while [ $# -gt 0 ]; do
    case "$1" in
      -h|--help)
        return 1  # Signal to show help
        ;;
      -v|--verbose)
        export HOOKS_VERBOSE=1
        shift
        ;;
      -q|--quiet)
        export HOOKS_QUIET=1
        shift
        ;;
      --json)
        export HOOKS_JSON_OUTPUT=1
        shift
        ;;
      --no-color)
        export HOOKS_COLOR=0
        shift
        ;;
      --continue-on-error)
        export HOOKS_CONTINUE_ON_ERROR=1
        shift
        ;;
      --timeout)
        export HOOKS_TIMEOUT="$2"
        shift 2
        ;;
      --retry-count)
        export HOOKS_RETRY_COUNT="$2"
        shift 2
        ;;
      --log-file)
        export HOOKS_LOG_FILE="$2"
        shift 2
        ;;
      --)
        shift
        args+=("$@")
        break
        ;;
      *)
        args+=("$1")
        shift
        ;;
    esac
  done

  # Return remaining args
  echo "${args[@]}"
}

################################################################################
# Progress Indicators
################################################################################

show_spinner() {
  local pid=$1
  local message="${2:-Working...}"
  local spinstr='|/-\'

  if [ "$HOOKS_QUIET" = "1" ] || [ "$HOOKS_JSON_OUTPUT" = "1" ]; then
    wait $pid
    return $?
  fi

  while kill -0 $pid 2>/dev/null; do
    local temp=${spinstr#?}
    printf " [%c] %s  " "$spinstr" "$message"
    spinstr=$temp${spinstr%"$temp"}
    sleep 0.1
    printf "\r"
  done
  printf "    %s  \r" "$(printf ' %.0s' {1..50})"  # Clear line

  wait $pid
  return $?
}

################################################################################
# Summary Reporting
################################################################################

generate_summary() {
  local checks_passed="$1"
  local checks_failed="$2"
  local checks_skipped="$3"
  local start_time="$4"
  local end_time=$(date +%s)
  local duration=$((end_time - start_time))

  if [ "$HOOKS_JSON_OUTPUT" = "1" ]; then
    cat << EOF
{
  "summary": {
    "passed": $checks_passed,
    "failed": $checks_failed,
    "skipped": $checks_skipped,
    "duration": $duration,
    "success": $([ $checks_failed -eq 0 ] && echo "true" || echo "false")
  }
}
EOF
  else
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "${BOLD}Summary:${NC}"
    echo "  ${GREEN}✓ Passed:${NC} $checks_passed"
    [ $checks_failed -gt 0 ] && echo "  ${RED}✗ Failed:${NC} $checks_failed"
    [ $checks_skipped -gt 0 ] && echo "  ${YELLOW}○ Skipped:${NC} $checks_skipped"
    echo "  ${BLUE}⏱ Duration:${NC} ${duration}s"
    echo ""

    if [ $checks_failed -eq 0 ]; then
      log_success "All checks passed!"
      return 0
    else
      log_error "Some checks failed"
      return 1
    fi
  fi
}

################################################################################
# Export Functions
################################################################################

# Export all functions for use in other scripts
export -f show_help log_message log_error log_warning log_success log_info log_debug
export -f cleanup_on_exit setup_error_handling retry_command run_with_timeout
export -f json_output check_command check_python_module check_npm_package
export -f load_config parse_args show_spinner generate_summary