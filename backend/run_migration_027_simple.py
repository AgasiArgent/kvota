#!/usr/bin/env python3
"""
Run migration 027 using Supabase client
"""
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

def run_migration():
    """Run migration 027 using Supabase client"""
    try:
        # Create Supabase client with service role key (bypasses RLS)
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        print("Running migration 027_organization_financial_manager...")
        print("\nNOTE: This migration must be run in the Supabase Dashboard SQL Editor")
        print("because ALTER TABLE operations require direct database access.\n")

        # Read migration file
        with open("migrations/027_organization_financial_manager.sql", "r") as f:
            migration_sql = f.read()

        print("Migration SQL to run in Supabase Dashboard:")
        print("=" * 60)
        print(migration_sql)
        print("=" * 60)

        print("\n✅ Migration script displayed. Please run it in your Supabase Dashboard:")
        print("1. Go to https://supabase.com/dashboard")
        print("2. Select your project")
        print("3. Go to SQL Editor")
        print("4. Paste the SQL above")
        print("5. Click 'Run'")

    except Exception as e:
        print(f"❌ Error: {e}")
        raise

if __name__ == "__main__":
    run_migration()