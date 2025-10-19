"""
Supabase Connection Test
Tests both Supabase client and direct database connections
"""
import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client
import asyncpg

# Load environment variables
load_dotenv()

def test_environment_variables():
    """Test that all required environment variables are loaded"""
    print("🔧 Testing environment variables...")
    
    required_vars = [
        'SUPABASE_URL', 
        'SUPABASE_ANON_KEY', 
        'SUPABASE_SERVICE_ROLE_KEY',
        'DATABASE_URL',
        'SECRET_KEY'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
        else:
            print(f"   ✅ {var}: {'*' * 20}... (loaded)")
    
    if missing_vars:
        print(f"   ❌ Missing variables: {missing_vars}")
        return False
    
    print("   ✅ All environment variables loaded successfully!")
    return True

def test_supabase_client():
    """Test Supabase client connection"""
    print("\n🌐 Testing Supabase client connection...")
    
    try:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        
        if not url or not key:
            print("   ❌ Missing Supabase URL or key")
            return False
            
        # Create client
        supabase: Client = create_client(url, key)
        
        # Test basic connection by trying to get current user (will be None, but tests connection)
        response = supabase.auth.get_user()
        
        print("   ✅ Supabase client created successfully!")
        print(f"   📍 Connected to: {url}")
        return True
        
    except Exception as e:
        print(f"   ❌ Supabase client connection failed: {str(e)}")
        return False

async def test_database_connection():
    """Test direct database connection using asyncpg"""
    print("\n🗄️  Testing direct database connection...")
    
    try:
        database_url = os.getenv("DATABASE_URL")
        
        if not database_url:
            print("   ❌ Missing DATABASE_URL")
            return False
            
        # Test connection
        conn = await asyncpg.connect(database_url)
        
        # Test basic query
        result = await conn.fetchval("SELECT version()")
        
        await conn.close()
        
        print("   ✅ Database connection successful!")
        print(f"   🐘 PostgreSQL version: {result.split(',')[0]}")
        return True
        
    except Exception as e:
        print(f"   ❌ Database connection failed: {str(e)}")
        return False

async def main():
    """Run all connection tests"""
    print("🚀 Starting Supabase Connection Tests")
    print("=" * 50)
    
    # Test 1: Environment variables
    env_ok = test_environment_variables()
    
    if not env_ok:
        print("\n❌ Environment setup failed. Please check your .env file.")
        return
    
    # Test 2: Supabase client
    client_ok = test_supabase_client()
    
    # Test 3: Database connection
    db_ok = await test_database_connection()
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 CONNECTION TEST SUMMARY")
    print("=" * 50)
    
    print(f"Environment Variables: {'✅ PASS' if env_ok else '❌ FAIL'}")
    print(f"Supabase Client:      {'✅ PASS' if client_ok else '❌ FAIL'}")
    print(f"Database Connection:  {'✅ PASS' if db_ok else '❌ FAIL'}")
    
    if env_ok and client_ok and db_ok:
        print("\n🎉 ALL TESTS PASSED! Supabase is ready to use.")
        print("✨ You can now proceed to database schema setup.")
    else:
        print("\n⚠️  Some tests failed. Please check your configuration.")

if __name__ == "__main__":
    asyncio.run(main())