#!/usr/bin/env python3
"""
Test batch insert to find the issue
"""
import os
from dotenv import load_dotenv
from supabase import create_client
from datetime import datetime

load_dotenv()

def test_batch():
    supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    # Test records - start with common currencies
    test_records = [
        {
            "from_currency": "USD",
            "to_currency": "RUB",
            "rate": 100.0,
            "source": "cbr",
            "fetched_at": datetime.utcnow().isoformat()
        },
        {
            "from_currency": "EUR",
            "to_currency": "RUB",
            "rate": 105.0,
            "source": "cbr",
            "fetched_at": datetime.utcnow().isoformat()
        },
        {
            "from_currency": "CNY",
            "to_currency": "RUB",
            "rate": 14.0,
            "source": "cbr",
            "fetched_at": datetime.utcnow().isoformat()
        },
        {
            "from_currency": "AUD",  # This was failing
            "to_currency": "RUB",
            "rate": 53.0,
            "source": "cbr",
            "fetched_at": datetime.utcnow().isoformat()
        }
    ]

    print("Testing batch insert...")

    # Try inserting one by one to find the problematic record
    for i, record in enumerate(test_records):
        try:
            print(f"  Inserting {record['from_currency']}/RUB...")
            result = supabase.table("exchange_rates").insert(record).execute()
            print(f"    ✅ Success - ID: {result.data[0]['id']}")
        except Exception as e:
            print(f"    ❌ Failed: {e}")
            break

    # Try batch insert
    print("\nTesting batch insert of all records...")
    try:
        result = supabase.table("exchange_rates").insert(test_records).execute()
        print(f"✅ Batch insert successful - inserted {len(result.data)} records")
    except Exception as e:
        print(f"❌ Batch insert failed: {e}")

    # Cleanup
    print("\nCleaning up test records...")
    try:
        delete_result = supabase.table("exchange_rates")\
            .delete()\
            .eq("source", "cbr")\
            .gte("fetched_at", datetime.utcnow().replace(hour=0, minute=0, second=0).isoformat())\
            .execute()
        print("✅ Cleanup complete")
    except Exception as e:
        print(f"❌ Cleanup failed: {e}")

if __name__ == "__main__":
    test_batch()