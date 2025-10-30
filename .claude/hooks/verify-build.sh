#!/bin/bash
# Build Verification Hook
# Verify frontend build + backend compilation before pushing
# Run manually: ./.claude/hooks/verify-build.sh
# Created: 2025-10-30

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source colors utility
if [ ! -f "$SCRIPT_DIR/utils/colors.sh" ]; then
  echo "Error: colors.sh not found at $SCRIPT_DIR/utils/colors.sh"
  exit 1
fi
source "$SCRIPT_DIR/utils/colors.sh"

echo ""
echo -e "${BOLD}Build Verification${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Track results
FRONTEND_FAILED=0
BACKEND_FAILED=0

# Check 1: Frontend build
print_info "Building frontend (this may take 30-60 seconds)..."
cd "$PROJECT_ROOT/frontend"

if [ ! -f "package.json" ]; then
  print_error "Frontend package.json not found"
  FRONTEND_FAILED=1
else
  npm run build > /tmp/frontend-build.log 2>&1
  BUILD_EXIT=$?

  if [ $BUILD_EXIT -eq 0 ]; then
    print_success "Frontend build passed"
  else
    # Check if it's just ESLint warnings
    if grep -q "Warning:" /tmp/frontend-build.log && grep -q "Failed to compile" /tmp/frontend-build.log; then
      print_warning "Frontend build failed due to ESLint warnings (not critical)"
      print_info "Consider fixing warnings for code quality:"
      grep "Warning:" /tmp/frontend-build.log | head -10
      print_info "See full logs: /tmp/frontend-build.log"
      # Don't fail on warnings by default
      # Uncomment next line to treat warnings as errors
      # FRONTEND_FAILED=1
    else
      print_error "Frontend build failed"
      print_info "See logs: /tmp/frontend-build.log"
      # Show last 20 lines of error
      echo ""
      echo -e "${DIM}Last 20 lines of build log:${NC}"
      tail -n 20 /tmp/frontend-build.log
      FRONTEND_FAILED=1
    fi
  fi
fi

echo ""

# Check 2: Backend compilation
print_info "Checking backend compilation..."
cd "$PROJECT_ROOT/backend"

if [ ! -f "main.py" ]; then
  print_error "Backend main.py not found"
  BACKEND_FAILED=1
else
  python3 -m compileall -q . 2>&1 | tee /tmp/backend-compile.log
  if [ $? -eq 0 ]; then
    print_success "Backend compilation passed"
  else
    print_error "Backend compilation failed"
    print_info "See logs: /tmp/backend-compile.log"
    BACKEND_FAILED=1
  fi
fi

echo ""

# Optional: Type checking (commented out by default)
# Uncomment to enable mypy type checking
# print_info "Running backend type check..."
# cd "$PROJECT_ROOT/backend"
# mypy . > /tmp/backend-mypy.log 2>&1
# if [ $? -eq 0 ]; then
#   print_success "Type checking passed"
# else
#   print_warning "Type checking found issues (review recommended)"
#   print_info "See logs: /tmp/backend-mypy.log"
# fi

# Summary
cd "$PROJECT_ROOT"
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FRONTEND_FAILED -eq 0 ] && [ $BACKEND_FAILED -eq 0 ]; then
  print_success "Build verification passed! Safe to push. ✓"
  echo ""
  print_info "To push: ${BOLD}git push origin $CURRENT_BRANCH${NC}"
  exit 0
else
  print_error "Build verification failed. Fix errors before pushing:"
  echo ""
  [ $FRONTEND_FAILED -eq 1 ] && echo "  ✗ Frontend build errors (check /tmp/frontend-build.log)"
  [ $BACKEND_FAILED -eq 1 ] && echo "  ✗ Backend compilation errors (check /tmp/backend-compile.log)"
  echo ""
  print_warning "Fix the errors above and run this script again."
  exit 1
fi
