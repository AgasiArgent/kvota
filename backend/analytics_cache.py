"""
Analytics Caching Module

Redis-based caching for frequently-run reports (10-minute TTL).
"""

import redis
import hashlib
import json
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Redis client (singleton)
# Can be overridden for testing
_redis_client = None


def get_redis_client():
    """Get Redis client (allows override for testing)"""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis(
            host='localhost',
            port=6379,
            decode_responses=True,
            db=0
        )
    return _redis_client


def set_redis_client(client):
    """Override Redis client (for testing)"""
    global _redis_client
    _redis_client = client


def get_cache_key(org_id: str, filters: Dict, fields: list, aggregations: Optional[Dict] = None) -> str:
    """
    Generate cache key from query parameters.

    Same inputs → same key (for cache hits).
    """
    key_data = {
        'org': org_id,
        'filters': filters,
        'fields': sorted(fields),
        'aggs': aggregations
    }
    key_str = json.dumps(key_data, sort_keys=True)
    key_hash = hashlib.md5(key_str.encode()).hexdigest()
    return f"report:{org_id}:{key_hash}"


async def get_cached_report(cache_key: str) -> Optional[Dict[str, Any]]:
    """
    Get cached report (TTL: 10 minutes).

    Returns None if not found or on error.
    """
    try:
        client = get_redis_client()
        cached = client.get(cache_key)
        return json.loads(cached) if cached else None
    except Exception as e:
        # Cache errors should not break queries
        logger.warning(f"Cache get error: {e}")
        return None


async def cache_report(cache_key: str, data: Dict[str, Any]) -> None:
    """
    Cache report for 10 minutes.

    Errors are logged but do not raise exceptions.
    """
    try:
        client = get_redis_client()
        client.setex(
            cache_key,
            600,  # 10 minutes
            json.dumps(data, default=str)
        )
    except Exception as e:
        # Cache errors should not break queries
        logger.warning(f"Cache set error: {e}")


async def invalidate_report_cache(org_id: str, report_id: Optional[str] = None) -> None:
    """
    Invalidate cached reports.

    If report_id provided: invalidate all caches for that report
    If not provided: clear all org reports
    """
    try:
        client = get_redis_client()
        pattern = f"report:{org_id}:*"
        keys = client.keys(pattern)
        if keys:
            client.delete(*keys)
    except Exception as e:
        logger.warning(f"Cache invalidation error: {e}")
