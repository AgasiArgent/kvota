"""
Tests for Financial Analytics & Reporting API

Tests saved reports CRUD, query execution, aggregations, and exports.
"""

import pytest
import os
import json
from uuid import uuid4, UUID
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import Mock, patch, AsyncMock, MagicMock

from fastapi import HTTPException
from starlette.requests import Request
from starlette.datastructures import Headers
from routes.analytics import (
    router,
    list_saved_reports,
    get_saved_report,
    create_saved_report,
    update_saved_report,
    delete_saved_report,
    execute_analytics_query,
    execute_analytics_aggregation,
    export_analytics_data,
    generate_excel_export,
    generate_csv_export,
)
from models import (
    SavedReportCreate,
    SavedReportUpdate,
    SavedReport,
    AnalyticsQueryRequest,
)
from auth import User


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def mock_user():
    """Mock authenticated admin user"""
    return User(
        id=uuid4(),
        email="admin@test.com",
        full_name="Test Admin",
        current_organization_id=uuid4(),
        current_role="admin",
        current_role_slug="admin",
        is_owner=False,
        role="admin",
        permissions=["analytics:read", "analytics:write"],
        created_at=datetime.utcnow()
    )


@pytest.fixture
def mock_saved_report():
    """Mock saved report data"""
    return {
        "id": str(uuid4()),
        "organization_id": str(uuid4()),
        "created_by": str(uuid4()),
        "name": "Monthly VAT Report",
        "description": "Sum VAT for approved quotes",
        "filters": {"status": ["approved"]},
        "selected_fields": ["quote_number", "import_vat", "total_amount"],
        "aggregations": {"import_vat": {"function": "sum", "label": "Total VAT"}},
        "visibility": "shared",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "deleted_at": None
    }


@pytest.fixture
def mock_supabase_result():
    """Mock Supabase result object"""
    class MockResult:
        def __init__(self, data):
            self.data = data

    return MockResult


# ============================================================================
# TASK 5: SAVED REPORTS CRUD TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_list_saved_reports_success(mock_user, mock_saved_report, mock_supabase_result):
    """Test listing saved reports returns all reports for organization"""
    with patch("routes.analytics.create_client") as mock_client, \
         patch("routes.analytics.check_admin_permissions", new_callable=AsyncMock), \
         patch("routes.analytics.async_supabase_call", new_callable=AsyncMock) as mock_call:

        mock_call.return_value = mock_supabase_result([mock_saved_report])

        result = await list_saved_reports(user=mock_user)

        assert len(result) == 1
        assert result[0].name == "Monthly VAT Report"
        assert result[0].visibility == "shared"


@pytest.mark.asyncio
async def test_list_saved_reports_requires_admin(mock_user):
    """Test that list_saved_reports requires admin permissions"""
    with patch("routes.analytics.check_admin_permissions", new_callable=AsyncMock) as mock_check:
        mock_check.side_effect = HTTPException(status_code=403, detail="Forbidden")

        with pytest.raises(HTTPException) as exc_info:
            await list_saved_reports(user=mock_user)

        assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_get_saved_report_success(mock_user, mock_saved_report, mock_supabase_result):
    """Test getting single saved report by ID"""
    report_id = UUID(mock_saved_report["id"])

    with patch("routes.analytics.create_client") as mock_client, \
         patch("routes.analytics.check_admin_permissions", new_callable=AsyncMock), \
         patch("routes.analytics.async_supabase_call", new_callable=AsyncMock) as mock_call:

        mock_call.return_value = mock_supabase_result([mock_saved_report])

        result = await get_saved_report(report_id=report_id, user=mock_user)

        assert result.id == UUID(mock_saved_report["id"])
        assert result.name == "Monthly VAT Report"


@pytest.mark.asyncio
async def test_get_saved_report_not_found(mock_user, mock_supabase_result):
    """Test getting non-existent saved report returns 404"""
    report_id = uuid4()

    with patch("routes.analytics.create_client") as mock_client, \
         patch("routes.analytics.check_admin_permissions", new_callable=AsyncMock), \
         patch("routes.analytics.async_supabase_call", new_callable=AsyncMock) as mock_call:

        mock_call.return_value = mock_supabase_result([])

        with pytest.raises(HTTPException) as exc_info:
            await get_saved_report(report_id=report_id, user=mock_user)

        assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_create_saved_report_success(mock_user, mock_saved_report, mock_supabase_result):
    """Test creating new saved report"""
    report_data = SavedReportCreate(
        name="Monthly VAT Report",
        description="Sum VAT for approved quotes",
        filters={"status": ["approved"]},
        selected_fields=["quote_number", "import_vat", "total_amount"],
        aggregations={"import_vat": {"function": "sum", "label": "Total VAT"}},
        visibility="shared"
    )

    with patch("routes.analytics.create_client") as mock_client, \
         patch("routes.analytics.check_admin_permissions", new_callable=AsyncMock), \
         patch("routes.analytics.async_supabase_call", new_callable=AsyncMock) as mock_call, \
         patch("routes.analytics.invalidate_report_cache", new_callable=AsyncMock):

        mock_call.return_value = mock_supabase_result([mock_saved_report])

        result = await create_saved_report(report=report_data, user=mock_user)

        assert result.name == "Monthly VAT Report"
        assert result.visibility == "shared"


@pytest.mark.asyncio
async def test_create_saved_report_validates_fields(mock_user):
    """Test that create_saved_report validates fields against whitelist"""
    report_data = SavedReportCreate(
        name="Test Report",
        filters={},
        selected_fields=["invalid_field", "secret_key"],  # Non-whitelisted
        visibility="personal"
    )

    with patch("routes.analytics.check_admin_permissions", new_callable=AsyncMock):
        with pytest.raises(HTTPException) as exc_info:
            await create_saved_report(report=report_data, user=mock_user)

        assert exc_info.value.status_code == 400
        assert "No valid fields provided" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_update_saved_report_success(mock_user, mock_saved_report, mock_supabase_result):
    """Test updating saved report"""
    report_id = UUID(mock_saved_report["id"])
    update_data = SavedReportUpdate(
        name="Updated VAT Report",
        visibility="personal"
    )

    updated_report = mock_saved_report.copy()
    updated_report["name"] = "Updated VAT Report"
    updated_report["visibility"] = "personal"

    with patch("routes.analytics.create_client") as mock_client, \
         patch("routes.analytics.check_admin_permissions", new_callable=AsyncMock), \
         patch("routes.analytics.async_supabase_call", new_callable=AsyncMock) as mock_call, \
         patch("routes.analytics.invalidate_report_cache", new_callable=AsyncMock):

        mock_call.return_value = mock_supabase_result([updated_report])

        result = await update_saved_report(report_id=report_id, report=update_data, user=mock_user)

        assert result.name == "Updated VAT Report"
        assert result.visibility == "personal"


@pytest.mark.asyncio
async def test_update_saved_report_not_found(mock_user, mock_supabase_result):
    """Test updating non-existent saved report returns 404"""
    report_id = uuid4()
    update_data = SavedReportUpdate(name="Updated Report")

    with patch("routes.analytics.create_client") as mock_client, \
         patch("routes.analytics.check_admin_permissions", new_callable=AsyncMock), \
         patch("routes.analytics.async_supabase_call", new_callable=AsyncMock) as mock_call:

        mock_call.return_value = mock_supabase_result([])

        with pytest.raises(HTTPException) as exc_info:
            await update_saved_report(report_id=report_id, report=update_data, user=mock_user)

        assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_delete_saved_report_success(mock_user, mock_saved_report, mock_supabase_result):
    """Test soft deleting saved report"""
    report_id = UUID(mock_saved_report["id"])

    with patch("routes.analytics.create_client") as mock_client, \
         patch("routes.analytics.check_admin_permissions", new_callable=AsyncMock), \
         patch("routes.analytics.async_supabase_call", new_callable=AsyncMock) as mock_call, \
         patch("routes.analytics.invalidate_report_cache", new_callable=AsyncMock):

        mock_call.return_value = mock_supabase_result([mock_saved_report])

        result = await delete_saved_report(report_id=report_id, user=mock_user)

        assert result is None  # 204 No Content


@pytest.mark.asyncio
async def test_delete_saved_report_not_found(mock_user, mock_supabase_result):
    """Test deleting non-existent saved report returns 404"""
    report_id = uuid4()

    with patch("routes.analytics.create_client") as mock_client, \
         patch("routes.analytics.check_admin_permissions", new_callable=AsyncMock), \
         patch("routes.analytics.async_supabase_call", new_callable=AsyncMock) as mock_call:

        mock_call.return_value = mock_supabase_result([])

        with pytest.raises(HTTPException) as exc_info:
            await delete_saved_report(report_id=report_id, user=mock_user)

        assert exc_info.value.status_code == 404


# ============================================================================
# TASK 6: QUERY ENDPOINT TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_execute_analytics_query_cache_hit(mock_user):
    """Test that query returns cached result if available"""
    query_request = AnalyticsQueryRequest(
        filters={"status": "approved"},
        selected_fields=["quote_number", "total_amount"],
        limit=100,
        offset=0
    )

    cached_data = {
        "rows": [{"quote_number": "Q-001", "total_amount": 1000.00}],
        "count": 1,
        "total_count": 1,
        "has_more": False
    }

    # Create a proper Starlette Request mock
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/analytics/query",
        "headers": Headers({"user-agent": "test"}).raw,
        "client": ("127.0.0.1", 12345),
        "scheme": "http",
        "server": ("localhost", 8000),
        "query_string": b"",
    }
    mock_request = Request(scope=scope)

    with patch("routes.analytics.check_admin_permissions", new_callable=AsyncMock), \
         patch("routes.analytics.get_cached_report", new_callable=AsyncMock) as mock_cache:

        mock_cache.return_value = cached_data

        result = await execute_analytics_query(
            request=mock_request,
            query_request=query_request,
            user=mock_user
        )

        assert result.count == 1
        assert result.status == "completed"
        assert "Cached result" in result.message


@pytest.mark.asyncio
async def test_execute_analytics_query_below_threshold(mock_user):
    """Test query execution when below 2,000 quote threshold"""
    query_request = AnalyticsQueryRequest(
        filters={"status": "approved"},
        selected_fields=["quote_number", "total_amount"],
        limit=100,
        offset=0
    )

    mock_rows = [
        {"quote_number": "Q-001", "total_amount": Decimal("1000.00")},
        {"quote_number": "Q-002", "total_amount": Decimal("2000.00")}
    ]

    # Create a proper Starlette Request mock
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/analytics/query",
        "headers": Headers({"user-agent": "test"}).raw,
        "client": ("127.0.0.1", 12345),
        "scheme": "http",
        "server": ("localhost", 8000),
        "query_string": b"",
    }
    mock_request = Request(scope=scope)
    mock_conn = AsyncMock()
    mock_conn.fetchval.return_value = 100  # Total count < 2,000
    mock_conn.fetch.return_value = mock_rows

    with patch("routes.analytics.check_admin_permissions", new_callable=AsyncMock), \
         patch("routes.analytics.get_cached_report", new_callable=AsyncMock, return_value=None), \
         patch("routes.analytics.get_db_connection", new_callable=AsyncMock, return_value=mock_conn), \
         patch("routes.analytics.release_db_connection", new_callable=AsyncMock), \
         patch("routes.analytics.set_rls_context", new_callable=AsyncMock), \
         patch("routes.analytics.cache_report", new_callable=AsyncMock):

        result = await execute_analytics_query(
            request=mock_request,
            query_request=query_request,
            user=mock_user
        )

        assert result.count == 2
        assert result.total_count == 100
        assert result.status == "completed"
        assert result.has_more == True  # offset (0) + count (2) < total (100)


@pytest.mark.asyncio
async def test_execute_analytics_query_above_threshold(mock_user):
    """Test query returns task_id when above 2,000 quote threshold"""
    query_request = AnalyticsQueryRequest(
        filters={"status": "approved"},
        selected_fields=["quote_number", "total_amount"],
        limit=1000,
        offset=0
    )

    # Create a proper Starlette Request mock
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/analytics/query",
        "headers": Headers({"user-agent": "test"}).raw,
        "client": ("127.0.0.1", 12345),
        "scheme": "http",
        "server": ("localhost", 8000),
        "query_string": b"",
    }
    mock_request = Request(scope=scope)
    mock_conn = AsyncMock()
    mock_conn.fetchval.return_value = 5000  # Total count ≥ 2,000

    with patch("routes.analytics.check_admin_permissions", new_callable=AsyncMock), \
         patch("routes.analytics.get_cached_report", new_callable=AsyncMock, return_value=None), \
         patch("routes.analytics.get_db_connection", new_callable=AsyncMock, return_value=mock_conn), \
         patch("routes.analytics.release_db_connection", new_callable=AsyncMock), \
         patch("routes.analytics.set_rls_context", new_callable=AsyncMock):

        result = await execute_analytics_query(
            request=mock_request,
            query_request=query_request,
            user=mock_user
        )

        assert result.count == 0
        assert result.total_count == 5000
        assert result.status == "processing"
        assert result.task_id is not None
        assert "background" in result.message.lower()


# ============================================================================
# TASK 7: AGGREGATE ENDPOINT TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_execute_analytics_aggregation_success(mock_user):
    """Test aggregation query execution"""
    filters = {"status": "approved"}
    aggregations = {
        "total_import_vat": {"function": "sum", "label": "Total VAT"},
        "quote_count": {"function": "count", "label": "Number of Quotes"}
    }

    mock_row = {
        "total_import_vat": Decimal("50000.00"),
        "quote_count": 25
    }

    # Create a proper Starlette Request mock
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/analytics/query",
        "headers": Headers({"user-agent": "test"}).raw,
        "client": ("127.0.0.1", 12345),
        "scheme": "http",
        "server": ("localhost", 8000),
        "query_string": b"",
    }
    mock_request = Request(scope=scope)
    mock_conn = AsyncMock()
    mock_conn.fetchrow.return_value = mock_row

    with patch("routes.analytics.check_admin_permissions", new_callable=AsyncMock), \
         patch("routes.analytics.get_cached_report", new_callable=AsyncMock, return_value=None), \
         patch("routes.analytics.get_db_connection", new_callable=AsyncMock, return_value=mock_conn), \
         patch("routes.analytics.release_db_connection", new_callable=AsyncMock), \
         patch("routes.analytics.set_rls_context", new_callable=AsyncMock), \
         patch("routes.analytics.cache_report", new_callable=AsyncMock):

        result = await execute_analytics_aggregation(
            request=mock_request,
            filters=filters,
            aggregations=aggregations,
            user=mock_user
        )

        assert result.aggregations["quote_count"] == 25
        assert result.execution_time_ms >= 0


@pytest.mark.asyncio
async def test_execute_analytics_aggregation_cache_hit(mock_user):
    """Test aggregation returns cached result if available"""
    filters = {"status": "approved"}
    aggregations = {"quote_count": {"function": "count", "label": "Count"}}

    cached_data = {
        "aggregations": {"quote_count": 100},
        "execution_time_ms": 50
    }

    # Create a proper Starlette Request mock
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/analytics/query",
        "headers": Headers({"user-agent": "test"}).raw,
        "client": ("127.0.0.1", 12345),
        "scheme": "http",
        "server": ("localhost", 8000),
        "query_string": b"",
    }
    mock_request = Request(scope=scope)

    with patch("routes.analytics.check_admin_permissions", new_callable=AsyncMock), \
         patch("routes.analytics.get_cached_report", new_callable=AsyncMock) as mock_cache:

        mock_cache.return_value = cached_data

        result = await execute_analytics_aggregation(
            request=mock_request,
            filters=filters,
            aggregations=aggregations,
            user=mock_user
        )

        assert result.aggregations["quote_count"] == 100
        assert result.execution_time_ms == 50


# ============================================================================
# TASK 8: EXPORT ENDPOINT TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_export_analytics_data_xlsx_success(mock_user):
    """Test Excel export generation"""
    query_request = AnalyticsQueryRequest(
        filters={"status": "approved"},
        selected_fields=["quote_number", "total_amount"],
        limit=100,
        offset=0
    )

    mock_rows = [
        {"quote_number": "Q-001", "total_amount": Decimal("1000.00")},
        {"quote_number": "Q-002", "total_amount": Decimal("2000.00")}
    ]

    # Create a proper Starlette Request mock
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/analytics/query",
        "headers": Headers({"user-agent": "test"}).raw,
        "client": ("127.0.0.1", 12345),
        "scheme": "http",
        "server": ("localhost", 8000),
        "query_string": b"",
    }
    mock_request = Request(scope=scope)

    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = mock_rows

    mock_background_tasks = Mock()

    with patch("routes.analytics.check_admin_permissions", new_callable=AsyncMock), \
         patch("routes.analytics.get_db_connection", new_callable=AsyncMock, return_value=mock_conn), \
         patch("routes.analytics.release_db_connection", new_callable=AsyncMock), \
         patch("routes.analytics.set_rls_context", new_callable=AsyncMock), \
         patch("routes.analytics.generate_excel_export", new_callable=AsyncMock) as mock_excel, \
         patch("routes.analytics.upload_to_storage", new_callable=AsyncMock) as mock_upload, \
         patch("routes.analytics.create_execution_record", new_callable=AsyncMock), \
         patch("os.path.getsize", return_value=5000):

        mock_excel.return_value = "/tmp/test.xlsx"
        mock_upload.return_value = "https://storage.supabase.co/analytics/test.xlsx"

        result = await export_analytics_data(
            request=mock_request,
            background_tasks=mock_background_tasks,
            query_request=query_request,
            export_format="xlsx",
            user=mock_user
        )

        # Check file response
        assert result.path == "/tmp/test.xlsx"


@pytest.mark.asyncio
async def test_export_analytics_data_csv_success(mock_user):
    """Test CSV export generation"""
    query_request = AnalyticsQueryRequest(
        filters={"status": "approved"},
        selected_fields=["quote_number", "total_amount"],
        limit=100,
        offset=0
    )

    mock_rows = [
        {"quote_number": "Q-001", "total_amount": Decimal("1000.00")}
    ]

    # Create a proper Starlette Request mock
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/analytics/query",
        "headers": Headers({"user-agent": "test"}).raw,
        "client": ("127.0.0.1", 12345),
        "scheme": "http",
        "server": ("localhost", 8000),
        "query_string": b"",
    }
    mock_request = Request(scope=scope)

    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = mock_rows

    mock_background_tasks = Mock()

    with patch("routes.analytics.check_admin_permissions", new_callable=AsyncMock), \
         patch("routes.analytics.get_db_connection", new_callable=AsyncMock, return_value=mock_conn), \
         patch("routes.analytics.release_db_connection", new_callable=AsyncMock), \
         patch("routes.analytics.set_rls_context", new_callable=AsyncMock), \
         patch("routes.analytics.generate_csv_export", new_callable=AsyncMock) as mock_csv, \
         patch("routes.analytics.upload_to_storage", new_callable=AsyncMock) as mock_upload, \
         patch("routes.analytics.create_execution_record", new_callable=AsyncMock), \
         patch("os.path.getsize", return_value=2000):

        mock_csv.return_value = "/tmp/test.csv"
        mock_upload.return_value = "https://storage.supabase.co/analytics/test.csv"

        result = await export_analytics_data(
            request=mock_request,
            background_tasks=mock_background_tasks,
            query_request=query_request,
            export_format="csv",
            user=mock_user
        )

        # Check file response
        assert result.path == "/tmp/test.csv"


@pytest.mark.asyncio
async def test_export_analytics_data_invalid_format(mock_user):
    """Test export rejects invalid format"""
    query_request = AnalyticsQueryRequest(
        filters={},
        selected_fields=["quote_number"],
        limit=10,
        offset=0
    )

    # Create a proper Starlette Request mock
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/analytics/query",
        "headers": Headers({"user-agent": "test"}).raw,
        "client": ("127.0.0.1", 12345),
        "scheme": "http",
        "server": ("localhost", 8000),
        "query_string": b"",
    }
    mock_request = Request(scope=scope)
    mock_background_tasks = Mock()

    with patch("routes.analytics.check_admin_permissions", new_callable=AsyncMock):
        with pytest.raises(HTTPException) as exc_info:
            await export_analytics_data(
                request=mock_request,
                background_tasks=mock_background_tasks,
                query_request=query_request,
                export_format="pdf",  # Invalid
                user=mock_user
            )

        assert exc_info.value.status_code == 400
        assert "Invalid export format" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_export_analytics_data_no_data(mock_user):
    """Test export returns 404 when no data found"""
    query_request = AnalyticsQueryRequest(
        filters={"status": "nonexistent"},
        selected_fields=["quote_number"],
        limit=100,
        offset=0
    )

    # Create a proper Starlette Request mock
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/analytics/query",
        "headers": Headers({"user-agent": "test"}).raw,
        "client": ("127.0.0.1", 12345),
        "scheme": "http",
        "server": ("localhost", 8000),
        "query_string": b"",
    }
    mock_request = Request(scope=scope)
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = []  # No data

    mock_background_tasks = Mock()

    with patch("routes.analytics.check_admin_permissions", new_callable=AsyncMock), \
         patch("routes.analytics.get_db_connection", new_callable=AsyncMock, return_value=mock_conn), \
         patch("routes.analytics.release_db_connection", new_callable=AsyncMock), \
         patch("routes.analytics.set_rls_context", new_callable=AsyncMock):

        with pytest.raises(HTTPException) as exc_info:
            await export_analytics_data(
                request=mock_request,
                background_tasks=mock_background_tasks,
                query_request=query_request,
                export_format="xlsx",
                user=mock_user
            )

        assert exc_info.value.status_code == 404
        assert "No data found for export" in str(exc_info.value.detail)


# ============================================================================
# HELPER FUNCTION TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_generate_excel_export():
    """Test Excel file generation"""
    mock_rows = [
        {"quote_number": "Q-001", "total_amount": Decimal("1000.00")},
        {"quote_number": "Q-002", "total_amount": Decimal("2000.00")}
    ]
    selected_fields = ["quote_number", "total_amount"]
    org_id = uuid4()

    file_path = await generate_excel_export(mock_rows, selected_fields, org_id)

    # Check file exists
    assert os.path.exists(file_path)
    assert file_path.endswith(".xlsx")

    # Cleanup
    os.remove(file_path)


@pytest.mark.asyncio
async def test_generate_csv_export():
    """Test CSV file generation"""
    mock_rows = [
        {"quote_number": "Q-001", "total_amount": Decimal("1000.00")},
        {"quote_number": "Q-002", "total_amount": Decimal("2000.00")}
    ]
    selected_fields = ["quote_number", "total_amount"]
    org_id = uuid4()

    file_path = await generate_csv_export(mock_rows, selected_fields, org_id)

    # Check file exists
    assert os.path.exists(file_path)
    assert file_path.endswith(".csv")

    # Read and verify contents
    with open(file_path, 'r') as f:
        content = f.read()
        assert "quote_number" in content
        assert "Q-001" in content
        assert "1000.00" in content

    # Cleanup
    os.remove(file_path)
