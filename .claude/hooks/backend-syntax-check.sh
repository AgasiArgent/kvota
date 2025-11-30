#!/bin/bash
################################################################################
# Backend Python Syntax Check
#
# Purpose: Validate Python syntax and optionally run additional checks
# Returns: 0 (passed), 1 (failed)
# Created: 2025-10-30
# Updated: 2025-10-30 - Added help, security checks, type checking options
################################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils/common.sh"

# Parse command line arguments
ARGS=$(parse_args "$@")
if [ $? -eq 1 ]; then
  show_help "backend-syntax-check.sh" \
    "Validate Python syntax and run optional quality checks" \
    "backend-syntax-check.sh [OPTIONS]" \
    "  -h, --help              Show this help message
  -v, --verbose           Enable verbose output
  -q, --quiet             Suppress normal output
  --json                  Output in JSON format
  --no-color              Disable colored output
  --continue-on-error     Continue despite failures
  --skip-syntax           Skip syntax checking
  --enable-mypy           Enable type checking with mypy
  --enable-security       Enable security checks (bandit)
  --enable-complexity     Enable complexity checks (radon)
  --enable-all            Enable all optional checks
  --max-complexity N      Maximum cyclomatic complexity (default: 10)" \
    "  # Basic syntax check
  ./backend-syntax-check.sh

  # Enable type checking
  ./backend-syntax-check.sh --enable-mypy

  # Enable all checks
  ./backend-syntax-check.sh --enable-all

  # Continue on errors and get JSON report
  ./backend-syntax-check.sh --continue-on-error --json"
  exit 0
fi

# Process remaining arguments
SKIP_SYNTAX=0
ENABLE_MYPY=0
ENABLE_SECURITY=0
ENABLE_COMPLEXITY=0
MAX_COMPLEXITY=10

set -- $ARGS
while [ $# -gt 0 ]; do
  case "$1" in
    --skip-syntax)
      SKIP_SYNTAX=1
      shift
      ;;
    --enable-mypy)
      ENABLE_MYPY=1
      shift
      ;;
    --enable-security)
      ENABLE_SECURITY=1
      shift
      ;;
    --enable-complexity)
      ENABLE_COMPLEXITY=1
      shift
      ;;
    --enable-all)
      ENABLE_MYPY=1
      ENABLE_SECURITY=1
      ENABLE_COMPLEXITY=1
      shift
      ;;
    --max-complexity)
      MAX_COMPLEXITY="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Setup
PROJECT_ROOT="/home/novi/workspace/tech/projects/kvota/user-feedback"
BACKEND_DIR="$PROJECT_ROOT/backend"
START_TIME=$(date +%s)

# Check results tracking
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_SKIPPED=0
CHECK_RESULTS=()

################################################################################
# Functions
################################################################################

run_check() {
  local check_name="$1"
  local check_command="$2"
  local allow_failure="${3:-0}"

  log_info "Running $check_name..."

  local output_file=$(mktemp)
  local start=$(date +%s)

  # Run with timeout
  if run_with_timeout "$HOOKS_TIMEOUT" "$check_command" > "$output_file" 2>&1; then
    local duration=$(($(date +%s) - start))
    log_success "$check_name passed (${duration}s)"
    ((CHECKS_PASSED++))

    if [ "$HOOKS_VERBOSE" = "1" ] && [ -s "$output_file" ]; then
      echo "${DIM}Output:${NC}"
      cat "$output_file" | sed 's/^/  /'
    fi

    CHECK_RESULTS+=("{\"check\":\"$check_name\",\"status\":\"passed\",\"duration\":$duration}")
    rm -f "$output_file"
    return 0
  else
    local exit_code=$?
    local duration=$(($(date +%s) - start))

    if [ "$allow_failure" = "1" ]; then
      log_warning "$check_name found issues (non-blocking)"
      ((CHECKS_PASSED++))  # Count as passed since non-blocking
    else
      log_error "$check_name failed (exit code: $exit_code)"
      ((CHECKS_FAILED++))
    fi

    # Show output
    if [ -s "$output_file" ]; then
      echo "${DIM}Output:${NC}"
      if [ "$HOOKS_VERBOSE" = "1" ]; then
        cat "$output_file" | sed 's/^/  /'
      else
        # Show first 10 lines for errors
        head -n 10 "$output_file" | sed 's/^/  /'
        local line_count=$(wc -l < "$output_file")
        if [ $line_count -gt 10 ]; then
          echo "  ... ($(($line_count - 10)) more lines)"
        fi
      fi
    fi

    CHECK_RESULTS+=("{\"check\":\"$check_name\",\"status\":\"failed\",\"duration\":$duration,\"exit_code\":$exit_code}")
    rm -f "$output_file"

    if [ "$HOOKS_CONTINUE_ON_ERROR" != "1" ] && [ "$allow_failure" != "1" ]; then
      log_error "Stopping due to failure (use --continue-on-error to continue)"
      exit 1
    fi

    return $exit_code
  fi
}

################################################################################
# Main Checks
################################################################################

echo ""
print_header "Backend Quality Checks"
print_divider 50

cd "$BACKEND_DIR" || {
  log_error "Backend directory not found: $BACKEND_DIR"
  exit 1
}

# Activate virtual environment if exists
if [ -d "venv" ] && [ -f "venv/bin/activate" ]; then
  log_debug "Activating virtual environment"
  source venv/bin/activate
fi

# Check 1: Python Syntax
if [ "$SKIP_SYNTAX" = "0" ]; then
  run_check "Python Syntax" "python3 -m compileall -q ."
else
  log_info "Skipping syntax check (--skip-syntax)"
  ((CHECKS_SKIPPED++))
fi

# Check 2: Import Validation (Simple version - just check main imports)
if [ "$SKIP_SYNTAX" = "0" ]; then
  # Create a test script to import main modules
  cat > /tmp/test_imports.py << 'EOF'
import sys
import os

# Add backend dir to path
backend_dir = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
sys.path.insert(0, backend_dir)

# Change to backend directory for relative imports
os.chdir(backend_dir)

errors = []

# Test critical imports only (not all modules need to be importable standalone)
critical_imports = [
    "from main import app",
    "from auth import get_current_user",
    "from models import QuoteCreate"
]

for import_stmt in critical_imports:
    try:
        exec(import_stmt)
    except Exception as e:
        errors.append(f"{import_stmt}: {e}")

if errors:
    for error in errors:
        print(f"Import Error: {error}", file=sys.stderr)
    sys.exit(1)
else:
    print("All critical imports successful")
EOF

  run_check "Import Validation" "python3 /tmp/test_imports.py $BACKEND_DIR"
  rm -f /tmp/test_imports.py
fi

# Check 3: Type Checking (mypy)
if [ "$ENABLE_MYPY" = "1" ]; then
  if check_command "mypy"; then
    run_check "Type Checking (mypy)" "mypy . --ignore-missing-imports" 1  # Non-blocking
  else
    log_warning "mypy not installed, skipping type checking"
    log_info "Install with: pip install mypy"
    ((CHECKS_SKIPPED++))
  fi
fi

# Check 4: Security Analysis (bandit)
if [ "$ENABLE_SECURITY" = "1" ]; then
  if check_command "bandit"; then
    run_check "Security Analysis (bandit)" "bandit -r . -f json -o /tmp/bandit.json 2>/dev/null && echo 'No security issues found'" 1

    # Parse and display critical issues if any
    if [ -f "/tmp/bandit.json" ] && [ "$HOOKS_VERBOSE" != "1" ]; then
      python3 -c "
import json
with open('/tmp/bandit.json') as f:
    data = json.load(f)
    if data.get('results'):
        print('  Critical security issues found:')
        for r in data['results'][:5]:
            if r['issue_severity'] in ['HIGH', 'MEDIUM']:
                print(f\"    {r['issue_severity']}: {r['issue_text']} ({r['filename']}:{r['line_number']})\")
      " 2>/dev/null || true
    fi
    rm -f /tmp/bandit.json
  else
    log_warning "bandit not installed, skipping security checks"
    log_info "Install with: pip install bandit"
    ((CHECKS_SKIPPED++))
  fi
fi

# Check 5: Complexity Analysis (radon)
if [ "$ENABLE_COMPLEXITY" = "1" ]; then
  if check_command "radon"; then
    # Check cyclomatic complexity
    run_check "Complexity Analysis" "radon cc . -nc --total-average -nb | grep -E '(^Average|is too complex)' | head -20"

    # Show most complex functions if verbose
    if [ "$HOOKS_VERBOSE" = "1" ]; then
      log_info "Most complex functions:"
      radon cc . -nc -s | head -10 | sed 's/^/  /' || true
    fi
  else
    log_warning "radon not installed, skipping complexity checks"
    log_info "Install with: pip install radon"
    ((CHECKS_SKIPPED++))
  fi
fi

# Check 6: Requirements Security (safety/pip-audit)
if [ "$ENABLE_SECURITY" = "1" ] && [ -f "requirements.txt" ]; then
  if command -v pip-audit >/dev/null 2>&1; then
    run_check "Dependency Security (pip-audit)" "pip-audit --desc -r requirements.txt" 1
  elif command -v safety >/dev/null 2>&1; then
    run_check "Dependency Security (safety)" "safety check -r requirements.txt --json" 1
  else
    log_warning "No dependency scanner installed (pip-audit or safety)"
    log_info "Install with: pip install pip-audit"
    ((CHECKS_SKIPPED++))
  fi
fi

################################################################################
# Summary
################################################################################

# JSON output
if [ "$HOOKS_JSON_OUTPUT" = "1" ]; then
  json_output \
    "$( [ $CHECKS_FAILED -eq 0 ] && echo 'success' || echo 'failure' )" \
    "Backend checks completed" \
    "[$(IFS=,; echo "${CHECK_RESULTS[*]}")]"
  exit $([ $CHECKS_FAILED -eq 0 ] && echo 0 || echo 1)
fi

# Normal summary
generate_summary "$CHECKS_PASSED" "$CHECKS_FAILED" "$CHECKS_SKIPPED" "$START_TIME"
exit $([ $CHECKS_FAILED -eq 0 ] && echo 0 || echo 1)