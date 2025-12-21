"""
Database Connection Pooling

asyncpg connection pool for better performance under concurrent load.
Replaces get_db_connection() single connections with pooled connections.
"""

import asyncpg
import os
from typing import Optional
from dotenv import load_dotenv

# Ensure environment variables are loaded
load_dotenv()

# Global connection pool
_pool: Optional[asyncpg.Pool] = None


async def init_db_pool():
    """Initialize database connection pool on application startup"""
    global _pool

    if _pool is None:
        # IMPORTANT: Only use DIRECT URL - pooler URL doesn't work with asyncpg
        # The pooler uses username format "postgres.projectid" which asyncpg can't parse
        db_url = os.getenv("POSTGRES_DIRECT_URL")

        if not db_url:
            # Critical error - cannot use pooler URL with asyncpg
            pooler_url = os.getenv("DATABASE_URL")
            if pooler_url and "pooler.supabase.com" in pooler_url:
                raise ValueError(
                    "❌ Cannot use pooler URL with asyncpg! "
                    "The pooler uses 'postgres.projectid' username format which asyncpg cannot parse. "
                    "Please ensure POSTGRES_DIRECT_URL is set in .env file. "
                    "Direct URL format: postgresql://postgres:password@db.projectid.supabase.co:5432/postgres"
                )
            raise ValueError("❌ No database URL configured. Set POSTGRES_DIRECT_URL in .env")

        # Verify it's a direct URL, not pooler
        if "pooler.supabase.com" in db_url:
            raise ValueError(
                "❌ POSTGRES_DIRECT_URL is pointing to pooler, not direct connection! "
                "Use format: postgresql://postgres:password@db.projectid.supabase.co:5432/postgres"
            )

        _pool = await asyncpg.create_pool(
            dsn=db_url,
            min_size=3,   # Pre-warm 3 connections (handles React 18 double-render)
            max_size=10,  # Maximum 10 connections
            command_timeout=60,  # Query timeout in seconds
            max_queries=50000,  # Max queries per connection before recycling
            max_inactive_connection_lifetime=300  # Close idle connections after 5 min
        )
        print(f"✅ Database connection pool initialized ({_pool.get_min_size()}-{_pool.get_max_size()} connections)")

    return _pool


async def close_db_pool():
    """Close database connection pool on application shutdown"""
    global _pool

    if _pool is not None:
        await _pool.close()
        _pool = None


async def get_db_connection() -> asyncpg.Connection:
    """
    Get database connection from pool.

    Replaces direct asyncpg.connect() calls for better performance.
    """
    global _pool

    if _pool is None:
        await init_db_pool()

    return await _pool.acquire()


async def release_db_connection(conn: asyncpg.Connection):
    """Release connection back to pool"""
    global _pool

    if _pool is not None:
        await _pool.release(conn)
