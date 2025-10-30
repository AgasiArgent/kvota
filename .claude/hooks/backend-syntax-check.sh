#!/bin/bash
# Backend Python Syntax Check
# Returns: 0 (passed), 1 (failed)

# Source colors
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils/colors.sh"

echo ""
echo -e "${BOLD}Backend Syntax Check${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Python syntax
cd /home/novi/quotation-app-dev/backend
python3 -m compileall -q .
SYNTAX_STATUS=$?

if [ $SYNTAX_STATUS -eq 0 ]; then
  print_success "Python syntax check passed"
else
  print_error "Python syntax errors found"
  print_info "Fix syntax errors before committing"
  exit 1
fi

# Optional: mypy type checking (commented out by default)
# Uncomment when ready to enforce type checking:
# print_info "Running type check (mypy)..."
# mypy .
# if [ $? -eq 0 ]; then
#   print_success "Type checking passed"
# else
#   print_warning "Type checking found issues (non-blocking)"
# fi

print_success "Backend checks complete"
exit 0
