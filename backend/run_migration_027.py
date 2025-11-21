#!/usr/bin/env python3
"""
Run migration 027 to add financial approval fields
"""
import os
import asyncio
import asyncpg
from dotenv import load_dotenv

load_dotenv()

async def run_migration():
    """Run migration 027"""
    try:
        # Connect to database
        conn = await asyncpg.connect(os.getenv("DATABASE_URL"))

        print("Running migration 027_organization_financial_manager...")

        # Read migration file
        with open("migrations/027_organization_financial_manager.sql", "r") as f:
            migration_sql = f.read()

        # Execute migration
        await conn.execute(migration_sql)

        print("✅ Migration 027 completed successfully!")

        # Verify columns were added
        result = await conn.fetch("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'organizations'
            AND column_name = 'financial_manager_id'
        """)

        if result:
            print("✅ Verified: financial_manager_id column added to organizations table")

        result = await conn.fetch("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'quotes'
            AND column_name = 'submission_comment'
        """)

        if result:
            print("✅ Verified: submission_comment column added to quotes table")

        await conn.close()

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(run_migration())