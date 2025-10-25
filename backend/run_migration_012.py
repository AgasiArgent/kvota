#!/usr/bin/env python3
"""
Run Migration 012: Export System Foundation

This script executes the migration to create customer_contacts table
and add export-related fields to quotes and organizations tables.
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()


async def check_migration_status():
    """Check if migration has already been applied"""
    # Use POSTGRES_DIRECT_URL for asyncpg (pooler has authentication issues)
    db_url = os.getenv("POSTGRES_DIRECT_URL") or os.getenv("DATABASE_URL")
    conn = await asyncpg.connect(db_url)
    try:
        # Check if customer_contacts table exists
        table_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'customer_contacts'
            );
        """)

        # Check if quotes.delivery_address column exists
        delivery_address_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'quotes'
                AND column_name = 'delivery_address'
            );
        """)

        # Check if organizations.ceo_name column exists
        ceo_name_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'organizations'
                AND column_name = 'ceo_name'
            );
        """)

        return {
            'customer_contacts_table': table_exists,
            'quotes_delivery_address': delivery_address_exists,
            'organizations_ceo_name': ceo_name_exists,
            'fully_applied': table_exists and delivery_address_exists and ceo_name_exists
        }

    finally:
        await conn.close()


async def run_migration():
    """Execute migration 012"""
    print("=" * 80)
    print("Migration 012: Export System Foundation")
    print("=" * 80)

    # Check current status
    print("\n[1/3] Checking migration status...")
    status = await check_migration_status()

    print(f"  - customer_contacts table: {'✓ EXISTS' if status['customer_contacts_table'] else '✗ MISSING'}")
    print(f"  - quotes.delivery_address: {'✓ EXISTS' if status['quotes_delivery_address'] else '✗ MISSING'}")
    print(f"  - organizations.ceo_name: {'✓ EXISTS' if status['organizations_ceo_name'] else '✗ MISSING'}")

    if status['fully_applied']:
        print("\n✓ Migration already applied. Skipping execution.")
        return True

    # Execute migration
    print("\n[2/3] Executing migration...")
    # Use POSTGRES_DIRECT_URL for asyncpg (pooler has authentication issues)
    db_url = os.getenv("POSTGRES_DIRECT_URL") or os.getenv("DATABASE_URL")
    conn = await asyncpg.connect(db_url)

    try:
        # Read migration file
        migration_path = 'migrations/012_export_system.sql'
        with open(migration_path, 'r', encoding='utf-8') as f:
            migration_sql = f.read()

        # Execute migration
        await conn.execute(migration_sql)
        print("  ✓ Migration SQL executed successfully")

    except Exception as e:
        print(f"  ✗ Migration failed: {e}")
        raise

    finally:
        await conn.close()

    # Verify migration
    print("\n[3/3] Verifying migration...")
    status = await check_migration_status()

    if status['fully_applied']:
        print("  ✓ All migration changes verified")
        print("\n" + "=" * 80)
        print("✓ Migration 012 completed successfully!")
        print("=" * 80)
        return True
    else:
        print("  ✗ Migration verification failed")
        print(f"    Status: {status}")
        return False


async def main():
    """Main entry point"""
    try:
        success = await run_migration()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n✗ Migration failed with error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)


if __name__ == "__main__":
    asyncio.run(main())
