#!/usr/bin/env python3
"""
Manual API test for quotes upload endpoints.
Run with: python tests/test_upload_api_manual.py
Requires: backend server running on :8000
"""

import json
import requests
from pathlib import Path


def get_token():
    """Get auth token from Supabase"""
    import os
    from dotenv import load_dotenv
    load_dotenv()

    supabase_url = os.getenv("SUPABASE_URL")
    anon_key = os.getenv("SUPABASE_ANON_KEY")

    response = requests.post(
        f"{supabase_url}/auth/v1/token?grant_type=password",
        headers={
            "apikey": anon_key,
            "Content-Type": "application/json"
        },
        json={
            "email": "andrey@masterbearingsales.ru",
            "password": "password"
        }
    )
    return response.json()["access_token"]


def test_upload_excel():
    """Test POST /api/quotes/upload-excel"""
    print("\n=== Test 1: Upload valid Excel ===")

    token = get_token()
    template_path = Path(__file__).parent.parent.parent / "validation_data" / "template_quote_input_v5.xlsx"

    with open(template_path, 'rb') as f:
        response = requests.post(
            "http://localhost:8000/api/quotes/upload-excel",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("quote.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        )

    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()

    assert data["success"] is True
    assert "quote_input" in data

    qi = data["quote_input"]
    print(f"  Seller: {qi['seller_company']}")
    print(f"  Sale type: {qi['sale_type']}")
    print(f"  Currency: {qi['quote_currency']}")
    print(f"  Products: {len(qi['products'])} items")
    print(f"  Milestones: {len(qi['payment_milestones'])} items")

    # Validate milestones sum to 100%
    total_pct = sum(float(m['percentage']) for m in qi['payment_milestones'])
    assert abs(total_pct - 100) < 0.01, f"Milestones should sum to 100%, got {total_pct}"

    print("  ✅ PASSED")
    return True


def test_parse_excel():
    """Test POST /api/quotes/parse-excel"""
    print("\n=== Test 2: Parse-only endpoint ===")

    token = get_token()
    template_path = Path(__file__).parent.parent.parent / "validation_data" / "template_quote_input_v5.xlsx"

    with open(template_path, 'rb') as f:
        response = requests.post(
            "http://localhost:8000/api/quotes/parse-excel",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("quote.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "parsed_data" in data

    pd = data["parsed_data"]
    print(f"  Has logistics: {'logistics_supplier_hub' in pd}")
    print(f"  Has brokerage: {'brokerage_hub' in pd}")
    print(f"  Has LPR: {'dm_fee_type' in pd}")
    print("  ✅ PASSED")
    return True


def test_invalid_file_type():
    """Test that non-Excel files are rejected"""
    print("\n=== Test 3: Invalid file type ===")

    token = get_token()

    response = requests.post(
        "http://localhost:8000/api/quotes/upload-excel",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("test.txt", b"not an excel file", "text/plain")}
    )

    assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    data = response.json()
    # Error can be in 'detail' or 'message' depending on error handling middleware
    error_msg = data.get("detail") or data.get("message") or ""
    assert "Invalid file type" in error_msg, f"Expected 'Invalid file type' in error, got: {data}"
    print("  ✅ PASSED")
    return True


def test_no_auth():
    """Test that auth is required"""
    print("\n=== Test 4: No auth token ===")

    template_path = Path(__file__).parent.parent.parent / "validation_data" / "template_quote_input_v5.xlsx"

    with open(template_path, 'rb') as f:
        response = requests.post(
            "http://localhost:8000/api/quotes/upload-excel",
            files={"file": ("quote.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        )

    assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
    print(f"  Status: {response.status_code}")
    print("  ✅ PASSED")
    return True


def main():
    print("=" * 50)
    print("Excel Upload API Tests")
    print("=" * 50)

    tests = [
        test_upload_excel,
        test_parse_excel,
        test_invalid_file_type,
        test_no_auth,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"  ❌ FAILED: {e}")
            failed += 1

    print("\n" + "=" * 50)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 50)

    return failed == 0


if __name__ == "__main__":
    import sys
    sys.exit(0 if main() else 1)
