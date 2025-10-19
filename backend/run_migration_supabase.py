"""
Script to run database migrations using Supabase client
Usage: python run_migration_supabase.py migrations/007_quotes_calculation_schema.sql
"""
import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

def run_migration(sql_file):
    """Execute a SQL migration file using Supabase client"""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        print("ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found")
        sys.exit(1)

    # Read SQL file
    with open(sql_file, 'r') as f:
        sql = f.read()

    print(f"Executing migration: {sql_file}")
    print(f"Supabase URL: {supabase_url}")

    try:
        # Create Supabase client
        supabase: Client = create_client(supabase_url, supabase_key)
        print("✓ Connected to Supabase")

        # Execute migration using RPC call
        # Note: Supabase client doesn't have direct SQL execution
        # We need to use the REST API directly or execute via psycopg2

        # Alternative: Use postgrest-py directly
        import psycopg2

        # Parse Supabase URL to get PostgreSQL connection string
        # Supabase provides a direct connection string in the dashboard
        # For now, let's inform the user to run it manually

        print("\n" + "="*80)
        print("⚠️  MANUAL MIGRATION REQUIRED")
        print("="*80)
        print("\nPlease execute the following SQL in Supabase SQL Editor:")
        print(f"\n1. Go to: {supabase_url}/project/_/sql")
        print("2. Copy the SQL from: {sql_file}")
        print("3. Paste and execute in SQL Editor")
        print("\nOr provide a direct PostgreSQL connection string in .env:")
        print("POSTGRES_DIRECT_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres")
        print("="*80 + "\n")

        return False

    except Exception as e:
        print(f"✗ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_migration_supabase.py <sql_file>")
        sys.exit(1)

    sql_file = sys.argv[1]

    if not os.path.exists(sql_file):
        print(f"ERROR: File not found: {sql_file}")
        sys.exit(1)

    run_migration(sql_file)
