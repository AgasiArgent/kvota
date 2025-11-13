#!/bin/bash
# Path sanitization utility
# Usage: SAFE_PATH=$(sanitize_path "$USER_INPUT")

sanitize_path() {
    local input="$1"

    # Remove leading/trailing whitespace
    input=$(echo "$input" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

    # Check for dangerous characters (command injection)
    if echo "$input" | grep -q '[;&|`$()<>]'; then
        echo "ERROR: Path contains dangerous characters" >&2
        return 1
    fi

    # Remove any directory traversal attempts
    input=$(echo "$input" | sed 's/\.\.\///g' | sed 's/\.\.\///g')

    # Ensure it's within project directory
    if [[ "$input" != /* ]]; then
        # Relative path - make it absolute within project
        input="/home/novi/quotation-app-dev/$input"
    fi

    # Verify it's within allowed directory
    if [[ "$input" != /home/novi/quotation-app-dev/* ]]; then
        echo "ERROR: Path must be within project directory" >&2
        return 1
    fi

    # Return sanitized path
    echo "$input"
    return 0
}

# Export function for use in other scripts
export -f sanitize_path