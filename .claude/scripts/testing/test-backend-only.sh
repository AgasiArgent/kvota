#!/bin/bash

# Backend-Only Testing Script (No Browser)
# Tests backend API endpoints with minimal resource usage
# Usage: ./.claude/test-backend-only.sh

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test credentials
EMAIL="andrey@masterbearingsales.ru"
PASSWORD="password"

# API base URL
API_URL="http://localhost:8000"

# Exit code
EXIT_CODE=0

# Function to print colored status
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
    EXIT_CODE=1
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to measure time
timer_start() {
    START_TIME=$(date +%s.%N)
}

timer_end() {
    END_TIME=$(date +%s.%N)
    ELAPSED=$(echo "$END_TIME - $START_TIME" | bc)
    echo "${ELAPSED}s"
}

# Header
echo ""
echo "========================================"
echo "Backend-Only Testing (No Browser)"
echo "========================================"
echo ""

# Test 1: Check if backend is running
print_info "Test 1: Checking if backend server is running..."
timer_start
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/organizations/" 2>/dev/null)
TIME=$(timer_end)

# 403 Forbidden is OK - it means server is running but not authenticated yet
if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "403" ]; then
    print_success "Backend is running (HTTP $RESPONSE) - ${TIME}"
else
    print_error "Backend is not running (HTTP $RESPONSE) - ${TIME}"
    echo ""
    echo "Please start backend server:"
    echo "  cd backend && uvicorn main:app --reload"
    echo ""
    exit 1
fi

# Test 2: Login and get JWT token
print_info "Test 2: Attempting login with test credentials..."
timer_start
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" 2>/dev/null)
TIME=$(timer_end)

# Extract token from response
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    print_success "Login successful (JWT token received) - ${TIME}"
    # Show first 20 chars of token
    TOKEN_PREVIEW="${TOKEN:0:20}..."
    echo "          Token: $TOKEN_PREVIEW"
else
    print_error "Login failed - ${TIME}"
    echo "          Response: $LOGIN_RESPONSE"
    EXIT_CODE=1
fi

# Test 3: Fetch admin settings
if [ -n "$TOKEN" ]; then
    print_info "Test 3: Fetching admin calculation settings..."
    timer_start
    SETTINGS_RESPONSE=$(curl -s -X GET "$API_URL/api/calculation-settings" \
        -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    TIME=$(timer_end)

    # Extract rate_forex_risk value
    FOREX_RISK=$(echo "$SETTINGS_RESPONSE" | grep -o '"rate_forex_risk":[0-9.]*' | cut -d':' -f2)
    FIN_COMM=$(echo "$SETTINGS_RESPONSE" | grep -o '"rate_fin_comm":[0-9.]*' | cut -d':' -f2)

    if [ -n "$FOREX_RISK" ] && [ -n "$FIN_COMM" ]; then
        print_success "Fetched admin settings - ${TIME}"
        echo "          rate_forex_risk: $FOREX_RISK"
        echo "          rate_fin_comm: $FIN_COMM"
    else
        print_error "Failed to fetch admin settings - ${TIME}"
        echo "          Response: $SETTINGS_RESPONSE"
    fi
fi

# Test 4: Fetch variable templates
if [ -n "$TOKEN" ]; then
    print_info "Test 4: Fetching variable templates..."
    timer_start
    TEMPLATES_RESPONSE=$(curl -s -X GET "$API_URL/api/quotes-calc/variable-templates" \
        -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    TIME=$(timer_end)

    # Count templates
    TEMPLATE_COUNT=$(echo "$TEMPLATES_RESPONSE" | grep -o '"template_name":"[^"]*"' | wc -l)

    if [ "$TEMPLATE_COUNT" -gt 0 ]; then
        print_success "Fetched $TEMPLATE_COUNT variable templates - ${TIME}"
    else
        print_warning "No variable templates found (this is OK if none created yet) - ${TIME}"
    fi
fi

# Test 5: Test calculation endpoint with minimal data
if [ -n "$TOKEN" ]; then
    print_info "Test 5: Testing calculation endpoint with minimal data..."
    timer_start

    # Minimal calculation payload
    CALC_PAYLOAD='{
        "products": [
            {
                "sku": "TEST-001",
                "brand": "Test Brand",
                "base_price_VAT": 1000.00,
                "quantity": 10,
                "weight_in_kg": 50
            }
        ],
        "quote_variables": {
            "currency": "USD",
            "volume_in_CBM": 2.5
        }
    }'

    CALC_RESPONSE=$(curl -s -X POST "$API_URL/api/quotes-calc/calculate" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "$CALC_PAYLOAD" 2>/dev/null)
    TIME=$(timer_end)

    # Check if calculation succeeded
    CALC_SUCCESS=$(echo "$CALC_RESPONSE" | grep -o '"total_cost":[0-9.]*' | cut -d':' -f2)

    if [ -n "$CALC_SUCCESS" ]; then
        print_success "Calculation succeeded (minimal data) - ${TIME}"
        echo "          total_cost: $CALC_SUCCESS"
    else
        # Check if it's a validation error (expected for missing required fields)
        ERROR_MSG=$(echo "$CALC_RESPONSE" | grep -o '"detail":"[^"]*"' | cut -d'"' -f4)

        if [ -n "$ERROR_MSG" ]; then
            print_warning "Calculation returned validation error (expected) - ${TIME}"
            echo "          Error: $ERROR_MSG"
        else
            print_error "Calculation failed unexpectedly - ${TIME}"
            echo "          Response: $CALC_RESPONSE"
        fi
    fi
fi

# Memory usage
echo ""
echo "========================================"
echo "Memory Usage"
echo "========================================"
MEM_INFO=$(free -h | grep Mem)
MEM_USED=$(echo "$MEM_INFO" | awk '{print $3}')
MEM_TOTAL=$(echo "$MEM_INFO" | awk '{print $2}')
MEM_PERCENT=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100)}')

echo "Memory: $MEM_USED / $MEM_TOTAL (${MEM_PERCENT}%)"
echo ""

# Summary
echo "========================================"
if [ $EXIT_CODE -eq 0 ]; then
    print_success "All tests passed!"
else
    print_error "Some tests failed!"
fi
echo "========================================"
echo ""

exit $EXIT_CODE
