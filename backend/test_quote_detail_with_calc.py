#!/usr/bin/env python3
"""
Manual test script to verify quote detail endpoint returns calculation results

This script:
1. Gets an authentication token
2. Creates a quote with calculation (via /api/quotes-calc/calculate)
3. Fetches the quote detail (via /api/quotes/{id})
4. Verifies calculation results are included in the response
"""
import requests
import json
import sys
from decimal import Decimal

BASE_URL = "http://localhost:8000"

# Test credentials
TEST_EMAIL = "andrey@masterbearingsales.ru"
TEST_PASSWORD = "password"


def print_section(title):
    """Print a formatted section header"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def get_auth_token():
    """Get authentication token"""
    print_section("Step 1: Authenticating")

    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )

    if response.status_code != 200:
        print(f"❌ Authentication failed: {response.status_code}")
        print(f"Response: {response.text}")
        return None

    data = response.json()
    token = data.get("access_token")

    if token:
        print(f"✅ Authentication successful")
        print(f"Token (first 50 chars): {token[:50]}...")
        return token
    else:
        print(f"❌ No access token in response")
        return None


def create_quote_with_calculation(token):
    """Create a quote with calculation results"""
    print_section("Step 2: Creating Quote with Calculation")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # Sample quote data with one product
    quote_data = {
        "customer_id": "deac939c-e87f-4b69-93df-2c882e407cd5",  # Real customer ID from database
        "title": "Test Quote - Calculation Results Verification",
        "description": "Testing that calculation results are returned in quote detail endpoint",
        "variables": {
            "seller_company": "МАСТЕР БЭРИНГ ООО",
            "currency_of_quote": "RUB",
            "currency_of_base_price": "USD",
            "exchange_rate": 95.0,
            "markup": 15.0,
            "offer_incoterms": "EXW",
            "supplier_country": "Турция"
        },
        "products": [
            {
                "sku": "TEST-CALC-001",
                "brand": "TestBrand",
                "product_name": "Test Product for Calc Verification",
                "base_price_VAT": 1000.00,
                "quantity": 5,
                "weight_in_kg": 10.0
            }
        ]
    }

    response = requests.post(
        f"{BASE_URL}/api/quotes-calc/calculate",
        headers=headers,
        json=quote_data
    )

    if response.status_code == 201:
        data = response.json()
        quote_id = data.get("quote_id")
        quote_number = data.get("quote_number")

        print(f"✅ Quote created successfully")
        print(f"Quote ID: {quote_id}")
        print(f"Quote Number: {quote_number}")
        print(f"Items count: {len(data.get('items', []))}")

        # Show a sample of calculation results
        if data.get("items"):
            first_item = data["items"][0]
            print(f"\nSample calculation results from first item:")
            if isinstance(first_item, dict):
                # Show a few key calculated fields
                print(f"  - COGS: {first_item.get('cogs', 'N/A')}")
                print(f"  - Import Duties: {first_item.get('import_duties', 'N/A')}")
                print(f"  - Total Cost: {first_item.get('total_cost', 'N/A')}")

        return quote_id
    else:
        print(f"❌ Failed to create quote: {response.status_code}")
        print(f"Response: {response.text}")
        return None


def get_quote_detail(token, quote_id):
    """Fetch quote detail and verify calculation results are included"""
    print_section("Step 3: Fetching Quote Detail")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    response = requests.get(
        f"{BASE_URL}/api/quotes/{quote_id}",
        headers=headers
    )

    if response.status_code == 200:
        data = response.json()

        print(f"✅ Quote detail retrieved successfully")
        print(f"Quote ID: {data.get('id')}")
        print(f"Quote Number: {data.get('quote_number')}")
        print(f"Title: {data.get('title')}")
        print(f"Items count: {len(data.get('items', []))}")

        # Check if calculation results are included
        items = data.get("items", [])

        if not items:
            print(f"\n⚠️  No items found in quote")
            return False

        first_item = items[0]
        has_calc_results = "calculation_results" in first_item

        print(f"\n📊 Calculation Results Check:")
        print(f"  - calculation_results field present: {has_calc_results}")

        if has_calc_results:
            calc_results = first_item["calculation_results"]
            print(f"  - calculation_results type: {type(calc_results)}")

            if isinstance(calc_results, dict):
                print(f"  - Number of calculated fields: {len(calc_results)}")
                print(f"\n  Sample calculated fields:")
                # Show first 5 fields
                for i, (key, value) in enumerate(list(calc_results.items())[:5]):
                    print(f"    • {key}: {value}")
                if len(calc_results) > 5:
                    print(f"    ... and {len(calc_results) - 5} more fields")

                print(f"\n✅ SUCCESS: Calculation results are included in quote detail!")
                return True
            else:
                print(f"\n⚠️  Calculation results is not a dictionary")
                return False
        else:
            print(f"\n❌ FAIL: Calculation results are NOT included in quote detail")
            print(f"\nFirst item fields present:")
            for key in first_item.keys():
                print(f"  - {key}")
            return False
    else:
        print(f"❌ Failed to fetch quote detail: {response.status_code}")
        print(f"Response: {response.text}")
        return False


def main():
    """Main test execution"""
    print("\n🧪 Quote Detail with Calculation Results - Integration Test")
    print("="*60)

    # Step 1: Authenticate
    token = get_auth_token()
    if not token:
        print("\n❌ Test failed: Could not authenticate")
        sys.exit(1)

    # Step 2: Create quote with calculation
    quote_id = create_quote_with_calculation(token)
    if not quote_id:
        print("\n❌ Test failed: Could not create quote")
        sys.exit(1)

    # Step 3: Fetch quote detail and verify
    success = get_quote_detail(token, quote_id)

    # Print final result
    print_section("Test Result")
    if success:
        print("✅ ✅ ✅ TEST PASSED ✅ ✅ ✅")
        print("\nQuote detail endpoint successfully returns calculation results!")
        sys.exit(0)
    else:
        print("❌ ❌ ❌ TEST FAILED ❌ ❌ ❌")
        print("\nQuote detail endpoint does NOT return calculation results.")
        sys.exit(1)


if __name__ == "__main__":
    main()
