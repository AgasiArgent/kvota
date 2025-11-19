#!/usr/bin/env python3
"""
Test exchange_rates table structure and constraints
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

def check_table():
    supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    # Try to insert a test record
    print("Testing insert with 3-char currency codes...")

    test_record = {
        "from_currency": "USD",
        "to_currency": "RUB",
        "rate": 100.0,
        "source": "test",
        "fetched_at": "2025-11-15T12:00:00Z"
    }

    try:
        result = supabase.table("exchange_rates").insert(test_record).execute()
        print("✅ Insert successful")
        print(f"Inserted record ID: {result.data[0]['id']}")

        # Clean up test record
        supabase.table("exchange_rates").delete().eq("id", result.data[0]["id"]).execute()
        print("✅ Test record cleaned up")

    except Exception as e:
        print(f"❌ Insert failed: {e}")

    # Try fetching existing records
    print("\nChecking existing records...")
    try:
        result = supabase.table("exchange_rates")\
            .select("from_currency, to_currency, rate, fetched_at")\
            .limit(5)\
            .execute()

        if result.data:
            print(f"Found {len(result.data)} records:")
            for rec in result.data:
                print(f"  {rec['from_currency']}/{rec['to_currency']}: {rec['rate']} at {rec['fetched_at']}")
        else:
            print("No records found")
    except Exception as e:
        print(f"❌ Select failed: {e}")

if __name__ == "__main__":
    check_table()