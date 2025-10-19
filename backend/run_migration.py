"""
Script to run database migrations in Supabase
Usage: python run_migration.py migrations/007_quotes_calculation_schema.sql
"""
import os
import sys
import asyncpg
from dotenv import load_dotenv

load_dotenv()

async def run_migration(sql_file):
    """Execute a SQL migration file"""
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        print("ERROR: DATABASE_URL not found in environment variables")
        sys.exit(1)

    # Read SQL file
    with open(sql_file, 'r') as f:
        sql = f.read()

    print(f"Executing migration: {sql_file}")
    print(f"Database: {database_url.split('@')[1] if '@' in database_url else 'hidden'}")

    try:
        # Connect to database
        conn = await asyncpg.connect(database_url)
        print("✓ Connected to database")

        # Execute migration
        await conn.execute(sql)
        print("✓ Migration executed successfully")

        await conn.close()
        print("✓ Connection closed")

    except Exception as e:
        print(f"✗ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    import asyncio

    if len(sys.argv) < 2:
        print("Usage: python run_migration.py <sql_file>")
        sys.exit(1)

    sql_file = sys.argv[1]

    if not os.path.exists(sql_file):
        print(f"ERROR: File not found: {sql_file}")
        sys.exit(1)

    asyncio.run(run_migration(sql_file))
