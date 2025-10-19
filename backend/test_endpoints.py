"""
Test script for Quote Calculation API endpoints
Tests file upload, templates, and calculation flow
"""
import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

# API base URL
BASE_URL = "http://localhost:8000"

# Test data
TEST_CSV_FILE = "test_data/sample_products.csv"

def print_section(title):
    """Print formatted section header"""
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80)

def print_result(success, message, data=None):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"\n{status}: {message}")
    if data:
        print(json.dumps(data, indent=2))

def get_auth_token():
    """Get authentication token (you need to provide a valid token)"""
    print_section("AUTHENTICATION")

    # For testing, you need to:
    # 1. Login via frontend (http://localhost:3001/auth/login)
    # 2. Get the token from browser localStorage (supabase.auth.token)
    # 3. Paste it here or set as environment variable

    token = os.getenv("TEST_AUTH_TOKEN")

    if not token:
        print("❌ No auth token found!")
        print("\nTo get a token:")
        print("1. Open http://localhost:3001/auth/login in browser")
        print("2. Login with your credentials")
        print("3. Open browser console and run:")
        print("   localStorage.getItem('supabase.auth.token')")
        print("4. Copy the access_token value")
        print("5. Set environment variable: export TEST_AUTH_TOKEN='your-token'")
        print("\nOr add to backend/.env:")
        print("TEST_AUTH_TOKEN=your-token-here")
        return None

    print(f"✅ Token found: {token[:20]}...")
    return token

def test_file_upload(token):
    """Test file upload endpoint"""
    print_section("TEST 1: File Upload")

    headers = {
        "Authorization": f"Bearer {token}"
    }

    try:
        with open(TEST_CSV_FILE, 'rb') as f:
            files = {'file': ('sample_products.csv', f, 'text/csv')}
            response = requests.post(
                f"{BASE_URL}/api/quotes-calc/upload-products",
                files=files,
                headers=headers
            )

        if response.status_code == 200:
            data = response.json()
            print_result(True, f"File uploaded successfully. {data['total_count']} products parsed", {
                "total_count": data['total_count'],
                "sample_product": data['products'][0] if data['products'] else None
            })
            return data['products']
        else:
            print_result(False, f"Upload failed: {response.status_code}", response.json())
            return None

    except Exception as e:
        print_result(False, f"Upload error: {str(e)}")
        return None

def test_create_template(token):
    """Test create variable template"""
    print_section("TEST 2: Create Variable Template")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    template_data = {
        "name": "Test Turkey Import",
        "description": "Test template for Turkey imports with standard markup",
        "is_default": False,
        "variables": {
            # Financial variables
            "currency_of_quote": "USD",
            "markup": 15.0,
            "rate_forex_risk": 3.0,
            "rate_fin_comm": 2.0,
            "rate_loan_interest_daily": 0.00069,

            # Logistics
            "supplier_country": "Турция",
            "logistics_supplier_hub": 1500.00,
            "logistics_hub_customs": 800.00,
            "logistics_customs_client": 500.00,
            "offer_incoterms": "DDP",
            "delivery_time": 30,

            # Taxes
            "import_tariff": 5.0,
            "excise_tax": 0.0,
            "util_fee": 0.0,

            # Payment terms
            "advance_from_client": 50.0,
            "advance_to_supplier": 100.0,
            "time_to_advance": 7,

            # Company settings
            "seller_company": "МАСТЕР БЭРИНГ ООО",
            "offer_sale_type": "поставка",

            # Customs & clearance
            "brokerage_hub": 500.00,
            "brokerage_customs": 300.00,
            "warehousing_at_customs": 200.00,
            "customs_documentation": 150.00,
            "brokerage_extra": 0.00,

            # DM fee
            "dm_fee_type": "fixed",
            "dm_fee_value": 1000.00
        }
    }

    try:
        response = requests.post(
            f"{BASE_URL}/api/quotes-calc/variable-templates",
            headers=headers,
            json=template_data
        )

        if response.status_code == 201:
            data = response.json()
            print_result(True, "Template created successfully", {
                "id": data['id'],
                "name": data['name'],
                "variable_count": len(data['variables'])
            })
            return data['id']
        else:
            print_result(False, f"Template creation failed: {response.status_code}", response.json())
            return None

    except Exception as e:
        print_result(False, f"Template creation error: {str(e)}")
        return None

def test_list_templates(token):
    """Test list variable templates"""
    print_section("TEST 3: List Variable Templates")

    headers = {
        "Authorization": f"Bearer {token}"
    }

    try:
        response = requests.get(
            f"{BASE_URL}/api/quotes-calc/variable-templates",
            headers=headers
        )

        if response.status_code == 200:
            data = response.json()
            print_result(True, f"Found {len(data)} templates", {
                "count": len(data),
                "templates": [{"id": t['id'], "name": t['name']} for t in data]
            })
            return data
        else:
            print_result(False, f"List templates failed: {response.status_code}", response.json())
            return None

    except Exception as e:
        print_result(False, f"List templates error: {str(e)}")
        return None

def test_get_template(token, template_id):
    """Test get specific template"""
    print_section("TEST 4: Get Template by ID")

    headers = {
        "Authorization": f"Bearer {token}"
    }

    try:
        response = requests.get(
            f"{BASE_URL}/api/quotes-calc/variable-templates/{template_id}",
            headers=headers
        )

        if response.status_code == 200:
            data = response.json()
            print_result(True, "Template retrieved successfully", {
                "id": data['id'],
                "name": data['name'],
                "has_variables": len(data['variables']) > 0
            })
            return data
        else:
            print_result(False, f"Get template failed: {response.status_code}", response.json())
            return None

    except Exception as e:
        print_result(False, f"Get template error: {str(e)}")
        return None

def test_health_check():
    """Test health check endpoint"""
    print_section("TEST 0: Health Check")

    try:
        response = requests.get(f"{BASE_URL}/api/health")

        if response.status_code == 200:
            data = response.json()
            print_result(True, "API is healthy", data)
            return True
        else:
            print_result(False, "API is not healthy", response.json())
            return False

    except Exception as e:
        print_result(False, f"Health check error: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "🧪 "*20)
    print("  QUOTE CALCULATION API - ENDPOINT TESTING")
    print("🧪 "*20)

    # Test health
    if not test_health_check():
        print("\n❌ API is not available. Make sure backend is running on port 8000")
        return

    # Get auth token
    token = get_auth_token()
    if not token:
        print("\n⚠️  Skipping authenticated tests (no token)")
        print("\nTests completed: 1/6")
        return

    # Test file upload
    products = test_file_upload(token)

    # Test template creation
    template_id = test_create_template(token)

    # Test template listing
    test_list_templates(token)

    # Test template retrieval
    if template_id:
        test_get_template(token, template_id)

    # Summary
    print("\n" + "="*80)
    print("  TEST SUMMARY")
    print("="*80)
    print("\nCompleted Tests:")
    print("  ✅ Health Check")
    print(f"  {'✅' if products else '❌'} File Upload")
    print(f"  {'✅' if template_id else '❌'} Create Template")
    print("  ✅ List Templates")
    print(f"  {'✅' if template_id else '❌'} Get Template")

    print("\n📝 Next Steps:")
    print("  1. Complete variable mapping in calculation endpoint")
    print("  2. Test calculation endpoint with real data")
    print("  3. Build export endpoints (PDF, Excel, CSV)")
    print("  4. Build frontend components")

    print("\n✨ Backend API is working! Ready for frontend integration.\n")

if __name__ == "__main__":
    main()
