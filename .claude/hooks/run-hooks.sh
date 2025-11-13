#!/bin/bash
################################################################################
# Hook Composition Runner
#
# Purpose: Run multiple hooks in sequence or parallel with dependency management
# Returns: 0 (all passed), 1 (some failed)
# Created: 2025-10-30
################################################################################

HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_DIR="$HOOKS_DIR"
source "$HOOKS_DIR/utils/common.sh"
# Restore HOOKS_DIR as SCRIPT_DIR for hook lookup
SCRIPT_DIR="$HOOKS_DIR"

# Parse command line arguments
ARGS=$(parse_args "$@")
if [ $? -eq 1 ]; then
  show_help "run-hooks.sh" \
    "Run multiple hooks in sequence or parallel with dependency management" \
    "run-hooks.sh [OPTIONS] [HOOKS...]" \
    "  -h, --help              Show this help message
  -v, --verbose           Enable verbose output
  -q, --quiet             Suppress normal output
  --json                  Output in JSON format
  --continue-on-error     Continue despite failures
  --parallel              Run hooks in parallel where possible
  --profile PROFILE       Run a predefined profile (see below)
  --list-profiles         List available profiles
  --dry-run               Show what would be executed without running" \
    "  # Run specific hooks in sequence
  ./run-hooks.sh backend-syntax-check.sh post-feature.sh

  # Run hooks in parallel
  ./run-hooks.sh --parallel backend-syntax-check.sh verify-build.sh

  # Run a predefined profile
  ./run-hooks.sh --profile pre-commit

  # Dry run to see execution plan
  ./run-hooks.sh --dry-run --profile full"
  exit 0
fi

# Process remaining arguments
RUN_PARALLEL=0
DRY_RUN=0
PROFILE=""
LIST_PROFILES=0
HOOKS_TO_RUN=()

set -- $ARGS
while [ $# -gt 0 ]; do
  case "$1" in
    --parallel)
      RUN_PARALLEL=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --list-profiles)
      LIST_PROFILES=1
      shift
      ;;
    *)
      # Assume it's a hook name
      HOOKS_TO_RUN+=("$1")
      shift
      ;;
  esac
done

################################################################################
# Hook Profiles
################################################################################

declare -A PROFILES

# Quick checks (< 30s)
PROFILES["quick"]="utils/check-memory.sh utils/check-chrome.sh utils/check-docs.sh"

# Pre-commit checks
PROFILES["pre-commit"]="backend-syntax-check.sh"

# Post-feature checks
PROFILES["post-feature"]="post-feature.sh"

# Build verification
PROFILES["build"]="verify-build.sh"

# Full quality suite
PROFILES["full"]="backend-syntax-check.sh post-feature.sh verify-build.sh"

# Security focused
PROFILES["security"]="backend-syntax-check.sh --enable-security"

# Performance focused
PROFILES["performance"]="backend-syntax-check.sh --enable-complexity utils/check-memory.sh"

# Documentation
PROFILES["docs"]="utils/check-docs.sh --all"

# Continuous Integration
PROFILES["ci"]="backend-syntax-check.sh --enable-all post-feature.sh --coverage verify-build.sh"

################################################################################
# Functions
################################################################################

list_profiles() {
  print_header "Available Hook Profiles"
  print_divider 50
  echo ""

  for profile in "${!PROFILES[@]}"; do
    echo "${BOLD}$profile${NC}:"
    echo "  Hooks: ${PROFILES[$profile]}"
    echo ""
  done | sort

  echo "${DIM}Use: $0 --profile PROFILE_NAME${NC}"
  echo ""
}

get_profile_hooks() {
  local profile="$1"

  if [ -z "${PROFILES[$profile]}" ]; then
    log_error "Unknown profile: $profile"
    log_info "Available profiles: ${!PROFILES[*]}"
    return 1
  fi

  echo "${PROFILES[$profile]}"
  return 0
}

run_hook() {
  local hook="$1"
  shift
  local args="$@"

  # Find the hook script
  local hook_path=""
  if [ -f "$SCRIPT_DIR/$hook" ]; then
    hook_path="$SCRIPT_DIR/$hook"
  elif [ -f "$SCRIPT_DIR/utils/$hook" ]; then
    hook_path="$SCRIPT_DIR/utils/$hook"
  else
    # Try without .sh extension
    if [ -f "$SCRIPT_DIR/${hook%.sh}.sh" ]; then
      hook_path="$SCRIPT_DIR/${hook%.sh}.sh"
    elif [ -f "$SCRIPT_DIR/utils/${hook%.sh}.sh" ]; then
      hook_path="$SCRIPT_DIR/utils/${hook%.sh}.sh"
    else
      log_error "Hook not found: $hook"
      return 1
    fi
  fi

  # Make sure it's executable
  if [ ! -x "$hook_path" ]; then
    chmod +x "$hook_path"
  fi

  local hook_name=$(basename "$hook_path" .sh)
  log_info "Running hook: $hook_name $args"

  if [ "$DRY_RUN" = "1" ]; then
    echo "  Would execute: $hook_path $args"
    return 0
  fi

  # Execute the hook
  local start_time=$(date +%s)
  local output_file=$(mktemp)

  if $hook_path $args > "$output_file" 2>&1; then
    local duration=$(($(date +%s) - start_time))
    log_success "$hook_name completed (${duration}s)"

    if [ "$HOOKS_VERBOSE" = "1" ] && [ -s "$output_file" ]; then
      cat "$output_file" | sed 's/^/  /'
    fi

    rm -f "$output_file"
    return 0
  else
    local exit_code=$?
    local duration=$(($(date +%s) - start_time))
    log_error "$hook_name failed (exit code: $exit_code, duration: ${duration}s)"

    # Show output on failure
    if [ -s "$output_file" ]; then
      cat "$output_file" | sed 's/^/  /'
    fi

    rm -f "$output_file"
    return $exit_code
  fi
}

run_hooks_sequential() {
  local hooks=("$@")
  local failed=0

  for hook_spec in "${hooks[@]}"; do
    # Parse hook and arguments
    local hook_parts=($hook_spec)
    local hook_name="${hook_parts[0]}"
    local hook_args="${hook_parts[@]:1}"

    if ! run_hook "$hook_name" $hook_args; then
      ((failed++))

      if [ "$HOOKS_CONTINUE_ON_ERROR" != "1" ]; then
        log_error "Stopping due to failure (use --continue-on-error to continue)"
        return $failed
      fi
    fi

    echo ""
  done

  return $failed
}

run_hooks_parallel() {
  local hooks=("$@")
  local pids=()
  local result_files=()
  local failed=0

  log_info "Starting ${#hooks[@]} hooks in parallel..."

  for hook_spec in "${hooks[@]}"; do
    # Parse hook and arguments
    local hook_parts=($hook_spec)
    local hook_name="${hook_parts[0]}"
    local hook_args="${hook_parts[@]:1}"

    local result_file=$(mktemp)
    result_files+=("$result_file")

    (
      run_hook "$hook_name" $hook_args
      echo $? > "$result_file"
    ) &
    pids+=($!)
  done

  # Wait for all hooks to complete
  log_info "Waiting for parallel hooks to complete..."
  for i in "${!pids[@]}"; do
    wait "${pids[$i]}"
    local exit_code=$(cat "${result_files[$i]}" 2>/dev/null || echo 1)
    if [ "$exit_code" -ne 0 ]; then
      ((failed++))
    fi
    rm -f "${result_files[$i]}"
  done

  return $failed
}

################################################################################
# Main
################################################################################

# List profiles if requested
if [ "$LIST_PROFILES" = "1" ]; then
  list_profiles
  exit 0
fi

# Build hook list
if [ -n "$PROFILE" ]; then
  profile_hooks=$(get_profile_hooks "$PROFILE") || exit 1
  IFS=' ' read -ra HOOKS_TO_RUN <<< "$profile_hooks"
fi

# Validate we have hooks to run
if [ ${#HOOKS_TO_RUN[@]} -eq 0 ]; then
  log_error "No hooks specified. Use --help for usage."
  exit 1
fi

# Start execution
echo ""
print_box "Hook Runner" "$BOLD_CYAN"
echo ""

if [ "$DRY_RUN" = "1" ]; then
  log_info "DRY RUN MODE - No hooks will be executed"
  echo ""
fi

log_info "Hooks to run: ${HOOKS_TO_RUN[*]}"
[ "$RUN_PARALLEL" = "1" ] && log_info "Execution mode: PARALLEL" || log_info "Execution mode: SEQUENTIAL"
echo ""

START_TIME=$(date +%s)

# Run the hooks
if [ "$RUN_PARALLEL" = "1" ]; then
  run_hooks_parallel "${HOOKS_TO_RUN[@]}"
  FAILED=$?
else
  run_hooks_sequential "${HOOKS_TO_RUN[@]}"
  FAILED=$?
fi

# Summary
DURATION=$(($(date +%s) - START_TIME))
TOTAL=${#HOOKS_TO_RUN[@]}
PASSED=$((TOTAL - FAILED))

print_divider 50

if [ "$DRY_RUN" = "1" ]; then
  log_info "Dry run completed. $TOTAL hooks would have been executed."
elif [ "$FAILED" -eq 0 ]; then
  print_success "All $TOTAL hooks passed! (${DURATION}s)"
else
  print_error "$FAILED of $TOTAL hooks failed (${DURATION}s)"
  [ "$HOOKS_CONTINUE_ON_ERROR" != "1" ] && exit 1
fi

echo ""
exit $([ "$FAILED" -eq 0 ] && echo 0 || echo 1)