"""
Detailed Database Connection Test
Debug specific connection parameters and SSL settings
"""
import os
import asyncio
from dotenv import load_dotenv
import asyncpg

# Load environment variables
load_dotenv()

async def test_connection_components():
    """Test individual connection components"""
    print("🔍 Testing connection components...")
    
    # Parse the DATABASE_URL
    database_url = os.getenv("DATABASE_URL")
    print(f"   📋 Database URL format: {database_url[:50]}...")
    
    # Extract components manually
    components = {
        'host': 'aws-0-us-east-1.pooler.supabase.com',
        'port': 6543,
        'database': 'postgres',
        'user': 'postgres',
        'password': os.getenv("DATABASE_URL").split(':')[2].split('@')[0] if '@' in database_url else 'unknown'
    }
    
    print(f"   🏠 Host: {components['host']}")
    print(f"   🚪 Port: {components['port']}")
    print(f"   👤 User: {components['user']}")
    print(f"   🔒 Password: {'*' * len(components['password'])}")
    
    return components

async def test_ssl_modes():
    """Test different SSL connection modes"""
    print("\n🔐 Testing SSL connection modes...")
    
    components = await test_connection_components()
    
    # Test different SSL modes
    ssl_modes = ['require', 'disable', 'prefer', 'allow']
    
    for ssl_mode in ssl_modes:
        print(f"\n   Testing SSL mode: {ssl_mode}")
        try:
            conn = await asyncpg.connect(
                host=components['host'],
                port=components['port'],
                database=components['database'],
                user=components['user'],
                password=components['password'],
                ssl=ssl_mode,
                command_timeout=10
            )
            
            # Test basic query
            result = await conn.fetchval("SELECT 1")
            await conn.close()
            
            print(f"   ✅ SSL mode '{ssl_mode}' successful!")
            return ssl_mode
            
        except Exception as e:
            print(f"   ❌ SSL mode '{ssl_mode}' failed: {str(e)}")
            continue
    
    return None

async def test_manual_connection():
    """Test connection with manual parameters"""
    print("\n🔧 Testing manual connection parameters...")
    
    try:
        # Extract password from DATABASE_URL
        database_url = os.getenv("DATABASE_URL")
        # Format: postgresql://user:pass@host:port/db
        password = database_url.split('://')[1].split(':')[1].split('@')[0]
        
        print(f"   Extracted password: {'*' * len(password)}")
        
        # Try with minimal parameters
        conn = await asyncpg.connect(
            host='aws-0-us-east-1.pooler.supabase.com',
            port=6543,
            database='postgres',
            user='postgres',
            password=password,
            ssl='prefer',  # Start with prefer
            command_timeout=30,
            server_settings={'application_name': 'quotation_app_test'}
        )
        
        # Test basic operations
        version = await conn.fetchval("SELECT version()")
        current_user = await conn.fetchval("SELECT current_user")
        current_database = await conn.fetchval("SELECT current_database()")
        
        await conn.close()
        
        print("   ✅ Manual connection successful!")
        print(f"   📊 PostgreSQL: {version.split(',')[0]}")
        print(f"   👤 Connected as: {current_user}")
        print(f"   🗄️  Database: {current_database}")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Manual connection failed: {str(e)}")
        return False

async def test_url_variations():
    """Test different URL format variations"""
    print("\n🔗 Testing URL format variations...")
    
    database_url = os.getenv("DATABASE_URL")
    password = database_url.split('://')[1].split(':')[1].split('@')[0]
    
    url_variations = [
        f"postgresql://postgres:{password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
        f"postgresql://postgres:{password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require",
        f"postgresql://postgres:{password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=prefer",
        f"postgresql://postgres:{password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=disable",
        f"postgres://postgres:{password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
    ]
    
    for i, url in enumerate(url_variations, 1):
        print(f"\n   Testing URL variation {i}:")
        print(f"   {url[:80]}...")
        
        try:
            conn = await asyncpg.connect(url, command_timeout=15)
            result = await conn.fetchval("SELECT 'Connection successful!'")
            await conn.close()
            
            print(f"   ✅ URL variation {i} successful!")
            return url
            
        except Exception as e:
            print(f"   ❌ URL variation {i} failed: {str(e)}")
            continue
    
    return None

async def main():
    """Run comprehensive connection tests"""
    print("🚀 Starting Detailed Database Connection Debug")
    print("=" * 60)
    
    # Test 1: Connection components
    await test_connection_components()
    
    # Test 2: SSL modes
    working_ssl_mode = await test_ssl_modes()
    
    # Test 3: Manual connection
    manual_success = await test_manual_connection()
    
    # Test 4: URL variations
    working_url = await test_url_variations()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 DETAILED CONNECTION TEST SUMMARY")
    print("=" * 60)
    
    if working_ssl_mode:
        print(f"✅ Working SSL mode found: {working_ssl_mode}")
    
    if manual_success:
        print("✅ Manual connection parameters work")
    
    if working_url:
        print("✅ Working URL format found")
        print(f"💡 Recommended DATABASE_URL format:")
        print(f"   {working_url}")
    
    if not any([working_ssl_mode, manual_success, working_url]):
        print("❌ All connection attempts failed")
        print("🔍 Investigate authentication or server configuration")
    else:
        print("\n🎉 Connection issue identified and resolved!")

if __name__ == "__main__":
    asyncio.run(main())