#!/bin/bash
# SESSION_PROGRESS.md Freshness Check
# Returns: 0 (updated recently), 1 (stale)

# Configuration: threshold in minutes (default 30 minutes)
THRESHOLD_MINUTES=${1:-30}
THRESHOLD_SECONDS=$((THRESHOLD_MINUTES * 60))

DOCS_FILE="/home/novi/quotation-app-dev/.claude/SESSION_PROGRESS.md"
CURRENT_TIME=$(date +%s)
FILE_MOD_TIME=$(stat -c %Y "$DOCS_FILE")
DIFF=$((CURRENT_TIME - FILE_MOD_TIME))
DIFF_MINUTES=$((DIFF / 60))

if [ $DIFF -lt $THRESHOLD_SECONDS ]; then
  echo "✓ SESSION_PROGRESS.md updated recently"
  exit 0
else
  echo "⚠ SESSION_PROGRESS.md not updated (last modified ${DIFF_MINUTES} min ago, threshold: ${THRESHOLD_MINUTES} min)"
  exit 1
fi
