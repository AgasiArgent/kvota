#!/usr/bin/env python3
"""
Test CBR API directly to see what currency codes are returned
"""
import httpx
import json

# CBR API endpoint
CBR_API_URL = "https://www.cbr-xml-daily.ru/daily_json.js"

def test_cbr_api():
    """Fetch and analyze CBR API response"""
    print("Fetching CBR API...")

    response = httpx.get(CBR_API_URL)
    response.raise_for_status()
    data = response.json()

    print(f"Response keys: {data.keys()}")
    print(f"\nNumber of currencies: {len(data.get('Valute', {}))}")

    # Check all currency codes
    print("\nCurrency codes and their lengths:")
    valute_data = data.get("Valute", {})

    for currency_code in sorted(valute_data.keys()):
        currency_info = valute_data[currency_code]
        print(f"  {currency_code:5} (len={len(currency_code)}): {currency_info.get('Name', 'N/A')[:40]}")
        if len(currency_code) > 3:
            print(f"    ⚠️ CODE TOO LONG FOR VARCHAR(3)")

    # Check for any codes longer than 3
    long_codes = [code for code in valute_data.keys() if len(code) > 3]
    if long_codes:
        print(f"\n⚠️ Found {len(long_codes)} currency codes longer than 3 characters:")
        for code in long_codes:
            print(f"  - {code}: {valute_data[code].get('Name', 'N/A')}")
    else:
        print("\n✅ All currency codes are 3 characters or less")

if __name__ == "__main__":
    test_cbr_api()