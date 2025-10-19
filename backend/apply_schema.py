#!/usr/bin/env python3
"""
Script to apply database schema to Supabase
"""
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

try:
    import asyncpg
    import asyncio
except ImportError:
    print("Error: asyncpg not installed. Installing...")
    os.system("pip install asyncpg")
    import asyncpg
    import asyncio

async def apply_schema():
    """Apply the database schema to Supabase"""

    # Read database URL from .env
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres.iuzjearfjuyeidfnslex:VrNX6yDR3RdzgxUF@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
    )

    # Read schema file
    schema_path = Path(__file__).parent / "database_schema.sql"

    if not schema_path.exists():
        print(f"Error: Schema file not found at {schema_path}")
        return False

    with open(schema_path, 'r', encoding='utf-8') as f:
        schema_sql = f.read()

    print(f"📄 Loaded schema file ({len(schema_sql)} characters)")
    print(f"🔗 Connecting to Supabase...")

    try:
        # Connect to database
        conn = await asyncpg.connect(database_url)
        print("✅ Connected successfully!")

        print("\n🚀 Applying database schema...")

        # Execute schema
        await conn.execute(schema_sql)

        print("✅ Schema applied successfully!")

        # Verify tables were created
        print("\n📋 Verifying tables...")
        tables = await conn.fetch("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)

        print(f"\n✅ Created {len(tables)} tables:")
        for table in tables:
            print(f"   - {table['table_name']}")

        # Check for sample data
        print("\n📊 Checking sample data...")
        customer_count = await conn.fetchval("SELECT COUNT(*) FROM customers")
        print(f"   - Customers: {customer_count} records")

        await conn.close()
        print("\n🎉 Database schema setup complete!")
        return True

    except Exception as e:
        print(f"\n❌ Error applying schema: {e}")
        print(f"\nError details: {type(e).__name__}")
        return False

if __name__ == "__main__":
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()

    success = asyncio.run(apply_schema())
    sys.exit(0 if success else 1)
