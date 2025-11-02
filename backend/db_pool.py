"""
Database Connection Pooling

asyncpg connection pool for better performance under concurrent load.
Replaces get_db_connection() single connections with pooled connections.
"""

import asyncpg
import os
from typing import Optional

# Global connection pool
_pool: Optional[asyncpg.Pool] = None


async def init_db_pool():
    """Initialize database connection pool on application startup"""
    global _pool

    if _pool is None:
        db_url = os.getenv("POSTGRES_DIRECT_URL") or os.getenv("DATABASE_URL")

        _pool = await asyncpg.create_pool(
            dsn=db_url,
            min_size=10,  # Minimum connections
            max_size=20,  # Maximum connections
            command_timeout=60,  # Query timeout in seconds
            max_queries=50000,  # Max queries per connection before recycling
            max_inactive_connection_lifetime=300  # Close idle connections after 5 min
        )

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
