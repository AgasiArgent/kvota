#!/bin/bash
# Hook: Check Dev Docs Status
# Purpose: Remind about dev docs for large changes

set -e

# Source common functions
HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HOOKS_DIR/utils/colors.sh"
source "$HOOKS_DIR/utils/logging.sh"

# Configuration
DEV_DOCS_DIR="$HOOKS_DIR/../../dev"
THRESHOLD_LINES=200
THRESHOLD_FILES=5

check_dev_docs() {
    local lines_changed=$1
    local files_changed=$2

    # Check if this warrants dev docs
    if [[ $lines_changed -ge $THRESHOLD_LINES ]] || [[ $files_changed -ge $THRESHOLD_FILES ]]; then
        log_warning "Large change detected: ${lines_changed} lines in ${files_changed} files"

        # Check for active dev docs
        local active_count=$(find "$DEV_DOCS_DIR/active" -maxdepth 1 -type d | wc -l)
        ((active_count--)) # Subtract the active directory itself

        if [[ $active_count -eq 0 ]]; then
            log_warning "Consider creating dev docs for this task:"
            echo "  dev/dev-docs init 'Your task description'"
            echo ""
            echo "Dev docs help preserve context for:"
            echo "  - Tasks >1 hour"
            echo "  - Complex features"
            echo "  - Multi-file changes"
            return 1
        else
            log_info "Found $active_count active dev docs task(s)"

            # Remind to update
            echo "Remember to update dev docs before committing:"
            echo "  dev/dev-docs update"
            echo ""
        fi
    fi

    return 0
}

# Main execution
main() {
    # Get git statistics
    local lines_changed=$(git diff --cached --numstat | awk '{sum+=$1+$2} END {print sum}')
    local files_changed=$(git diff --cached --name-only | wc -l)

    # Default to 0 if empty
    lines_changed=${lines_changed:-0}
    files_changed=${files_changed:-0}

    check_dev_docs "$lines_changed" "$files_changed"
}

# Run if not sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi