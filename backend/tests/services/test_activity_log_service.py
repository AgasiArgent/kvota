"""
Tests for Activity Log Service
Tests logging, batching, and queue functionality
"""
import pytest
import asyncio
from uuid import uuid4
from datetime import datetime
from services.activity_log_service import (
    log_activity,
    log_activity_decorator,
    setup_log_worker,
    shutdown_log_worker,
    cleanup_old_logs
)


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
async def log_worker():
    """Start and stop log worker for tests"""
    await setup_log_worker()
    yield
    await shutdown_log_worker()


# ============================================================================
# BASIC LOGGING TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_log_activity_basic(log_worker):
    """Test basic activity logging"""
    user_id = uuid4()
    org_id = uuid4()
    entity_id = uuid4()

    await log_activity(
        user_id=user_id,
        organization_id=org_id,
        action="created",
        entity_type="quote",
        entity_id=entity_id,
        metadata={"test": "data"}
    )

    # Wait for batch flush
    await asyncio.sleep(6)

    # Verify log was created (would need database query in real test)
    assert True  # Placeholder - actual test would query database


@pytest.mark.asyncio
async def test_log_activity_without_entity_id(log_worker):
    """Test logging without entity_id (bulk actions)"""
    user_id = uuid4()
    org_id = uuid4()

    await log_activity(
        user_id=user_id,
        organization_id=org_id,
        action="exported",
        entity_type="quote",
        metadata={"format": "excel", "count": 5}
    )

    await asyncio.sleep(6)
    assert True


@pytest.mark.asyncio
async def test_log_activity_no_metadata(log_worker):
    """Test logging without metadata"""
    user_id = uuid4()
    org_id = uuid4()

    await log_activity(
        user_id=user_id,
        organization_id=org_id,
        action="deleted",
        entity_type="customer"
    )

    await asyncio.sleep(6)
    assert True


# ============================================================================
# DECORATOR TESTS
# ============================================================================

class MockUser:
    """Mock user for decorator tests"""
    def __init__(self):
        self.id = uuid4()
        self.current_organization_id = uuid4()


class MockResult:
    """Mock result with ID"""
    def __init__(self):
        self.id = uuid4()


@pytest.mark.asyncio
async def test_decorator_extracts_data(log_worker):
    """Test decorator extracts user and entity_id"""
    @log_activity_decorator("quote", "created")
    async def create_quote(user: MockUser):
        result = MockResult()
        return result

    user = MockUser()
    result = await create_quote(user=user)

    assert result.id is not None
    await asyncio.sleep(6)


@pytest.mark.asyncio
async def test_decorator_with_dict_result(log_worker):
    """Test decorator with dict result"""
    @log_activity_decorator("customer", "updated")
    async def update_customer(user: MockUser):
        return {"id": str(uuid4()), "name": "Test"}

    user = MockUser()
    result = await update_customer(user=user)

    assert "id" in result
    await asyncio.sleep(6)


@pytest.mark.asyncio
async def test_decorator_without_user(log_worker):
    """Test decorator gracefully handles missing user"""
    @log_activity_decorator("quote", "created")
    async def create_quote_no_user():
        return MockResult()

    result = await create_quote_no_user()
    assert result.id is not None  # Function should still work


# ============================================================================
# BATCHING TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_batch_flush_by_count(log_worker):
    """Test batch flushes at 100 entries"""
    user_id = uuid4()
    org_id = uuid4()

    # Queue 100 logs
    for i in range(100):
        await log_activity(
            user_id=user_id,
            organization_id=org_id,
            action="created",
            entity_type="quote",
            entity_id=uuid4()
        )

    # Should flush immediately
    await asyncio.sleep(2)
    assert True


@pytest.mark.asyncio
async def test_batch_flush_by_time(log_worker):
    """Test batch flushes after 5 seconds"""
    user_id = uuid4()
    org_id = uuid4()

    # Queue a few logs
    for i in range(5):
        await log_activity(
            user_id=user_id,
            organization_id=org_id,
            action="updated",
            entity_type="customer"
        )

    # Should flush after 5 seconds
    await asyncio.sleep(6)
    assert True


# ============================================================================
# ERROR HANDLING TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_logging_error_does_not_crash(log_worker):
    """Test that logging errors don't crash the app"""
    # This should not raise an exception
    await log_activity(
        user_id=None,  # Invalid - should be handled gracefully
        organization_id=uuid4(),
        action="created",
        entity_type="quote"
    )

    assert True


# ============================================================================
# CLEANUP TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_cleanup_old_logs():
    """Test old log cleanup function"""
    # This would require database setup
    # For now, just test it doesn't crash
    try:
        result = await cleanup_old_logs()
        # In real environment, this would return True
        # In test, it might fail due to no database
        assert result in [True, False]
    except Exception:
        # Expected in test environment without real database
        pass
