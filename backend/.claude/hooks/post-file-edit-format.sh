#!/bin/bash
# Post-File-Edit Format Hook for Russian B2B Quotation System
# Automatically formats Python files after editing

set -e

# Get the edited file path from the first argument
EDITED_FILE="$1"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if file exists and is a Python file
if [[ ! -f "$EDITED_FILE" ]]; then
    exit 0
fi

if [[ "$EDITED_FILE" != *.py ]]; then
    exit 0
fi

# Skip if file is in virtual environment or cache directories
if [[ "$EDITED_FILE" == *"/venv/"* ]] || [[ "$EDITED_FILE" == *"/__pycache__/"* ]] || [[ "$EDITED_FILE" == *".pyc" ]]; then
    exit 0
fi

print_info "Auto-formatting Python file: $EDITED_FILE"

# Activate virtual environment if it exists
if [[ -f "venv/bin/activate" ]]; then
    source venv/bin/activate
fi

# Check if required tools are available
if ! command -v black &> /dev/null; then
    print_info "Installing black..."
    pip install black --quiet
fi

if ! command -v isort &> /dev/null; then
    print_info "Installing isort..."
    pip install isort --quiet
fi

# Get original file modification time
ORIGINAL_MTIME=$(stat -f "%m" "$EDITED_FILE" 2>/dev/null || stat -c "%Y" "$EDITED_FILE" 2>/dev/null || echo "0")

# Run black formatting
if black --quiet "$EDITED_FILE" 2>/dev/null; then
    print_status "Black formatting applied"
else
    print_info "Black formatting skipped (syntax errors)"
fi

# Run isort import sorting
if isort --quiet "$EDITED_FILE" 2>/dev/null; then
    print_status "Import sorting applied"
else
    print_info "Import sorting skipped"
fi

# Check if file was modified
NEW_MTIME=$(stat -f "%m" "$EDITED_FILE" 2>/dev/null || stat -c "%Y" "$EDITED_FILE" 2>/dev/null || echo "0")

if [[ "$ORIGINAL_MTIME" != "$NEW_MTIME" ]]; then
    print_status "File auto-formatted: $EDITED_FILE"

    # Optional: Add Russian business pattern validation
    if python -c "
import re
import sys

# Check for common Russian business patterns
russian_patterns = {
    'inn_format': r'inn[\"\']\s*:\s*[\"\']\d{10,12}[\"\']',
    'kpp_format': r'kpp[\"\']\s*:\s*[\"\']\d{9}[\"\']',
    'rub_currency': r'currency[\"\']\s*:\s*[\"\'](RUB|RUR)[\"\']',
    'russian_phone': r'\+7\s*\(\d{3}\)\s*\d{3}-\d{2}-\d{2}',
}

try:
    with open('$EDITED_FILE', 'r', encoding='utf-8') as f:
        content = f.read()

    for pattern_name, pattern in russian_patterns.items():
        if re.search(pattern, content, re.IGNORECASE):
            print(f'✅ Found {pattern_name} pattern')

except Exception:
    pass
" 2>/dev/null; then
        print_status "Russian business patterns validated"
    fi
else
    print_info "No formatting changes needed"
fi