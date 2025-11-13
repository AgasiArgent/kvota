#!/usr/bin/env python3
"""
Verify the asyncpg fix is working
"""
import asyncio
from db_pool import get_db_connection, release_db_connection

async def verify_pool_works():
    print("=" * 60)
    print("VERIFYING ASYNCPG FIX")
    print("=" * 60)

    # Test 1: Basic connection
    print("\n✅ Test 1: Pool can acquire connections")
    conn = await get_db_connection()
    result = await conn.fetchval("SELECT 1")
    print(f"   Result: {result}")
    await release_db_connection(conn)

    # Test 2: Multiple connections
    print("\n✅ Test 2: Multiple concurrent connections")
    connections = []
    for i in range(3):
        conn = await get_db_connection()
        connections.append(conn)
        print(f"   Connection {i+1} acquired")

    for conn in connections:
        await release_db_connection(conn)
    print("   All connections released")

    # Test 3: Complex query
    print("\n✅ Test 3: Complex query execution")
    conn = await get_db_connection()
    result = await conn.fetchrow("""
        SELECT 
            COUNT(*) as count,
            current_timestamp as timestamp,
            version() as version
    """)
    print(f"   Count: {result['count']}")
    print(f"   Timestamp: {result['timestamp']}")
    print(f"   Version: {result['version'][:50]}...")
    await release_db_connection(conn)

    print("\n" + "=" * 60)
    print("✅ ALL TESTS PASSED - ASYNCPG IS WORKING!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(verify_pool_works())
