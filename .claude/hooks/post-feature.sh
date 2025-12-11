#!/bin/bash
################################################################################
# Post-Feature Quality Checks
#
# Purpose: Run comprehensive quality checks after completing a feature
# Returns: 0 (all passed), 1 (some failed)
# Created: 2025-10-30
# Updated: 2025-10-30 - Added help, retry logic, parallel execution, coverage
################################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils/common.sh"

# Parse command line arguments
ARGS=$(parse_args "$@")
if [ $? -eq 1 ]; then
  show_help "post-feature.sh" \
    "Run comprehensive quality checks after completing a feature" \
    "post-feature.sh [OPTIONS]" \
    "  -h, --help              Show this help message
  -v, --verbose           Enable verbose output
  -q, --quiet             Suppress normal output
  --json                  Output in JSON format
  --continue-on-error     Continue despite failures
  --skip-backend          Skip backend tests
  --skip-frontend         Skip frontend tests
  --skip-docs             Skip documentation check
  --skip-lint             Skip linting checks
  --coverage              Enable coverage reporting
  --coverage-threshold N  Minimum coverage percentage (default: 80)
  --parallel              Run tests in parallel
  --fix                   Attempt to auto-fix issues" \
    "  # Run all checks
  ./post-feature.sh

  # Skip frontend tests and enable coverage
  ./post-feature.sh --skip-frontend --coverage

  # Run in parallel with auto-fix
  ./post-feature.sh --parallel --fix

  # Get JSON report
  ./post-feature.sh --json"
  exit 0
fi

# Process remaining arguments
SKIP_BACKEND=0
SKIP_FRONTEND=0
SKIP_DOCS=0
SKIP_LINT=0
ENABLE_COVERAGE=0
COVERAGE_THRESHOLD=80
RUN_PARALLEL=0
AUTO_FIX=0

set -- $ARGS
while [ $# -gt 0 ]; do
  case "$1" in
    --skip-backend)
      SKIP_BACKEND=1
      shift
      ;;
    --skip-frontend)
      SKIP_FRONTEND=1
      shift
      ;;
    --skip-docs)
      SKIP_DOCS=1
      shift
      ;;
    --skip-lint)
      SKIP_LINT=1
      shift
      ;;
    --coverage)
      ENABLE_COVERAGE=1
      shift
      ;;
    --coverage-threshold)
      COVERAGE_THRESHOLD="$2"
      shift 2
      ;;
    --parallel)
      RUN_PARALLEL=1
      shift
      ;;
    --fix)
      AUTO_FIX=1
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# Setup - determine project root dynamically
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
START_TIME=$(date +%s)
setup_error_handling

# Track results
BACKEND_FAILED=0
FRONTEND_FAILED=0
DOCS_FAILED=0
LINT_FAILED=0
COVERAGE_FAILED=0
CHECK_RESULTS=()

################################################################################
# Functions
################################################################################

run_backend_tests() {
  local backend_dir="$PROJECT_ROOT/backend"

  if [ ! -d "$backend_dir" ]; then
    log_error "Backend directory not found"
    return 1
  fi

  cd "$backend_dir" || return 1

  # Activate virtual environment if it exists
  if [ -d "venv" ] && [ -f "venv/bin/activate" ]; then
    log_debug "Activating virtual environment"
    source venv/bin/activate
  fi

  # Build test command
  local test_cmd="pytest -v --tb=short"

  if [ "$ENABLE_COVERAGE" = "1" ]; then
    test_cmd="$test_cmd --cov=. --cov-report=term-missing --cov-fail-under=$COVERAGE_THRESHOLD"
  fi

  # Run tests with retry
  log_info "Running backend tests..."
  if retry_command $test_cmd; then
    log_success "Backend tests passed"

    # Parse coverage if enabled
    if [ "$ENABLE_COVERAGE" = "1" ]; then
      local coverage=$(pytest --cov=. --cov-report=term 2>/dev/null | grep "TOTAL" | awk '{print $NF}' | sed 's/%//')
      if [ -n "$coverage" ]; then
        log_info "Backend coverage: ${coverage}%"
        CHECK_RESULTS+=("{\"check\":\"backend_coverage\",\"value\":$coverage}")
      fi
    fi
    return 0
  else
    log_error "Backend tests failed"
    return 1
  fi
}

run_frontend_tests() {
  local frontend_dir="$PROJECT_ROOT/frontend"

  if [ ! -d "$frontend_dir" ]; then
    log_error "Frontend directory not found"
    return 1
  fi

  cd "$frontend_dir" || return 1

  # Build test command
  local test_cmd="npm test -- --passWithNoTests --watchAll=false"

  if [ "$ENABLE_COVERAGE" = "1" ]; then
    test_cmd="$test_cmd --coverage --coverageReporters=text"
  fi

  # Run tests with retry
  log_info "Running frontend tests..."
  if retry_command $test_cmd; then
    log_success "Frontend tests passed"
    return 0
  else
    log_error "Frontend tests failed"
    return 1
  fi
}

run_lint_checks() {
  local failed=0

  # Frontend linting
  if [ "$SKIP_FRONTEND" = "0" ] && [ -d "$PROJECT_ROOT/frontend" ]; then
    log_info "Running frontend linting..."
    cd "$PROJECT_ROOT/frontend"

    if [ "$AUTO_FIX" = "1" ]; then
      npm run lint -- --fix 2>&1 | tail -20
      npm run prettier -- --write 'src/**/*.{ts,tsx,js,jsx}' 2>&1 | tail -10
    else
      if ! npm run lint 2>&1 | tail -20; then
        log_warning "Frontend linting issues found"
        log_info "Run with --fix to auto-fix: $0 --fix"
        ((failed++))
      fi
    fi
  fi

  # Backend linting (if black/isort installed)
  if [ "$SKIP_BACKEND" = "0" ] && [ -d "$PROJECT_ROOT/backend" ]; then
    cd "$PROJECT_ROOT/backend"

    if command -v black >/dev/null 2>&1; then
      log_info "Running Python formatting check..."
      if [ "$AUTO_FIX" = "1" ]; then
        black . --exclude venv
      else
        if ! black . --check --exclude venv 2>&1 | tail -10; then
          log_warning "Python formatting issues found"
          log_info "Run with --fix to auto-format: $0 --fix"
          ((failed++))
        fi
      fi
    fi

    if command -v isort >/dev/null 2>&1; then
      log_info "Running import sorting check..."
      if [ "$AUTO_FIX" = "1" ]; then
        isort . --skip venv
      else
        if ! isort . --check-only --skip venv 2>&1 | tail -10; then
          log_warning "Import sorting issues found"
          ((failed++))
        fi
      fi
    fi
  fi

  return $failed
}

check_documentation() {
  log_info "Checking documentation freshness..."

  # Use the enhanced check-docs utility
  local docs_cmd="$SCRIPT_DIR/utils/check-docs.sh --threshold 60"

  if [ "$AUTO_FIX" = "1" ]; then
    docs_cmd="$docs_cmd --fix"
  fi

  if $docs_cmd; then
    log_success "Documentation up to date"
    return 0
  else
    log_warning "Documentation needs updating"
    if [ "$AUTO_FIX" = "0" ]; then
      log_info "Run with --fix to update: $0 --fix"
    fi
    return 1
  fi
}

run_parallel_checks() {
  log_info "Running checks in parallel..."

  # Create temp files for results
  local backend_result=$(mktemp)
  local frontend_result=$(mktemp)
  local lint_result=$(mktemp)
  local docs_result=$(mktemp)

  HOOK_TEMP_FILES="$backend_result $frontend_result $lint_result $docs_result"

  # Start background jobs
  ( [ "$SKIP_BACKEND" = "0" ] && run_backend_tests; echo $? > "$backend_result" ) &
  local backend_pid=$!

  ( [ "$SKIP_FRONTEND" = "0" ] && run_frontend_tests; echo $? > "$frontend_result" ) &
  local frontend_pid=$!

  ( [ "$SKIP_LINT" = "0" ] && run_lint_checks; echo $? > "$lint_result" ) &
  local lint_pid=$!

  ( [ "$SKIP_DOCS" = "0" ] && check_documentation; echo $? > "$docs_result" ) &
  local docs_pid=$!

  # Wait with progress indicator
  local pids="$backend_pid $frontend_pid $lint_pid $docs_pid"
  HOOK_BACKGROUND_PIDS="$pids"

  log_info "Waiting for parallel checks to complete..."
  for pid in $pids; do
    wait $pid
  done

  # Collect results
  [ "$SKIP_BACKEND" = "0" ] && BACKEND_FAILED=$(cat "$backend_result" 2>/dev/null || echo 1)
  [ "$SKIP_FRONTEND" = "0" ] && FRONTEND_FAILED=$(cat "$frontend_result" 2>/dev/null || echo 1)
  [ "$SKIP_LINT" = "0" ] && LINT_FAILED=$(cat "$lint_result" 2>/dev/null || echo 0)
  [ "$SKIP_DOCS" = "0" ] && DOCS_FAILED=$(cat "$docs_result" 2>/dev/null || echo 0)

  # Cleanup temp files
  rm -f "$backend_result" "$frontend_result" "$lint_result" "$docs_result"
  HOOK_TEMP_FILES=""
}

################################################################################
# Main Execution
################################################################################

echo ""
print_box "Post-Feature Quality Checks" "$BOLD_CYAN"
echo ""

if [ "$RUN_PARALLEL" = "1" ]; then
  run_parallel_checks
else
  # Run sequentially
  if [ "$SKIP_BACKEND" = "0" ]; then
    run_backend_tests || BACKEND_FAILED=1
    echo ""
  fi

  if [ "$SKIP_FRONTEND" = "0" ]; then
    run_frontend_tests || FRONTEND_FAILED=1
    echo ""
  fi

  if [ "$SKIP_LINT" = "0" ]; then
    run_lint_checks
    LINT_FAILED=$?
    echo ""
  fi

  if [ "$SKIP_DOCS" = "0" ]; then
    check_documentation || DOCS_FAILED=1
    echo ""
  fi
fi

################################################################################
# Summary
################################################################################

# Calculate totals
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_SKIPPED=0

[ "$SKIP_BACKEND" = "0" ] && [ "$BACKEND_FAILED" = "0" ] && ((CHECKS_PASSED++))
[ "$SKIP_BACKEND" = "0" ] && [ "$BACKEND_FAILED" != "0" ] && ((CHECKS_FAILED++))
[ "$SKIP_BACKEND" = "1" ] && ((CHECKS_SKIPPED++))

[ "$SKIP_FRONTEND" = "0" ] && [ "$FRONTEND_FAILED" = "0" ] && ((CHECKS_PASSED++))
[ "$SKIP_FRONTEND" = "0" ] && [ "$FRONTEND_FAILED" != "0" ] && ((CHECKS_FAILED++))
[ "$SKIP_FRONTEND" = "1" ] && ((CHECKS_SKIPPED++))

[ "$SKIP_LINT" = "0" ] && [ "$LINT_FAILED" = "0" ] && ((CHECKS_PASSED++))
[ "$SKIP_LINT" = "0" ] && [ "$LINT_FAILED" != "0" ] && ((CHECKS_FAILED++))
[ "$SKIP_LINT" = "1" ] && ((CHECKS_SKIPPED++))

[ "$SKIP_DOCS" = "0" ] && [ "$DOCS_FAILED" = "0" ] && ((CHECKS_PASSED++))
[ "$SKIP_DOCS" = "0" ] && [ "$DOCS_FAILED" != "0" ] && ((CHECKS_FAILED++))
[ "$SKIP_DOCS" = "1" ] && ((CHECKS_SKIPPED++))

# JSON output
if [ "$HOOKS_JSON_OUTPUT" = "1" ]; then
  cat << EOF
{
  "summary": {
    "passed": $CHECKS_PASSED,
    "failed": $CHECKS_FAILED,
    "skipped": $CHECKS_SKIPPED
  },
  "checks": {
    "backend": $([ "$SKIP_BACKEND" = "1" ] && echo "null" || [ "$BACKEND_FAILED" = "0" ] && echo "true" || echo "false"),
    "frontend": $([ "$SKIP_FRONTEND" = "1" ] && echo "null" || [ "$FRONTEND_FAILED" = "0" ] && echo "true" || echo "false"),
    "lint": $([ "$SKIP_LINT" = "1" ] && echo "null" || [ "$LINT_FAILED" = "0" ] && echo "true" || echo "false"),
    "docs": $([ "$SKIP_DOCS" = "1" ] && echo "null" || [ "$DOCS_FAILED" = "0" ] && echo "true" || echo "false")
  },
  "duration": $(($(date +%s) - START_TIME)),
  "success": $([ $CHECKS_FAILED -eq 0 ] && echo "true" || echo "false")
}
EOF
  exit $([ $CHECKS_FAILED -eq 0 ] && echo 0 || echo 1)
fi

# Normal output
print_divider 50

if [ $CHECKS_FAILED -eq 0 ]; then
  print_success "All quality checks passed! ✓"
  echo ""
  print_section "Next steps:"
  echo "  1. Review changes: ${CYAN}git status && git diff${NC}"
  echo "  2. Commit changes: ${CYAN}git add . && git commit -m '...'${NC}"
  echo "  3. Verify build: ${CYAN}$SCRIPT_DIR/verify-build.sh${NC}"
  echo "  4. Push to remote: ${CYAN}git push${NC}"
  echo ""
  exit 0
else
  print_error "Some checks failed. Please review:"
  echo ""

  if [ $BACKEND_FAILED -eq 1 ]; then
    echo "  ${RED}✗${NC} Backend tests failed"
    echo "    Debug: ${CYAN}cd backend && pytest -v${NC}"
  fi

  if [ $FRONTEND_FAILED -eq 1 ]; then
    echo "  ${RED}✗${NC} Frontend tests failed"
    echo "    Debug: ${CYAN}cd frontend && npm test${NC}"
  fi

  if [ $LINT_FAILED -ne 0 ]; then
    echo "  ${YELLOW}⚠${NC} Linting issues found"
    echo "    Fix: ${CYAN}$0 --fix${NC}"
  fi

  if [ $DOCS_FAILED -eq 1 ]; then
    echo "  ${YELLOW}⚠${NC} Documentation needs updating"
    echo "    Fix: ${CYAN}$0 --fix${NC}"
  fi

  echo ""

  if [ "$HOOKS_CONTINUE_ON_ERROR" = "1" ]; then
    log_warning "Continuing despite failures (--continue-on-error set)"
    exit 0
  else
    exit 1
  fi
fi