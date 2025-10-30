#!/bin/bash
################################################################################
# Documentation Freshness Check
#
# Purpose: Check if documentation files are up-to-date
# Returns: 0 (updated), 1 (stale)
# Created: 2025-10-30
# Updated: 2025-10-30 - Added help, multiple files, JSON output
################################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Default configuration
DEFAULT_THRESHOLD_MINUTES=30
PROJECT_ROOT="/home/novi/quotation-app-dev"

# Parse command line arguments
ARGS=$(parse_args "$@")
if [ $? -eq 1 ]; then
  show_help "check-docs.sh" \
    "Check if documentation files are up-to-date" \
    "check-docs.sh [OPTIONS] [THRESHOLD_MINUTES]" \
    "  -h, --help              Show this help message
  -v, --verbose           Enable verbose output
  -q, --quiet             Suppress normal output
  --json                  Output in JSON format
  --all                   Check all documentation files
  --fix                   Update timestamps on stale files
  --threshold MINUTES     Staleness threshold (default: 30)
  --file PATH             Check specific file (can be used multiple times)" \
    "  # Check SESSION_PROGRESS.md with default threshold
  ./check-docs.sh

  # Check with custom threshold
  ./check-docs.sh --threshold 60

  # Check all documentation files
  ./check-docs.sh --all

  # Fix stale documentation
  ./check-docs.sh --fix

  # Check specific files
  ./check-docs.sh --file CLAUDE.md --file frontend/CLAUDE.md"
  exit 0
fi

# Process remaining arguments
CHECK_ALL=0
FIX_STALE=0
THRESHOLD_MINUTES="$DEFAULT_THRESHOLD_MINUTES"
FILES_TO_CHECK=()

set -- $ARGS
while [ $# -gt 0 ]; do
  case "$1" in
    --all)
      CHECK_ALL=1
      shift
      ;;
    --fix)
      FIX_STALE=1
      shift
      ;;
    --threshold)
      THRESHOLD_MINUTES="$2"
      shift 2
      ;;
    --file)
      FILES_TO_CHECK+=("$2")
      shift 2
      ;;
    *)
      # If a number is provided as positional arg, use as threshold
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        THRESHOLD_MINUTES="$1"
      fi
      shift
      ;;
  esac
done

THRESHOLD_SECONDS=$((THRESHOLD_MINUTES * 60))

################################################################################
# Functions
################################################################################

get_file_age() {
  local file="$1"
  local current_time=$(date +%s)
  local file_mod_time=$(stat -c %Y "$file" 2>/dev/null || echo 0)
  local age_seconds=$((current_time - file_mod_time))
  echo "$age_seconds"
}

format_age() {
  local seconds="$1"
  local days=$((seconds / 86400))
  local hours=$(((seconds % 86400) / 3600))
  local minutes=$(((seconds % 3600) / 60))

  if [ $days -gt 0 ]; then
    echo "${days}d ${hours}h ${minutes}m"
  elif [ $hours -gt 0 ]; then
    echo "${hours}h ${minutes}m"
  else
    echo "${minutes}m"
  fi
}

check_file_freshness() {
  local file="$1"
  local age=$(get_file_age "$file")

  if [ ! -f "$file" ]; then
    echo "NOT_FOUND"
    return 2
  fi

  if [ $age -lt $THRESHOLD_SECONDS ]; then
    echo "FRESH"
    return 0
  else
    echo "STALE"
    return 1
  fi
}

update_file_timestamp() {
  local file="$1"

  if [ ! -f "$file" ]; then
    log_error "File not found: $file"
    return 1
  fi

  # Add a timestamp comment at the top if it's a markdown file
  if [[ "$file" == *.md ]]; then
    local temp_file=$(mktemp)
    echo "<!-- Last checked: $(date '+%Y-%m-%d %H:%M:%S') -->" > "$temp_file"

    # Remove old timestamp comment if exists
    grep -v "^<!-- Last checked:" "$file" >> "$temp_file"

    mv "$temp_file" "$file"
    log_success "Updated timestamp in $file"
  else
    # Just touch the file
    touch "$file"
    log_success "Updated modification time for $file"
  fi
}

################################################################################
# Main
################################################################################

# Build list of files to check
if [ ${#FILES_TO_CHECK[@]} -eq 0 ]; then
  if [ "$CHECK_ALL" = "1" ]; then
    FILES_TO_CHECK=(
      "$PROJECT_ROOT/.claude/SESSION_PROGRESS.md"
      "$PROJECT_ROOT/CLAUDE.md"
      "$PROJECT_ROOT/frontend/CLAUDE.md"
      "$PROJECT_ROOT/backend/CLAUDE.md"
      "$PROJECT_ROOT/.claude/VARIABLES.md"
      "$PROJECT_ROOT/.claude/TECHNICAL_DEBT.md"
      "$PROJECT_ROOT/.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md"
      "$PROJECT_ROOT/README.md"
    )
  else
    # Default: just SESSION_PROGRESS.md
    FILES_TO_CHECK=("$PROJECT_ROOT/.claude/SESSION_PROGRESS.md")
  fi
fi

# Check each file
TOTAL_FILES=${#FILES_TO_CHECK[@]}
FRESH_COUNT=0
STALE_COUNT=0
NOT_FOUND_COUNT=0
RESULTS=()

log_debug "Checking $TOTAL_FILES documentation files..."

for file in "${FILES_TO_CHECK[@]}"; do
  # Handle relative paths
  if [[ "$file" != /* ]]; then
    file="$PROJECT_ROOT/$file"
  fi

  STATUS=$(check_file_freshness "$file")
  EXIT_CODE=$?
  AGE=$(get_file_age "$file")
  AGE_FORMATTED=$(format_age "$AGE")
  BASENAME=$(basename "$file")

  case "$STATUS" in
    FRESH)
      ((FRESH_COUNT++))
      log_success "$BASENAME is up-to-date (updated $AGE_FORMATTED ago)"
      ;;
    STALE)
      ((STALE_COUNT++))
      log_warning "$BASENAME is stale (updated $AGE_FORMATTED ago)"

      if [ "$FIX_STALE" = "1" ]; then
        update_file_timestamp "$file"
      fi
      ;;
    NOT_FOUND)
      ((NOT_FOUND_COUNT++))
      log_error "$BASENAME not found"
      ;;
  esac

  # Store result for JSON output
  RESULTS+=("{\"file\":\"$file\",\"status\":\"$STATUS\",\"age_seconds\":$AGE,\"age_formatted\":\"$AGE_FORMATTED\"}")
done

# Generate overall status
if [ $NOT_FOUND_COUNT -gt 0 ]; then
  OVERALL_STATUS="ERROR"
  OVERALL_EXIT=2
elif [ $STALE_COUNT -gt 0 ]; then
  OVERALL_STATUS="STALE"
  OVERALL_EXIT=1
else
  OVERALL_STATUS="FRESH"
  OVERALL_EXIT=0
fi

# JSON output
if [ "$HOOKS_JSON_OUTPUT" = "1" ]; then
  cat << EOF
{
  "overall_status": "$OVERALL_STATUS",
  "threshold_minutes": $THRESHOLD_MINUTES,
  "summary": {
    "total": $TOTAL_FILES,
    "fresh": $FRESH_COUNT,
    "stale": $STALE_COUNT,
    "not_found": $NOT_FOUND_COUNT
  },
  "files": [$(IFS=,; echo "${RESULTS[*]}")],
  "exit_code": $OVERALL_EXIT
}
EOF
  exit $OVERALL_EXIT
fi

# Summary
echo ""
print_divider 50
if [ $TOTAL_FILES -gt 1 ]; then
  echo "${BOLD}Documentation Status Summary:${NC}"
  echo "  ${GREEN}✓ Fresh:${NC} $FRESH_COUNT"
  [ $STALE_COUNT -gt 0 ] && echo "  ${YELLOW}⚠ Stale:${NC} $STALE_COUNT"
  [ $NOT_FOUND_COUNT -gt 0 ] && echo "  ${RED}✗ Not Found:${NC} $NOT_FOUND_COUNT"
  echo ""
fi

# Recommend action
if [ $STALE_COUNT -gt 0 ] && [ "$FIX_STALE" = "0" ]; then
  log_info "To update stale files, run: $0 --fix"
fi

exit $OVERALL_EXIT