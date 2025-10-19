#!/usr/bin/env python3
"""
Execute migration 010: Add INN column to organizations table
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

def main():
    # Get environment variables
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in environment")
        return

    print(f"🔗 Connecting to Supabase: {SUPABASE_URL}")

    # Create Supabase client
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # Read migration file
    migration_file = 'migrations/010_add_inn_to_organizations.sql'

    print(f"📄 Reading migration: {migration_file}")
    with open(migration_file, 'r') as f:
        migration_sql = f.read()

    print("🚀 Executing migration...")

    # Execute the SQL - we need to use raw SQL execution
    # Since Supabase doesn't have direct SQL execution via REST API,
    # we'll execute the ALTER TABLE statement

    try:
        # Try to query the table with inn column to see if it exists
        result = supabase.table('organizations').select('id, inn').limit(1).execute()
        print("✅ INN column already exists in organizations table")
    except Exception as e:
        if 'column' in str(e).lower() and 'inn' in str(e).lower():
            print("❌ INN column does not exist")
            print("📋 Please run this SQL in Supabase SQL Editor:")
            print("\nALTER TABLE organizations ADD COLUMN IF NOT EXISTS inn TEXT;")
            print("\nOr run via psql:")
            print("psql <connection_string> -c \"ALTER TABLE organizations ADD COLUMN IF NOT EXISTS inn TEXT;\"")
        else:
            print(f"❌ Error checking column: {e}")

if __name__ == '__main__':
    main()
