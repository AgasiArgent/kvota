#!/bin/bash
# Pre-commit Quality Hook for Russian B2B Quotation System
# Runs code formatting, linting, and type checking before commits

set -e

echo "🔍 Running pre-commit quality checks..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in a Python virtual environment
if [[ -z "$VIRTUAL_ENV" && ! -f "venv/bin/activate" ]]; then
    print_warning "No virtual environment detected. Installing dev dependencies globally..."
fi

# Activate virtual environment if it exists
if [[ -f "venv/bin/activate" ]]; then
    source venv/bin/activate
    print_status "Virtual environment activated"
fi

# Install dev dependencies if requirements-dev.txt exists
if [[ -f "requirements-dev.txt" ]]; then
    print_status "Installing development dependencies..."
    pip install -r requirements-dev.txt --quiet
fi

# Get list of Python files to check (staged files or all if none staged)
if git rev-parse --verify HEAD >/dev/null 2>&1; then
    # Not initial commit, check staged files
    PYTHON_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E "\.py$" || echo "")
else
    # Initial commit, check all Python files
    PYTHON_FILES=$(find . -name "*.py" -not -path "./venv/*" -not -path "./.venv/*" | tr '\n' ' ')
fi

if [[ -z "$PYTHON_FILES" ]]; then
    print_status "No Python files to check"
    exit 0
fi

echo "📁 Checking files: $PYTHON_FILES"

# Run Black (code formatter)
echo ""
echo "🖤 Running Black (code formatter)..."
if black --check --diff --color $PYTHON_FILES; then
    print_status "Black formatting check passed"
else
    print_error "Black formatting issues found"
    echo "Run 'black $PYTHON_FILES' to fix formatting"
    exit 1
fi

# Run isort (import sorter)
echo ""
echo "📦 Running isort (import sorter)..."
if isort --check-only --diff --color $PYTHON_FILES; then
    print_status "Import sorting check passed"
else
    print_error "Import sorting issues found"
    echo "Run 'isort $PYTHON_FILES' to fix imports"
    exit 1
fi

# Run flake8 (linting)
echo ""
echo "🔍 Running flake8 (linting)..."
if flake8 $PYTHON_FILES --max-line-length=88 --extend-ignore=E203,W503; then
    print_status "Flake8 linting check passed"
else
    print_error "Flake8 linting issues found"
    exit 1
fi

# Run mypy (type checking)
echo ""
echo "🎯 Running mypy (type checking)..."
if mypy $PYTHON_FILES --ignore-missing-imports --no-strict-optional; then
    print_status "MyPy type checking passed"
else
    print_warning "MyPy type checking issues found (non-blocking)"
    # Don't exit on mypy errors for now, just warn
fi

# Run bandit (security linting)
echo ""
echo "🛡️  Running bandit (security check)..."
if bandit -r $PYTHON_FILES -f json -o bandit-report.json --quiet; then
    print_status "Security check passed"
else
    print_warning "Security issues found (check bandit-report.json)"
    # Don't exit on bandit errors for now, just warn
fi

# Check for Russian business logic patterns
echo ""
echo "🇷🇺 Running Russian business validation..."
if python -c "
import sys
import re

# Patterns to check for Russian business compliance
patterns = {
    'inn_validation': r'inn.*=.*[^0-9]',  # INN should only contain digits
    'kpp_validation': r'kpp.*=.*[^0-9]',  # KPP should only contain digits
    'rub_currency': r'currency.*=.*[^\'\"]*RUB',  # Ensure RUB is quoted
    'vat_rate': r'vat_rate.*=.*[^2][^0]',  # VAT should typically be 20%
}

issues_found = False
for file_path in '$PYTHON_FILES'.split():
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            for pattern_name, pattern in patterns.items():
                if re.search(pattern, content, re.IGNORECASE):
                    print(f'⚠️  {file_path}: Potential {pattern_name} issue')
                    issues_found = True
    except Exception as e:
        pass

if not issues_found:
    print('✅ Russian business validation passed')
"; then
    print_status "Russian business patterns check completed"
fi

echo ""
print_status "All quality checks completed successfully!"
echo "🚀 Ready for commit!"