#!/usr/bin/env python3
"""
Script to verify database schema
"""
import asyncio
import asyncpg
from dotenv import load_dotenv
import os

load_dotenv()

async def verify_schema():
    database_url = os.getenv("DATABASE_URL")
    conn = await asyncpg.connect(database_url)

    print("=" * 60)
    print("DATABASE SCHEMA VERIFICATION")
    print("=" * 60)

    # Check tables
    tables = await conn.fetch("""
        SELECT
            table_name,
            (SELECT COUNT(*) FROM information_schema.columns
             WHERE table_name = t.table_name AND table_schema = 'public') as column_count
        FROM information_schema.tables t
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    """)

    print(f"\n📋 TABLES ({len(tables)} total):\n")
    for table in tables:
        count = await conn.fetchval(f"SELECT COUNT(*) FROM {table['table_name']}")
        print(f"   ✅ {table['table_name']:<20} ({table['column_count']} columns, {count} rows)")

    # Check functions
    functions = await conn.fetch("""
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
        ORDER BY routine_name;
    """)

    print(f"\n⚙️  FUNCTIONS ({len(functions)} total):\n")
    for func in functions:
        print(f"   ✅ {func['routine_name']}")

    # Check triggers
    triggers = await conn.fetch("""
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        ORDER BY event_object_table, trigger_name;
    """)

    print(f"\n🔔 TRIGGERS ({len(triggers)} total):\n")
    for trigger in triggers:
        print(f"   ✅ {trigger['trigger_name']:<50} on {trigger['event_object_table']}")

    # Check RLS policies
    policies = await conn.fetch("""
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname;
    """)

    print(f"\n🔒 RLS POLICIES ({len(policies)} total):\n")
    for policy in policies:
        print(f"   ✅ {policy['tablename']:<20} -> {policy['policyname']}")

    # Check indexes
    indexes = await conn.fetch("""
        SELECT tablename, indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND indexname NOT LIKE '%pkey'
        ORDER BY tablename, indexname;
    """)

    print(f"\n📊 INDEXES ({len(indexes)} total):\n")
    for idx in indexes:
        print(f"   ✅ {idx['tablename']:<20} -> {idx['indexname']}")

    # Sample customer data
    customers = await conn.fetch("SELECT id, name, inn, kpp FROM customers LIMIT 3")
    print(f"\n👥 SAMPLE CUSTOMERS:\n")
    for customer in customers:
        print(f"   • {customer['name']:<40} INN: {customer['inn'] or 'N/A':<12} KPP: {customer['kpp'] or 'N/A'}")

    await conn.close()
    print("\n" + "=" * 60)
    print("✅ VERIFICATION COMPLETE")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    asyncio.run(verify_schema())
