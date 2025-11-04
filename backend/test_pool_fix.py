#!/usr/bin/env python3
"""
Test the actual fix for db_pool.py
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv
import time

load_dotenv()

async def test_pool_configurations():
    print("=" * 60)
    print("TESTING POOL CONFIGURATIONS")
    print("=" * 60)

    direct_url = os.getenv("POSTGRES_DIRECT_URL")

    # Test 1: Pool with min_size=10 (current config - likely hangs)
    print("\n1. Testing with min_size=10 (current config):")
    try:
        start = time.time()
        print("   Creating pool...")
        pool = await asyncio.wait_for(
            asyncpg.create_pool(
                direct_url,
                min_size=10,  # This is the problem!
                max_size=20,
                command_timeout=60
            ),
            timeout=3.0
        )
        elapsed = time.time() - start
        print(f"   ✅ Pool created in {elapsed:.2f}s")
        await pool.close()
    except asyncio.TimeoutError:
        elapsed = time.time() - start
        print(f"   ❌ TIMEOUT after {elapsed:.2f}s - This is the issue!")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")

    # Test 2: Pool with min_size=0 (lazy initialization)
    print("\n2. Testing with min_size=0 (lazy init):")
    try:
        start = time.time()
        print("   Creating pool...")
        pool = await asyncio.wait_for(
            asyncpg.create_pool(
                direct_url,
                min_size=0,  # Don't create connections at startup
                max_size=10,
                command_timeout=60
            ),
            timeout=3.0
        )
        elapsed = time.time() - start
        print(f"   ✅ Pool created in {elapsed:.2f}s")

        # Test acquiring connection
        print("   Acquiring connection...")
        start = time.time()
        async with pool.acquire() as conn:
            elapsed = time.time() - start
            print(f"   ✅ Connection acquired in {elapsed:.2f}s")
            result = await conn.fetchval("SELECT 1")
            print(f"   ✅ Query successful: {result}")

        await pool.close()
    except asyncio.TimeoutError:
        elapsed = time.time() - start
        print(f"   ❌ TIMEOUT after {elapsed:.2f}s")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")

    # Test 3: Pool with min_size=1 (compromise)
    print("\n3. Testing with min_size=1 (single initial connection):")
    try:
        start = time.time()
        print("   Creating pool...")
        pool = await asyncio.wait_for(
            asyncpg.create_pool(
                direct_url,
                min_size=1,
                max_size=10,
                command_timeout=60
            ),
            timeout=3.0
        )
        elapsed = time.time() - start
        print(f"   ✅ Pool created in {elapsed:.2f}s")
        await pool.close()
    except asyncio.TimeoutError:
        elapsed = time.time() - start
        print(f"   ❌ TIMEOUT after {elapsed:.2f}s")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(test_pool_configurations())
