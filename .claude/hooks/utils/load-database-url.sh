#!/bin/bash
# Secure database URL loading utility
# Usage: source load-database-url.sh

# Determine project root dynamically
LOAD_DB_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOAD_DB_PROJECT_ROOT="$(cd "$LOAD_DB_SCRIPT_DIR/../../.." && pwd)"

# Check if DATABASE_URL already set
if [ -n "$DATABASE_URL" ]; then
    echo "✓ DATABASE_URL already set"
    return 0
fi

# Try loading from .env file
ENV_FILE="$LOAD_DB_PROJECT_ROOT/backend/.env"
if [ -f "$ENV_FILE" ]; then
    # Check file permissions (should be 600 or 400)
    # Use stat -f on macOS, stat -c on Linux
    if [[ "$OSTYPE" == "darwin"* ]]; then
        PERMS=$(stat -f %Lp "$ENV_FILE" 2>/dev/null)
    else
        PERMS=$(stat -c %a "$ENV_FILE" 2>/dev/null)
    fi
    if [ "$PERMS" != "600" ] && [ "$PERMS" != "400" ]; then
        echo "⚠️  WARNING: .env file has insecure permissions ($PERMS)"
        echo "   Fix with: chmod 600 $ENV_FILE"
    fi

    # Load DATABASE_URL without exposing it
    export DATABASE_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"')

    if [ -n "$DATABASE_URL" ]; then
        echo "✓ DATABASE_URL loaded from .env file"
        return 0
    fi
fi

# Try loading from secure credential store (future enhancement)
# if command -v pass >/dev/null 2>&1; then
#     export DATABASE_URL=$(pass show database/url 2>/dev/null)
#     if [ -n "$DATABASE_URL" ]; then
#         echo "✓ DATABASE_URL loaded from password manager"
#         return 0
#     fi
# fi

echo "❌ ERROR: DATABASE_URL not found"
echo "   Please set it in backend/.env file:"
echo "   DATABASE_URL=\"postgresql://user:pass@host:port/db\""
return 1
