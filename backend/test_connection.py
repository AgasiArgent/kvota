#!/usr/bin/env python3
"""
Test database connection - diagnose asyncpg hanging issue
"""
import asyncio
import asyncpg
import os
import sys
from dotenv import load_dotenv
import time
import socket

# Load environment variables
load_dotenv()

async def test_connection():
    """Test different connection methods"""

    print("=" * 60)
    print("DATABASE CONNECTION DIAGNOSTICS")
    print("=" * 60)

    # Get URLs
    pooler_url = os.getenv("DATABASE_URL")
    direct_url = os.getenv("POSTGRES_DIRECT_URL")

    print("\n🔍 Environment Variables:")
    print(f"  DATABASE_URL (pooler): {pooler_url[:50] if pooler_url else 'NOT SET'}...")
    print(f"  POSTGRES_DIRECT_URL: {direct_url[:50] if direct_url else 'NOT SET'}...")

    # Test 1: Direct connection WITHOUT pool
    print("\n" + "=" * 60)
    print("TEST 1: Direct connection (no pool)")
    print("=" * 60)

    if direct_url:
        start = time.time()
        try:
            print(f"⏳ Connecting to direct URL (5-second timeout)...")
            conn = await asyncio.wait_for(
                asyncpg.connect(direct_url),
                timeout=5.0
            )
            elapsed = time.time() - start
            print(f"✅ SUCCESS: Connected in {elapsed:.2f} seconds")

            # Test query
            version = await conn.fetchval("SELECT version()")
            print(f"  PostgreSQL version: {version[:50]}...")

            await conn.close()
            print("  Connection closed")

        except asyncio.TimeoutError:
            elapsed = time.time() - start
            print(f"❌ TIMEOUT: Connection attempt timed out after {elapsed:.2f} seconds")
            print("  This means asyncpg cannot establish connection to Supabase")

        except Exception as e:
            elapsed = time.time() - start
            print(f"❌ ERROR after {elapsed:.2f} seconds: {type(e).__name__}: {e}")
    else:
        print("⚠️  POSTGRES_DIRECT_URL not configured")

    # Test 2: Pooler with statement_cache_size=0
    print("\n" + "=" * 60)
    print("TEST 2: Pooler with statement_cache_size=0")
    print("=" * 60)

    if pooler_url:
        start = time.time()
        try:
            print(f"⏳ Connecting with statement_cache_size=0 (5-second timeout)...")
            conn = await asyncio.wait_for(
                asyncpg.connect(pooler_url, statement_cache_size=0),
                timeout=5.0
            )
            elapsed = time.time() - start
            print(f"✅ SUCCESS: Connected in {elapsed:.2f} seconds")

            # Test query
            version = await conn.fetchval("SELECT version()")
            print(f"  PostgreSQL version: {version[:50]}...")

            await conn.close()
            print("  Connection closed")

        except asyncio.TimeoutError:
            elapsed = time.time() - start
            print(f"❌ TIMEOUT: Connection attempt timed out after {elapsed:.2f} seconds")

        except Exception as e:
            elapsed = time.time() - start
            print(f"❌ ERROR after {elapsed:.2f} seconds: {type(e).__name__}: {e}")

if __name__ == "__main__":
    asyncio.run(test_connection())
