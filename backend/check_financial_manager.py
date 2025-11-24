#!/usr/bin/env python3
"""
Check if organization has financial_manager_id set
"""
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

def check_financial_manager():
    """Check organization financial manager"""
    try:
        # Create Supabase client
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        # Check organizations table
        result = supabase.table("organizations").select("id, name, financial_manager_id").execute()

        print("Organizations and their financial managers:")
        print("-" * 60)
        for org in result.data:
            print(f"Organization: {org['name']}")
            print(f"ID: {org['id']}")
            print(f"Financial Manager ID: {org.get('financial_manager_id', 'NOT SET')}")
            print("-" * 60)

        # Check if quotes table has submission_comment column
        print("\nChecking quotes table structure...")
        # Try to fetch a quote with submission_comment
        result = supabase.table("quotes").select("id, submission_comment").limit(1).execute()
        if result.data:
            print("✅ submission_comment column exists in quotes table")
        else:
            print("✅ quotes table ready (empty or column exists)")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_financial_manager()