#!/usr/bin/env python3
"""
Quote Item Creation Debug Script - Python Version
B2B Quotation Platform Testing
"""

import requests
import json
import sys
from datetime import datetime
from typing import Optional, Dict, Any

# Configuration
TOKEN = "eyJhbGciOiJIUzI1NiIsImtpZCI6IlJqRGw3alZ3UHJNbklxWTQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2l1emplYXJmanV5ZWlkZm5zbGV4LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJmNzE0ODk0My05YWY0LTQ5MDUtYmIwMy1hMjNkODVmZTBlZDgiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzU4ODAzMzk3LCJpYXQiOjE3NTg3OTk3OTcsImVtYWlsIjoidGVzdHVzZXIyQGV4YW1wbGUuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJkZXBhcnRtZW50IjoiU2FsZXMiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZnVsbF9uYW1lIjoiVGVzdCBVc2VyIDIiLCJyb2xlIjoic2FsZXNfbWFuYWdlciJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzU4Nzk5Nzk3fV0sInNlc3Npb25faWQiOiI0MjcxM2Y2ZS1hNjcyLTRmZmEtOTdjYS1hNTdjNWI5NmY0ZWYiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.***REMOVED***"

API_BASE = "http://localhost:8000/api"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

# Color codes for terminal output
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'

def print_step(step: str, color: str = Colors.YELLOW):
    print(f"{color}{step}{Colors.NC}")

def print_success(message: str):
    print(f"{Colors.GREEN}✅ {message}{Colors.NC}")

def print_error(message: str):
    print(f"{Colors.RED}❌ {message}{Colors.NC}")

def print_info(message: str):
    print(f"{Colors.BLUE}ℹ️  {message}{Colors.NC}")

def make_request(method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
    """Make HTTP request with error handling"""
    url = f"{API_BASE}{endpoint}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=HEADERS)
        elif method.upper() == "POST":
            response = requests.post(url, headers=HEADERS, json=data)
        elif method.upper() == "PUT":
            response = requests.put(url, headers=HEADERS, json=data)
        elif method.upper() == "DELETE":
            response = requests.delete(url, headers=HEADERS)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
            
        return {
            "status_code": response.status_code,
            "data": response.json() if response.content else {},
            "success": response.status_code < 400
        }
    except requests.exceptions.RequestException as e:
        return {
            "status_code": 0,
            "data": {"error": str(e)},
            "success": False
        }
    except json.JSONDecodeError:
        return {
            "status_code": response.status_code,
            "data": {"error": "Invalid JSON response", "raw": response.text},
            "success": response.status_code < 400
        }

def main():
    print_step("=== B2B Quotation Platform - Quote Item Debug ===", Colors.BLUE)
    print_info("User: testuser2@example.com (sales_manager)")
    print_info(f"Token expires at: {datetime.fromtimestamp(1758790194)}")
    print()

    # Step 1: Health check
    print_step("Step 1: Checking API Health")
    health_response = make_request("GET", "/health")
    if health_response["success"]:
        print_success("API is healthy")
        print(json.dumps(health_response["data"], indent=2))
    else:
        print_error(f"API health check failed: {health_response['data']}")
        return False
    print()

    # Step 2: Authentication check
    print_step("Step 2: Verifying Authentication")
    auth_response = make_request("GET", "/auth/me")
    if auth_response["success"]:
        print_success("Authentication successful")
        user_data = auth_response["data"]
        print(f"User: {user_data.get('user', {}).get('email', 'N/A')}")
        print(f"Role: {user_data.get('user', {}).get('role', 'N/A')}")
    else:
        print_error(f"Authentication failed: {auth_response['data']}")
        return False
    print()

    # Step 3: List quotes
    print_step("Step 3: Listing Your Quotes")
    quotes_response = make_request("GET", "/quotes/")
    
    if not quotes_response["success"]:
        print_error(f"Failed to fetch quotes: {quotes_response['data']}")
        return False
    
    quotes_data = quotes_response["data"]
    quotes = quotes_data.get("quotes", [])
    print(f"Found {len(quotes)} quotes")
    
    quote_id = None
    if quotes:
        quote_id = quotes[0]["id"]
        print_success(f"Using existing quote ID: {quote_id}")
    else:
        print_info("No existing quotes found. Creating a new quote...")
        
        # Step 3a: Create new quote
        print_step("Step 3a: Creating New Quote")
        new_quote_data = {
            "title": "Test Quote for Item Debug",
            "customer_name": "Debug Customer",
            "customer_email": "debug@test.com",
            "description": "Quote created for debugging quote items",
            "currency": "RUB",
            "valid_until": "2025-10-25"
        }
        
        create_response = make_request("POST", "/quotes/", new_quote_data)
        if create_response["success"]:
            quote_id = create_response["data"]["quote"]["id"]
            print_success(f"Created new quote ID: {quote_id}")
        else:
            print_error(f"Failed to create quote: {create_response['data']}")
            return False
    print()

    # Step 4: Get quote details
    print_step("Step 4: Getting Quote Details")
    quote_response = make_request("GET", f"/quotes/{quote_id}")
    if quote_response["success"]:
        quote_data = quote_response["data"]["quote"]
        print_success("Quote details retrieved")
        print(f"Status: {quote_data.get('status')}")
        print(f"Items: {len(quote_data.get('items', []))}")
    else:
        print_error(f"Failed to get quote details: {quote_response['data']}")
        return False
    print()

    # Step 5: Create quote item
    print_step("Step 5: Creating Quote Item")
    quote_item_data = {
        "description": "Test Product - Debug Item",
        "product_code": "DEBUG-001",
        "category": "Testing",
        "brand": "Debug Brand",
        "model": "Debug Model v1.0",
        "quantity": 2,
        "unit": "шт",
        "unit_price": 1500.00,
        "unit_cost": 1200.00,
        "vat_rate": 20,
        "country_of_origin": "Russia",
        "manufacturer": "Debug Manufacturing Ltd",
        "lead_time_days": 7,
        "notes": "Created during debugging session"
    }
    
    print("Request Data:")
    print(json.dumps(quote_item_data, indent=2, ensure_ascii=False))
    print()
    
    item_response = make_request("POST", f"/quotes/{quote_id}/items", quote_item_data)
    
    print(f"HTTP Status: {item_response['status_code']}")
    print("Response Body:")
    print(json.dumps(item_response['data'], indent=2, ensure_ascii=False))
    
    if item_response["success"]:
        print_success("Quote item created successfully!")
        item_id = item_response["data"].get("item", {}).get("id")
        if item_id:
            print_success(f"Item ID: {item_id}")
    else:
        print_error(f"Quote item creation failed with status {item_response['status_code']}")
        
        # Detailed error analysis
        error_data = item_response['data']
        if 'detail' in error_data:
            print_error(f"Error detail: {error_data['detail']}")
        
        # Check for common issues
        if item_response['status_code'] == 403:
            print_error("Permission denied - Check RLS policies and user permissions")
        elif item_response['status_code'] == 404:
            print_error("Quote not found - Check quote ID and ownership")
        elif item_response['status_code'] == 422:
            print_error("Validation error - Check request data format")
        elif item_response['status_code'] == 500:
            print_error("Server error - Check database connection and triggers")
            
    print()

    # Step 6: Verify updated quote
    print_step("Step 6: Verifying Updated Quote")
    updated_quote_response = make_request("GET", f"/quotes/{quote_id}")
    if updated_quote_response["success"]:
        updated_quote = updated_quote_response["data"]["quote"]
        items_count = len(updated_quote.get("items", []))
        print_success(f"Quote now has {items_count} items")
        
        if items_count > 0:
            print("Quote Items:")
            for item in updated_quote.get("items", []):
                print(f"  - {item.get('description', 'N/A')} (₽{item.get('unit_price', 0):.2f})")
    else:
        print_error(f"Failed to verify updated quote: {updated_quote_response['data']}")
    print()

    # Debug information
    print_step("=== Debugging Information ===", Colors.BLUE)
    print_info("Token: Valid until " + str(datetime.fromtimestamp(1758790194)))
    print_info("User ID: f7148943-9af4-4905-bb03-a23d85fe0ed8")
    print_info("User Role: sales_manager")
    print_info(f"Quote ID Used: {quote_id}")
    print()

    print_step("Suggested Next Steps:", Colors.YELLOW)
    if not item_response["success"]:
        print("1. Check the FastAPI logs for detailed error messages")
        print("2. Verify database schema and triggers are properly installed")
        print("3. Check RLS policies for quote_items table")
        print("4. Verify quote ownership and permissions")
        print("5. Test database connection and quote_items table access")
    else:
        print("✅ Quote item creation is working correctly!")
    
    return item_response["success"]

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nDebug session interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {str(e)}")
        sys.exit(1)