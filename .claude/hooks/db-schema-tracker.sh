#!/bin/bash
################################################################################
# Database Schema Change Tracker
#
# Purpose: Detects migration file changes and reminds to update DATABASE_SCHEMA.md
# Triggers: PostToolUse on Edit|Write of backend/migrations/*.sql files
# Created: 2025-12-11
################################################################################

set -e

# Read tool information from stdin
tool_info=$(cat)

# Extract file path from tool input
file_path=$(echo "$tool_info" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Exit if no file path
if [[ -z "$file_path" ]]; then
    exit 0
fi

# Only process migration SQL files
if [[ "$file_path" != *"backend/migrations"* ]] || [[ "$file_path" != *.sql ]]; then
    exit 0
fi

# Extract migration filename
migration_name=$(basename "$file_path")

# Read file content to detect DDL operations
if [[ -f "$file_path" ]]; then
    content=$(cat "$file_path" | tr '[:lower:]' '[:upper:]')
else
    # File might be new, use tool input content if available
    content=$(echo "$tool_info" | jq -r '.tool_input.content // empty' 2>/dev/null | tr '[:lower:]' '[:upper:]')
fi

# Detect operations in migration
operations=()
[[ "$content" == *"CREATE TABLE"* ]] && operations+=("CREATE TABLE")
[[ "$content" == *"ALTER TABLE"* ]] && operations+=("ALTER TABLE")
[[ "$content" == *"DROP TABLE"* ]] && operations+=("DROP TABLE")
[[ "$content" == *"ADD COLUMN"* ]] && operations+=("ADD COLUMN")
[[ "$content" == *"DROP COLUMN"* ]] && operations+=("DROP COLUMN")
[[ "$content" == *"CREATE INDEX"* ]] && operations+=("CREATE INDEX")
[[ "$content" == *"DROP INDEX"* ]] && operations+=("DROP INDEX")
[[ "$content" == *"CREATE POLICY"* ]] && operations+=("CREATE POLICY")
[[ "$content" == *"DROP POLICY"* ]] && operations+=("DROP POLICY")
[[ "$content" == *"ALTER POLICY"* ]] && operations+=("ALTER POLICY")
[[ "$content" == *"ADD CONSTRAINT"* ]] && operations+=("ADD CONSTRAINT")
[[ "$content" == *"DROP CONSTRAINT"* ]] && operations+=("DROP CONSTRAINT")

# Exit if no DDL operations detected
if [[ ${#operations[@]} -eq 0 ]]; then
    exit 0
fi

# Output reminder message
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 MIGRATION FILE CHANGED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "File: $migration_name"
echo "Operations: ${operations[*]}"
echo ""
echo "⚠️  ACTION REQUIRED:"
echo "   Update docs/DATABASE_SCHEMA.md to reflect this change"
echo ""
echo "   Checklist:"
for op in "${operations[@]}"; do
    case "$op" in
        "CREATE TABLE")
            echo "   □ Add new table section (columns, indexes, FK, RLS)"
            ;;
        "ALTER TABLE"|"ADD COLUMN"|"DROP COLUMN")
            echo "   □ Update column definitions in affected table"
            ;;
        "DROP TABLE")
            echo "   □ Remove table section from documentation"
            ;;
        "CREATE INDEX"|"DROP INDEX")
            echo "   □ Update Indexes section for the table"
            ;;
        "CREATE POLICY"|"DROP POLICY"|"ALTER POLICY")
            echo "   □ Update RLS Policies section and summary table"
            ;;
        "ADD CONSTRAINT"|"DROP CONSTRAINT")
            echo "   □ Update Foreign Keys section"
            ;;
    esac
done
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Log to file for later reference
log_dir="$CLAUDE_PROJECT_DIR/.claude/logs"
mkdir -p "$log_dir"
echo "$(date -Iseconds) | $migration_name | ${operations[*]}" >> "$log_dir/schema-changes.log"

exit 0
