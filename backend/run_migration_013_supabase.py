#!/usr/bin/env python3
"""Run migration 013 using Supabase client"""
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

def run_migration():
    # Create Supabase client
    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    # Read migration SQL
    with open('migrations/013_add_last_name_to_contacts.sql', 'r') as f:
        migration_sql = f.read()

    print("Running migration 013 via Supabase RPC...")

    # Execute raw SQL via Supabase
    try:
        # For DDL operations, we need to use the REST API's rpc functionality
        # Let's split into individual statements
        statements = [
            "ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS last_name TEXT",
            "COMMENT ON COLUMN customer_contacts.last_name IS 'Contact last name/surname'"
        ]

        for stmt in statements:
            print(f"Executing: {stmt[:60]}...")
            result = supabase.rpc('exec_sql', {'sql': stmt}).execute()
            print("✅ Success")

        print("✅ Migration 013 completed successfully!")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        print("\nNote: If RPC 'exec_sql' doesn't exist, run this SQL manually in Supabase SQL Editor:")
        print(migration_sql)
        raise

if __name__ == "__main__":
    run_migration()
