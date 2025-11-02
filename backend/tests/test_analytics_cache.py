import pytest
from analytics_cache import get_cache_key, get_cached_report, cache_report, invalidate_report_cache, set_redis_client
import json


@pytest.fixture
def redis_client():
    """Fixture to get Redis client for testing"""
    import redis
    client = redis.Redis(host='localhost', port=6379, db=15, decode_responses=True)
    # Use db=15 for tests (separate from production)
    set_redis_client(client)  # Override global client for tests
    yield client
    # Cleanup after test
    client.flushdb()
    set_redis_client(None)  # Reset to default


def test_get_cache_key_generates_consistent_keys(redis_client):
    """Test that same inputs generate same cache key"""
    key1 = get_cache_key('org1', {'status': 'approved'}, ['quote_number', 'total_amount'])
    key2 = get_cache_key('org1', {'status': 'approved'}, ['quote_number', 'total_amount'])
    assert key1 == key2


def test_get_cache_key_generates_different_keys_for_different_inputs(redis_client):
    """Test that different inputs generate different cache keys"""
    key1 = get_cache_key('org1', {'status': 'approved'}, ['quote_number'])
    key2 = get_cache_key('org1', {'status': 'rejected'}, ['quote_number'])
    assert key1 != key2


@pytest.mark.asyncio
async def test_cache_report_stores_data(redis_client):
    """Test that cache_report stores data correctly"""
    cache_key = 'test:report:123'
    data = {'rows': [{'id': 1, 'name': 'test'}], 'count': 1}

    await cache_report(cache_key, data)

    # Verify stored
    cached = redis_client.get(cache_key)
    assert cached is not None
    assert json.loads(cached) == data


@pytest.mark.asyncio
async def test_get_cached_report_returns_stored_data(redis_client):
    """Test that get_cached_report retrieves stored data"""
    cache_key = 'test:report:456'
    data = {'rows': [{'id': 2, 'name': 'test2'}], 'count': 1}

    # Store directly
    redis_client.setex(cache_key, 600, json.dumps(data))

    # Retrieve via function
    result = await get_cached_report(cache_key)
    assert result == data


@pytest.mark.asyncio
async def test_get_cached_report_returns_none_for_missing_key(redis_client):
    """Test that get_cached_report returns None for missing key"""
    result = await get_cached_report('test:nonexistent')
    assert result is None


@pytest.mark.asyncio
async def test_invalidate_report_cache_deletes_org_cache(redis_client):
    """Test that invalidate_report_cache deletes all org caches"""
    # Store some keys
    redis_client.setex('report:org1:key1', 600, 'data1')
    redis_client.setex('report:org1:key2', 600, 'data2')
    redis_client.setex('report:org2:key3', 600, 'data3')

    # Invalidate org1
    await invalidate_report_cache('org1')

    # Verify org1 keys deleted, org2 keys remain
    assert redis_client.get('report:org1:key1') is None
    assert redis_client.get('report:org1:key2') is None
    assert redis_client.get('report:org2:key3') == 'data3'
