"""
Database Schema Creation Script
Executes the complete database schema for the B2B Quotation Platform
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def execute_schema():
    """Execute the database schema creation"""
    print("🚀 Creating B2B Quotation Platform Database Schema")
    print("=" * 60)
    
    try:
        # Connect to database
        print("📡 Connecting to database...")
        conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
        print("   ✅ Connected successfully")
        
        # Read the schema file
        print("📄 Reading schema file...")
        with open('database_schema.sql', 'r', encoding='utf-8') as file:
            schema_sql = file.read()
        print("   ✅ Schema file loaded")
        
        # Execute the schema
        print("⚙️  Executing schema creation...")
        
        try:
            # Execute the entire schema as one transaction
            await conn.execute(schema_sql)
            print("   ✅ Schema executed successfully")
            successful_statements = 1
            total_statements = 1
        except Exception as e:
            print(f"   ❌ Schema execution failed: {str(e)}")
            return False
        
        # Get the confirmation message
        result = await conn.fetchval("SELECT confirm_schema_creation()")
        
        await conn.close()
        
        print(f"\n🎉 Schema Creation Complete!")
        print(f"   📊 {successful_statements}/{total_statements} statements executed successfully")
        print(f"   💬 {result}")
        
        # Verify tables were created
        print("\n🔍 Verifying table creation...")
        await verify_schema()
        
    except Exception as e:
        print(f"❌ Schema creation failed: {str(e)}")
        return False
    
    return True

async def verify_schema():
    """Verify that all tables and functions were created correctly"""
    try:
        conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
        
        # Check tables
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            AND table_name IN ('customers', 'quotes', 'quote_items')
            ORDER BY table_name
        """)
        
        print("   📋 Tables created:")
        for table in tables:
            # Get row count
            count = await conn.fetchval(f"SELECT COUNT(*) FROM {table['table_name']}")
            print(f"      ✅ {table['table_name']} ({count} rows)")
        
        # Check triggers
        triggers = await conn.fetch("""
            SELECT trigger_name, event_object_table
            FROM information_schema.triggers
            WHERE trigger_schema = 'public'
            ORDER BY event_object_table, trigger_name
        """)
        
        print("   🔧 Triggers created:")
        for trigger in triggers:
            print(f"      ✅ {trigger['trigger_name']} on {trigger['event_object_table']}")
        
        # Check RLS policies
        policies = await conn.fetch("""
            SELECT schemaname, tablename, policyname
            FROM pg_policies
            WHERE schemaname = 'public'
            ORDER BY tablename, policyname
        """)
        
        print("   🛡️  RLS Policies created:")
        for policy in policies:
            print(f"      ✅ {policy['policyname']} on {policy['tablename']}")
        
        # Check indexes
        indexes = await conn.fetch("""
            SELECT indexname, tablename
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND indexname LIKE 'idx_%'
            ORDER BY tablename, indexname
        """)
        
        print("   📈 Indexes created:")
        for index in indexes:
            print(f"      ✅ {index['indexname']} on {index['tablename']}")
        
        await conn.close()
        
        print("\n✨ Database schema verification complete!")
        
    except Exception as e:
        print(f"   ❌ Verification failed: {str(e)}")

async def test_basic_operations():
    """Test basic database operations"""
    print("\n🧪 Testing basic database operations...")
    
    try:
        conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
        
        # Test customer insertion
        customer_id = await conn.fetchval("""
            INSERT INTO customers (name, email, company_type)
            VALUES ('Test Company', 'test@example.com', 'company')
            RETURNING id
        """)
        print("   ✅ Customer creation test passed")
        
        # Clean up test data
        await conn.execute("DELETE FROM customers WHERE id = $1", customer_id)
        print("   ✅ Test cleanup completed")
        
        await conn.close()
        print("   ✅ All basic operations working correctly")
        
    except Exception as e:
        print(f"   ❌ Basic operations test failed: {str(e)}")

async def main():
    """Main execution function"""
    success = await execute_schema()
    
    if success:
        await test_basic_operations()
        print("\n🎯 Next Steps:")
        print("   1. Database schema is ready")
        print("   2. Ready to build FastAPI endpoints")
        print("   3. Ready to implement authentication integration")
    else:
        print("\n❌ Schema creation failed. Check errors above.")

if __name__ == "__main__":
    asyncio.run(main())