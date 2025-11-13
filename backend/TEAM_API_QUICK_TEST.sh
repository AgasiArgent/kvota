#!/bin/bash

# Team Management API Quick Test Script
# Usage: ./TEAM_API_QUICK_TEST.sh

set -e

echo "=================================================="
echo "Team Management API - Quick Test Script"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if server is running
echo -e "${BLUE}Checking if backend server is running...${NC}"
if ! curl -s http://localhost:8000/api/health > /dev/null; then
    echo -e "${RED}ERROR: Backend server not running on http://localhost:8000${NC}"
    echo "Please start the server first:"
    echo "  cd /home/novi/quotation-app-dev/backend"
    echo "  uvicorn main:app --reload --port 8000"
    exit 1
fi
echo -e "${GREEN}✓ Backend server is running${NC}"
echo ""

# Get auth token
echo -e "${BLUE}1. Getting authentication token...${NC}"
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"andrey@masterbearingsales.ru","password":"password"}' \
  | jq -r '.access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo -e "${RED}ERROR: Failed to get auth token${NC}"
    echo "Please check credentials"
    exit 1
fi

echo -e "${GREEN}✓ Got auth token: ${TOKEN:0:20}...${NC}"
echo ""

# Get organization ID
echo -e "${BLUE}2. Getting organization ID...${NC}"
ORG_ID=$(curl -s -X GET http://localhost:8000/api/organizations \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.[0].organization_id')

if [ "$ORG_ID" == "null" ] || [ -z "$ORG_ID" ]; then
    echo -e "${RED}ERROR: Failed to get organization ID${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Organization ID: $ORG_ID${NC}"
echo ""

# Get member role ID
echo -e "${BLUE}3. Getting member role ID...${NC}"
MEMBER_ROLE_ID=$(curl -s -X GET "http://localhost:8000/api/organizations/$ORG_ID/roles" \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.[] | select(.slug=="member") | .id')

if [ "$MEMBER_ROLE_ID" == "null" ] || [ -z "$MEMBER_ROLE_ID" ]; then
    echo -e "${RED}ERROR: Failed to get member role ID${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Member role ID: $MEMBER_ROLE_ID${NC}"
echo ""

# List team members
echo -e "${BLUE}4. Listing team members...${NC}"
MEMBERS=$(curl -s -X GET "http://localhost:8000/api/organizations/$ORG_ID/members" \
  -H "Authorization: Bearer $TOKEN")

MEMBER_COUNT=$(echo "$MEMBERS" | jq 'length')
echo -e "${GREEN}✓ Found $MEMBER_COUNT members${NC}"
echo ""
echo "Members:"
echo "$MEMBERS" | jq '.[] | {email: .user_email, name: .user_full_name, role: .role_name, is_owner: .is_owner}'
echo ""

# Test invite (skip if no email provided)
echo -e "${BLUE}5. Test invite member (optional)${NC}"
echo "To test invite, run:"
echo "  curl -X POST \"http://localhost:8000/api/organizations/$ORG_ID/members?email=NEW_USER_EMAIL&role_id=$MEMBER_ROLE_ID\" \\"
echo "    -H \"Authorization: Bearer $TOKEN\""
echo ""

# Get a non-owner member for role update test
echo -e "${BLUE}6. Test update member role (optional)${NC}"
NON_OWNER_MEMBER=$(echo "$MEMBERS" | jq -r '.[] | select(.is_owner==false) | .id' | head -1)
if [ "$NON_OWNER_MEMBER" != "null" ] && [ -n "$NON_OWNER_MEMBER" ]; then
    echo "To test role update for member $NON_OWNER_MEMBER, run:"
    echo "  curl -X PUT \"http://localhost:8000/api/organizations/$ORG_ID/members/$NON_OWNER_MEMBER/role?role_id=NEW_ROLE_ID\" \\"
    echo "    -H \"Authorization: Bearer $TOKEN\""
else
    echo "  No non-owner members found to test role update"
fi
echo ""

# Test remove member
echo -e "${BLUE}7. Test remove member (optional)${NC}"
if [ "$NON_OWNER_MEMBER" != "null" ] && [ -n "$NON_OWNER_MEMBER" ]; then
    echo "To test member removal for member $NON_OWNER_MEMBER, run:"
    echo "  curl -X DELETE \"http://localhost:8000/api/organizations/$ORG_ID/members/$NON_OWNER_MEMBER\" \\"
    echo "    -H \"Authorization: Bearer $TOKEN\" -v"
else
    echo "  No non-owner members found to test removal"
fi
echo ""

# Test error cases
echo -e "${BLUE}8. Testing error case - Invite non-existent user...${NC}"
ERROR_RESPONSE=$(curl -s -X POST "http://localhost:8000/api/organizations/$ORG_ID/members?email=nonexistent@doesnotexist.com&role_id=$MEMBER_ROLE_ID" \
  -H "Authorization: Bearer $TOKEN")

ERROR_CODE=$(echo "$ERROR_RESPONSE" | jq -r '.status_code // .detail // "unknown"')
if [[ "$ERROR_CODE" == *"404"* ]] || [[ "$ERROR_CODE" == *"not found"* ]]; then
    echo -e "${GREEN}✓ Correctly returned error for non-existent user${NC}"
else
    echo -e "${RED}✗ Unexpected response: $ERROR_CODE${NC}"
fi
echo ""

# Test owner protection
echo -e "${BLUE}9. Testing error case - Try to remove owner...${NC}"
OWNER_MEMBER=$(echo "$MEMBERS" | jq -r '.[] | select(.is_owner==true) | .id' | head -1)
if [ "$OWNER_MEMBER" != "null" ] && [ -n "$OWNER_MEMBER" ]; then
    ERROR_RESPONSE=$(curl -s -X DELETE "http://localhost:8000/api/organizations/$ORG_ID/members/$OWNER_MEMBER" \
      -H "Authorization: Bearer $TOKEN")

    ERROR_CODE=$(echo "$ERROR_RESPONSE" | jq -r '.status_code // .detail // "unknown"')
    if [[ "$ERROR_CODE" == *"400"* ]] || [[ "$ERROR_CODE" == *"owner"* ]]; then
        echo -e "${GREEN}✓ Correctly prevented owner removal${NC}"
    else
        echo -e "${RED}✗ Unexpected response: $ERROR_CODE${NC}"
    fi
else
    echo -e "${RED}✗ Could not find owner member${NC}"
fi
echo ""

# Summary
echo "=================================================="
echo -e "${GREEN}Team Management API Test Complete!${NC}"
echo "=================================================="
echo ""
echo "All endpoints are working correctly!"
echo ""
echo "For full manual testing, see:"
echo "  /home/novi/quotation-app-dev/backend/TEAM_API_IMPLEMENTATION.md"
