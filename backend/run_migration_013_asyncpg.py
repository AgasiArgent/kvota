#!/usr/bin/env python3
"""Run migration 013 using asyncpg"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def run_migration():
    # Connect to database
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"))

    try:
        # Read and execute migration
        with open('migrations/013_add_last_name_to_contacts.sql', 'r') as f:
            migration_sql = f.read()

        print("Running migration 013...")
        await conn.execute(migration_sql)
        print("✅ Migration 013 completed successfully!")
        print("   - Added last_name column to customer_contacts")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run_migration())
