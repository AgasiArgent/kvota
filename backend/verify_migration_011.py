#!/usr/bin/env python3
"""
Verification script for Migration 011: Soft Delete & Quote Dates

Run this after executing the migration to verify all changes were applied correctly.

Usage:
    cd /home/novi/quotation-app/backend
    source venv/bin/activate
    python verify_migration_011.py
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

def main():
    print("=" * 80)
    print("Migration 011 Verification Script")
    print("=" * 80)
    print()

    # Initialize Supabase client
    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    all_passed = True

    # Test 1: Check columns exist
    print("✓ Test 1: Checking if new columns exist...")
    try:
        result = supabase.rpc("exec_sql", {
            "sql": """
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = 'quotes'
                AND column_name IN ('quote_date', 'deleted_at', 'valid_until')
                ORDER BY column_name;
            """
        }).execute()

        columns = {row['column_name']: row for row in result.data}

        # Check quote_date
        if 'quote_date' in columns:
            col = columns['quote_date']
            if col['data_type'] == 'date' and col['is_nullable'] == 'NO':
                print("  ✓ quote_date column exists (DATE, NOT NULL)")
            else:
                print(f"  ✗ quote_date has wrong spec: {col}")
                all_passed = False
        else:
            print("  ✗ quote_date column missing")
            all_passed = False

        # Check deleted_at
        if 'deleted_at' in columns:
            col = columns['deleted_at']
            if 'timestamp' in col['data_type'] and col['is_nullable'] == 'YES':
                print("  ✓ deleted_at column exists (TIMESTAMP, NULLABLE)")
            else:
                print(f"  ✗ deleted_at has wrong spec: {col}")
                all_passed = False
        else:
            print("  ✗ deleted_at column missing")
            all_passed = False

        # Check valid_until
        if 'valid_until' in columns:
            col = columns['valid_until']
            if col['data_type'] == 'date' and col['is_nullable'] == 'NO':
                print("  ✓ valid_until is NOT NULL")
            else:
                print(f"  ✗ valid_until has wrong spec: {col}")
                all_passed = False
        else:
            print("  ✗ valid_until column missing")
            all_passed = False

    except Exception as e:
        print(f"  ✗ Error checking columns: {e}")
        all_passed = False

    print()

    # Test 2: Check existing quotes have dates populated
    print("✓ Test 2: Checking if existing quotes have dates populated...")
    try:
        # Use table() API since we can't use raw SQL easily
        result = supabase.table("quotes").select("id, quote_number, quote_date, valid_until, created_at, deleted_at").execute()

        quotes = result.data
        print(f"  Found {len(quotes)} quotes")

        null_quote_date = [q for q in quotes if q.get('quote_date') is None]
        null_valid_until = [q for q in quotes if q.get('valid_until') is None]
        non_null_deleted_at = [q for q in quotes if q.get('deleted_at') is not None]

        if len(null_quote_date) == 0:
            print(f"  ✓ All {len(quotes)} quotes have quote_date populated")
        else:
            print(f"  ✗ {len(null_quote_date)} quotes have NULL quote_date")
            all_passed = False

        if len(null_valid_until) == 0:
            print(f"  ✓ All {len(quotes)} quotes have valid_until populated")
        else:
            print(f"  ✗ {len(null_valid_until)} quotes have NULL valid_until")
            all_passed = False

        if len(non_null_deleted_at) == 0:
            print(f"  ✓ All {len(quotes)} quotes have deleted_at = NULL (active)")
        else:
            print(f"  ⚠ {len(non_null_deleted_at)} quotes are soft-deleted")

    except Exception as e:
        print(f"  ✗ Error checking quotes: {e}")
        all_passed = False

    print()

    # Test 3: Check indexes
    print("✓ Test 3: Checking if indexes were created...")
    try:
        # Note: This requires a custom SQL function or direct PostgreSQL query
        # For now, we'll skip this test in the Python version
        print("  ⚠ Skipping index check (requires direct SQL access)")
        print("  → Run verification SQL manually via Supabase SQL Editor")

    except Exception as e:
        print(f"  ✗ Error checking indexes: {e}")

    print()

    # Test 4: Sample quote dates
    print("✓ Test 4: Showing sample quote dates...")
    try:
        result = supabase.table("quotes").select(
            "quote_number, quote_date, valid_until, created_at, deleted_at"
        ).limit(5).execute()

        if result.data:
            print("  Sample quotes:")
            for q in result.data:
                print(f"    {q['quote_number']}: "
                      f"quote_date={q['quote_date']}, "
                      f"valid_until={q['valid_until']}, "
                      f"deleted={q['deleted_at'] is not None}")
        else:
            print("  ⚠ No quotes found")

    except Exception as e:
        print(f"  ✗ Error fetching sample quotes: {e}")

    print()
    print("=" * 80)

    if all_passed:
        print("✓ ALL TESTS PASSED - Migration 011 verified successfully!")
        print()
        print("Next steps:")
        print("1. Update MIGRATIONS.md to mark migration as ✅ Done")
        print("2. Update backend code to use soft_delete_quote() function")
        print("3. Schedule cron job for auto-cleanup (see migration file)")
    else:
        print("✗ SOME TESTS FAILED - Review errors above")
        print()
        print("You may need to:")
        print("1. Re-run the migration via Supabase SQL Editor")
        print("2. Check for error messages in Supabase logs")
        print("3. Verify DATABASE_URL is correct")

    print("=" * 80)

if __name__ == "__main__":
    main()
