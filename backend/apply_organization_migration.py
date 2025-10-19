"""
Apply Organization Migration Script
Applies the 001_multi_tenant_organizations.sql migration to the database
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def apply_migration():
    """Apply the organization migration to the database"""
    print("🚀 Starting organization migration...")

    try:
        # Connect to database
        conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
        print("✅ Connected to database")

        # Read migration file
        migration_path = os.path.join(os.path.dirname(__file__), "migrations", "001_multi_tenant_organizations.sql")
        with open(migration_path, 'r') as f:
            migration_sql = f.read()

        print("📄 Migration file loaded")
        print(f"   Size: {len(migration_sql)} characters")

        # Execute migration
        print("\n🔄 Executing migration...")
        await conn.execute(migration_sql)

        print("\n✅ Migration completed successfully!")
        print("\n📊 Verification:")

        # Verify tables were created
        tables = await conn.fetch("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('organizations', 'roles', 'organization_members', 'organization_invitations', 'user_profiles')
            ORDER BY table_name
        """)

        print(f"\n   Tables created: {len(tables)}/5")
        for table in tables:
            print(f"     ✓ {table['table_name']}")

        # Verify system roles were seeded
        roles = await conn.fetch("SELECT name, slug FROM roles WHERE is_system_role = true ORDER BY name")
        print(f"\n   System roles seeded: {len(roles)}/5")
        for role in roles:
            print(f"     ✓ {role['name']} ({role['slug']})")

        # Check if existing tables were updated
        customers_col = await conn.fetchval("""
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_name = 'customers'
            AND column_name = 'organization_id'
        """)

        quotes_col = await conn.fetchval("""
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_name = 'quotes'
            AND column_name = 'organization_id'
        """)

        print(f"\n   Existing tables updated:")
        print(f"     {'✓' if customers_col else '✗'} customers.organization_id")
        print(f"     {'✓' if quotes_col else '✗'} quotes.organization_id")

        await conn.close()

        print("\n🎉 Organization migration applied successfully!")
        print("\n📝 Next steps:")
        print("   1. Update backend models.py with organization models")
        print("   2. Update auth.py for multi-organization support")
        print("   3. Create organization API routes")
        print("   4. Build frontend organization pages")

    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        print(f"\n📋 Error details: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(apply_migration())
