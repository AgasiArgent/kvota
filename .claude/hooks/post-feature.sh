#!/bin/bash
################################################################################
# Post-Feature Quality Checks
#
# Purpose: Run comprehensive quality checks after completing a feature
# Usage: ./.claude/hooks/post-feature.sh
#
# Checks performed:
# 1. Backend tests (pytest)
# 2. Frontend tests (npm test)
# 3. Documentation updates (SESSION_PROGRESS.md)
#
# Dependencies:
# - .claude/hooks/utils/colors.sh
# - .claude/hooks/utils/check-docs.sh
# - pytest (in backend/venv): pip install pytest pytest-asyncio pytest-cov
# - npm test configured in frontend/package.json
#
# Exit codes:
# 0 - All checks passed
# 1 - One or more checks failed
#
# Created: 2025-10-30
################################################################################

set -e  # Exit on error for critical operations

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load utilities
source "$SCRIPT_DIR/utils/colors.sh"

echo ""
echo -e "${BOLD}Post-Feature Quality Checks${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Track results
BACKEND_FAILED=0
FRONTEND_FAILED=0
DOCS_FAILED=0

################################################################################
# Check 1: Backend Tests
################################################################################

print_info "Running backend tests..."
cd "$PROJECT_ROOT/backend"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
  source venv/bin/activate
fi

# Run pytest with verbose output and short traceback
set +e  # Don't exit on test failure

# Try to run pytest, fallback to python -m pytest if not in PATH
if command -v pytest &> /dev/null; then
  pytest -v --tb=short
else
  python3 -m pytest -v --tb=short
fi
BACKEND_EXIT=$?
set -e

if [ $BACKEND_EXIT -eq 0 ]; then
  print_success "Backend tests passed"
else
  print_error "Backend tests failed (exit code: $BACKEND_EXIT)"
  BACKEND_FAILED=1
fi

echo ""

################################################################################
# Check 2: Frontend Tests
################################################################################

print_info "Running frontend tests..."
cd "$PROJECT_ROOT/frontend"

# Run npm test with passWithNoTests flag
set +e  # Don't exit on test failure
npm test -- --passWithNoTests --watchAll=false
FRONTEND_EXIT=$?
set -e

if [ $FRONTEND_EXIT -eq 0 ]; then
  print_success "Frontend tests passed"
else
  print_error "Frontend tests failed (exit code: $FRONTEND_EXIT)"
  FRONTEND_FAILED=1
fi

echo ""

################################################################################
# Check 3: Documentation Updated
################################################################################

print_info "Checking documentation..."

# Use check-docs utility
set +e  # Don't exit on doc check failure
bash "$SCRIPT_DIR/utils/check-docs.sh"
DOCS_EXIT=$?
set -e

if [ $DOCS_EXIT -eq 0 ]; then
  print_success "Documentation up to date"
else
  print_warning "SESSION_PROGRESS.md should be updated"
  print_info "Run: Update .claude/SESSION_PROGRESS.md with feature completion"
  DOCS_FAILED=1
fi

echo ""

################################################################################
# Summary and Next Steps
################################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $BACKEND_FAILED -eq 0 ] && [ $FRONTEND_FAILED -eq 0 ] && [ $DOCS_FAILED -eq 0 ]; then
  print_success "All quality checks passed! ✓"
  echo ""
  print_info "Next steps:"
  echo "  1. Review changes: ${CYAN}git status && git diff${NC}"
  echo "  2. Commit changes: ${CYAN}git add . && git commit -m '...'${NC}"
  echo "  3. Optionally run: ${CYAN}.claude/hooks/verify-build.sh${NC}"
  echo "  4. Push to remote: ${CYAN}git push${NC}"
  echo ""
  exit 0
else
  print_error "Some checks failed. Please review:"
  echo ""

  if [ $BACKEND_FAILED -eq 1 ]; then
    echo "  ${RED}✗${NC} Fix backend test failures"
    echo "    Run: ${CYAN}cd backend && pytest -v${NC}"
  fi

  if [ $FRONTEND_FAILED -eq 1 ]; then
    echo "  ${RED}✗${NC} Fix frontend test failures"
    echo "    Run: ${CYAN}cd frontend && npm test${NC}"
  fi

  if [ $DOCS_FAILED -eq 1 ]; then
    echo "  ${YELLOW}!${NC} Update SESSION_PROGRESS.md"
    echo "    Edit: ${CYAN}.claude/SESSION_PROGRESS.md${NC}"
  fi

  echo ""
  exit 1
fi
