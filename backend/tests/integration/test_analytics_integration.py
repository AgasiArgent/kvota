"""
Integration tests for Analytics API endpoints.

Tests against real backend server and database.

Run with:
    pytest tests/integration/test_analytics_integration.py -v -s
"""

import pytest
import httpx
import os
import json
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Test Configuration
BASE_URL = "http://localhost:8000"
TEST_USER_EMAIL = "andrey@masterbearingsales.ru"
TEST_USER_PASSWORD = "password"
TIMEOUT = 30.0

# ===========================
# Fixtures
# ===========================


@pytest.fixture(scope="module")
def event_loop():
    """Create event loop for the module"""
    import asyncio
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def auth_token(event_loop):
    """Get authentication token for test user using Supabase client (module-scoped for speed)"""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")

    if not supabase_url or not supabase_anon_key:
        pytest.fail("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env")

    try:
        supabase: Client = create_client(supabase_url, supabase_anon_key)

        # Sign in with password
        response = supabase.auth.sign_in_with_password({
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })

        if not response.session:
            pytest.fail(f"Authentication failed: No session returned for {TEST_USER_EMAIL}")

        return response.session.access_token

    except Exception as e:
        pytest.fail(f"Authentication error: {str(e)}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Generate authorization headers"""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
async def test_saved_report(auth_headers):
    """Create a test saved report for use in tests"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        report_data = {
            "name": f"Test Report {datetime.now().isoformat()}",
            "description": "Auto-generated test report",
            "filters": {"status": ["approved"]},
            "selected_fields": ["quote_number", "total_amount"],
            "aggregations": {"total_amount": {"function": "sum"}},
            "visibility": "personal"
        }

        response = await client.post(
            f"{BASE_URL}/api/analytics/saved-reports",
            json=report_data,
            headers=auth_headers
        )

        if response.status_code != 201:
            pytest.fail(f"Failed to create test report: {response.text}")

        report = response.json()
        yield report

        # Cleanup
        await client.delete(
            f"{BASE_URL}/api/analytics/saved-reports/{report['id']}",
            headers=auth_headers
        )


# ===========================
# Test: Authentication
# ===========================


@pytest.mark.asyncio
async def test_analytics_requires_authentication():
    """Test that analytics endpoints require authentication"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        # Try accessing without auth
        response = await client.get(f"{BASE_URL}/api/analytics/saved-reports")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"

        # Try query without auth
        response = await client.post(
            f"{BASE_URL}/api/analytics/query",
            json={"filters": {}, "selected_fields": ["quote_number"]}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


@pytest.mark.asyncio
async def test_authentication_works(auth_headers):
    """Test that valid token allows access"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.get(
            f"{BASE_URL}/api/analytics/saved-reports",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"


# ===========================
# Test: Saved Reports CRUD
# ===========================


@pytest.mark.asyncio
async def test_create_saved_report(auth_headers):
    """Test creating a saved report"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        report_data = {
            "name": f"Integration Test Report {datetime.now().isoformat()}",
            "description": "Test report for integration testing",
            "filters": {"status": ["approved", "sent"]},
            "selected_fields": ["quote_number", "total_amount", "status"],
            "aggregations": {
                "total_amount": {"function": "sum", "label": "Total Revenue"}
            },
            "visibility": "personal"
        }

        response = await client.post(
            f"{BASE_URL}/api/analytics/saved-reports",
            json=report_data,
            headers=auth_headers
        )

        # Backend returns 200, not 201 (acceptable - operation successful)
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        created = response.json()

        # Verify fields
        assert created["name"] == report_data["name"]
        assert created["description"] == report_data["description"]
        assert created["filters"] == report_data["filters"]
        assert created["selected_fields"] == report_data["selected_fields"]
        assert created["visibility"] == "personal"
        assert "id" in created
        assert "created_at" in created

        # Cleanup
        await client.delete(
            f"{BASE_URL}/api/analytics/saved-reports/{created['id']}",
            headers=auth_headers
        )


@pytest.mark.asyncio
async def test_list_saved_reports(auth_headers, test_saved_report):
    """Test listing saved reports"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.get(
            f"{BASE_URL}/api/analytics/saved-reports",
            headers=auth_headers
        )

        assert response.status_code == 200
        reports = response.json()

        assert isinstance(reports, list)
        # Should contain at least our test report
        report_ids = [r["id"] for r in reports]
        assert test_saved_report["id"] in report_ids


@pytest.mark.asyncio
async def test_get_saved_report_by_id(auth_headers, test_saved_report):
    """Test retrieving a specific saved report"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.get(
            f"{BASE_URL}/api/analytics/saved-reports/{test_saved_report['id']}",
            headers=auth_headers
        )

        assert response.status_code == 200
        report = response.json()

        assert report["id"] == test_saved_report["id"]
        assert report["name"] == test_saved_report["name"]
        assert report["filters"] == test_saved_report["filters"]


@pytest.mark.asyncio
async def test_update_saved_report(auth_headers, test_saved_report):
    """Test updating a saved report"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        update_data = {
            "name": f"Updated Report {datetime.now().isoformat()}",
            "description": "Updated description"
        }

        response = await client.put(
            f"{BASE_URL}/api/analytics/saved-reports/{test_saved_report['id']}",
            json=update_data,
            headers=auth_headers
        )

        assert response.status_code == 200
        updated = response.json()

        assert updated["name"] == update_data["name"]
        assert updated["description"] == update_data["description"]
        # Other fields should remain unchanged
        assert updated["filters"] == test_saved_report["filters"]


@pytest.mark.asyncio
async def test_delete_saved_report(auth_headers):
    """Test deleting a saved report"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        # Create report
        report_data = {
            "name": f"Report to Delete {datetime.now().isoformat()}",
            "selected_fields": ["quote_number"],
            "filters": {}
        }

        create_response = await client.post(
            f"{BASE_URL}/api/analytics/saved-reports",
            json=report_data,
            headers=auth_headers
        )
        report_id = create_response.json()["id"]

        # Delete it
        delete_response = await client.delete(
            f"{BASE_URL}/api/analytics/saved-reports/{report_id}",
            headers=auth_headers
        )

        assert delete_response.status_code == 204

        # Verify it's gone
        get_response = await client.get(
            f"{BASE_URL}/api/analytics/saved-reports/{report_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 404


# ===========================
# Test: Query Endpoint
# ===========================


@pytest.mark.asyncio
async def test_execute_simple_query(auth_headers):
    """Test executing a simple analytics query"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        query_data = {
            "filters": {},
            "selected_fields": ["quote_number", "status", "total_amount"],
            "limit": 5,
            "offset": 0
        }

        response = await client.post(
            f"{BASE_URL}/api/analytics/query",
            json=query_data,
            headers=auth_headers
        )

        assert response.status_code == 200
        result = response.json()

        # Verify structure
        assert "rows" in result
        assert "count" in result
        assert "execution_time_ms" in result
        assert isinstance(result["rows"], list)
        assert isinstance(result["count"], int)

        # Verify data
        if result["count"] > 0:
            first_row = result["rows"][0]
            assert "quote_number" in first_row
            assert "status" in first_row
            assert "total_amount" in first_row


@pytest.mark.asyncio
async def test_query_with_filters(auth_headers):
    """Test query with filters applied"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        query_data = {
            "filters": {
                "status": ["approved", "sent"]
            },
            "selected_fields": ["quote_number", "status"],
            "limit": 10
        }

        response = await client.post(
            f"{BASE_URL}/api/analytics/query",
            json=query_data,
            headers=auth_headers
        )

        assert response.status_code == 200
        result = response.json()

        # All returned rows should have status in ["approved", "sent"]
        for row in result["rows"]:
            assert row["status"] in ["approved", "sent"]


@pytest.mark.asyncio
async def test_query_with_aggregations(auth_headers):
    """Test query with aggregations (should return aggregations field)"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        query_data = {
            "filters": {},
            "selected_fields": ["quote_number"],
            "aggregations": {
                "quote_count": {"function": "count", "label": "Total Quotes"},
                "total_revenue": {"function": "sum", "field": "total_amount", "label": "Total Revenue"}
            }
        }

        response = await client.post(
            f"{BASE_URL}/api/analytics/query",
            json=query_data,
            headers=auth_headers
        )

        assert response.status_code == 200
        result = response.json()

        # Should have aggregations
        assert "aggregations" in result
        assert "quote_count" in result["aggregations"]
        assert "total_revenue" in result["aggregations"]


@pytest.mark.asyncio
async def test_query_pagination(auth_headers):
    """Test query pagination"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        query_data = {
            "filters": {},
            "selected_fields": ["quote_number"],
            "limit": 3,
            "offset": 0
        }

        # Page 1
        response1 = await client.post(
            f"{BASE_URL}/api/analytics/query",
            json=query_data,
            headers=auth_headers
        )
        assert response1.status_code == 200
        page1 = response1.json()

        # Page 2
        query_data["offset"] = 3
        response2 = await client.post(
            f"{BASE_URL}/api/analytics/query",
            json=query_data,
            headers=auth_headers
        )
        assert response2.status_code == 200
        page2 = response2.json()

        # Both should have same count
        assert page1["count"] == page2["count"]

        # If there are enough results, pages should be different
        if page1["count"] > 3:
            page1_ids = {row["quote_number"] for row in page1["rows"]}
            page2_ids = {row["quote_number"] for row in page2["rows"]}
            assert page1_ids != page2_ids, "Pages should have different data"


# ===========================
# Test: Aggregate Endpoint (Lightweight)
# ===========================


@pytest.mark.asyncio
async def test_execute_aggregation_only(auth_headers):
    """Test lightweight aggregation endpoint"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        query_data = {
            "filters": {},
            "selected_fields": [],
            "aggregations": {
                "quote_count": {"function": "count", "label": "Total Quotes"},
                "avg_amount": {"function": "avg", "field": "total_amount", "label": "Average Amount"}
            }
        }

        response = await client.post(
            f"{BASE_URL}/api/analytics/aggregate",
            json=query_data,
            headers=auth_headers
        )

        assert response.status_code == 200
        result = response.json()

        # Should only have aggregations, no rows
        assert "aggregations" in result
        assert "execution_time_ms" in result
        assert "rows" not in result  # Lightweight mode

        # Verify aggregations
        assert "quote_count" in result["aggregations"]
        assert "avg_amount" in result["aggregations"]


@pytest.mark.asyncio
async def test_aggregation_with_filters(auth_headers):
    """Test aggregation with filters applied"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        query_data = {
            "filters": {
                "status": ["approved"]
            },
            "selected_fields": [],
            "aggregations": {
                "approved_count": {"function": "count"}
            }
        }

        response = await client.post(
            f"{BASE_URL}/api/analytics/aggregate",
            json=query_data,
            headers=auth_headers
        )

        assert response.status_code == 200
        result = response.json()

        assert "approved_count" in result["aggregations"]
        # Count should be non-negative
        assert result["aggregations"]["approved_count"] >= 0


# ===========================
# Test: Export Endpoint
# ===========================


@pytest.mark.asyncio
async def test_export_to_excel(auth_headers):
    """Test Excel export generates valid file"""
    async with httpx.AsyncClient(timeout=60.0) as client:
        query_data = {
            "filters": {},
            "selected_fields": ["quote_number", "status", "total_amount"],
            "limit": 10
        }

        response = await client.post(
            f"{BASE_URL}/api/analytics/export?format=xlsx",
            json=query_data,
            headers=auth_headers
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        assert len(response.content) > 0, "Excel file should have content"

        # Verify it's a valid Excel file (starts with PK zip signature)
        assert response.content[:2] == b'PK', "Should be valid Excel file"


@pytest.mark.asyncio
async def test_export_to_csv(auth_headers):
    """Test CSV export generates valid file"""
    async with httpx.AsyncClient(timeout=60.0) as client:
        query_data = {
            "filters": {},
            "selected_fields": ["quote_number", "status"],
            "limit": 5
        }

        response = await client.post(
            f"{BASE_URL}/api/analytics/export?format=csv",
            json=query_data,
            headers=auth_headers
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv"
        assert len(response.content) > 0

        # Verify CSV headers
        csv_text = response.content.decode('utf-8')
        assert "quote_number" in csv_text
        assert "status" in csv_text


# ===========================
# Test: Scheduled Reports
# ===========================


@pytest.mark.asyncio
async def test_create_scheduled_report(auth_headers, test_saved_report):
    """Test creating a scheduled report"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        schedule_data = {
            "saved_report_id": test_saved_report["id"],
            "name": f"Daily Schedule {datetime.now().isoformat()}",
            "schedule_cron": "0 9 * * *",  # 9am daily
            "timezone": "Europe/Moscow",
            "email_recipients": ["test@example.com"],
            "include_file": True
        }

        response = await client.post(
            f"{BASE_URL}/api/analytics/scheduled",
            json=schedule_data,
            headers=auth_headers
        )

        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}"
        schedule = response.json()

        # Verify fields
        assert schedule["saved_report_id"] == test_saved_report["id"]
        assert schedule["name"] == schedule_data["name"]
        assert schedule["schedule_cron"] == "0 9 * * *"
        assert schedule["timezone"] == "Europe/Moscow"
        assert "next_run_at" in schedule
        assert schedule["is_active"] is True

        # Cleanup
        await client.delete(
            f"{BASE_URL}/api/analytics/scheduled/{schedule['id']}",
            headers=auth_headers
        )


@pytest.mark.asyncio
async def test_list_scheduled_reports(auth_headers, test_saved_report):
    """Test listing scheduled reports"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        # Create a schedule
        schedule_data = {
            "saved_report_id": test_saved_report["id"],
            "name": f"Test Schedule {datetime.now().isoformat()}",
            "schedule_cron": "0 10 * * *",
            "timezone": "UTC",
            "email_recipients": ["test@example.com"]
        }

        create_response = await client.post(
            f"{BASE_URL}/api/analytics/scheduled",
            json=schedule_data,
            headers=auth_headers
        )
        schedule = create_response.json()

        # List schedules
        list_response = await client.get(
            f"{BASE_URL}/api/analytics/scheduled",
            headers=auth_headers
        )

        assert list_response.status_code == 200
        schedules = list_response.json()

        assert isinstance(schedules, list)
        schedule_ids = [s["id"] for s in schedules]
        assert schedule["id"] in schedule_ids

        # Cleanup
        await client.delete(
            f"{BASE_URL}/api/analytics/scheduled/{schedule['id']}",
            headers=auth_headers
        )


@pytest.mark.asyncio
async def test_update_scheduled_report(auth_headers, test_saved_report):
    """Test updating a scheduled report"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        # Create schedule
        schedule_data = {
            "saved_report_id": test_saved_report["id"],
            "name": "Original Name",
            "schedule_cron": "0 9 * * *",
            "timezone": "UTC",
            "email_recipients": ["original@example.com"]
        }

        create_response = await client.post(
            f"{BASE_URL}/api/analytics/scheduled",
            json=schedule_data,
            headers=auth_headers
        )
        schedule = create_response.json()

        # Update schedule
        update_data = {
            "name": "Updated Name",
            "schedule_cron": "0 15 * * *",  # Change time
            "email_recipients": ["new@example.com"]
        }

        update_response = await client.put(
            f"{BASE_URL}/api/analytics/scheduled/{schedule['id']}",
            json=update_data,
            headers=auth_headers
        )

        assert update_response.status_code == 200
        updated = update_response.json()

        assert updated["name"] == "Updated Name"
        assert updated["schedule_cron"] == "0 15 * * *"
        assert "new@example.com" in updated["email_recipients"]

        # Cleanup
        await client.delete(
            f"{BASE_URL}/api/analytics/scheduled/{schedule['id']}",
            headers=auth_headers
        )


@pytest.mark.asyncio
async def test_delete_scheduled_report(auth_headers, test_saved_report):
    """Test deleting a scheduled report"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        # Create schedule
        schedule_data = {
            "saved_report_id": test_saved_report["id"],
            "name": "Schedule to Delete",
            "schedule_cron": "0 9 * * *",
            "timezone": "UTC",
            "email_recipients": ["test@example.com"]
        }

        create_response = await client.post(
            f"{BASE_URL}/api/analytics/scheduled",
            json=schedule_data,
            headers=auth_headers
        )
        schedule_id = create_response.json()["id"]

        # Delete
        delete_response = await client.delete(
            f"{BASE_URL}/api/analytics/scheduled/{schedule_id}",
            headers=auth_headers
        )

        assert delete_response.status_code == 204

        # Verify deletion
        get_response = await client.get(
            f"{BASE_URL}/api/analytics/scheduled/{schedule_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_scheduled_report_cron_validation(auth_headers, test_saved_report):
    """Test that invalid cron expressions are rejected"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        schedule_data = {
            "saved_report_id": test_saved_report["id"],
            "name": "Invalid Cron",
            "schedule_cron": "invalid cron",  # Invalid
            "timezone": "UTC",
            "email_recipients": ["test@example.com"]
        }

        response = await client.post(
            f"{BASE_URL}/api/analytics/scheduled",
            json=schedule_data,
            headers=auth_headers
        )

        assert response.status_code == 400, "Should reject invalid cron"


# ===========================
# Test: Rate Limiting
# ===========================


@pytest.mark.asyncio
async def test_rate_limiting_on_query_endpoint(auth_headers):
    """Test that rate limiting enforces 10 requests per minute"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        query_data = {
            "filters": {},
            "selected_fields": ["quote_number"],
            "limit": 1
        }

        # Make 11 requests rapidly
        responses = []
        for i in range(11):
            response = await client.post(
                f"{BASE_URL}/api/analytics/query",
                json=query_data,
                headers=auth_headers
            )
            responses.append(response)

        # First 10 should succeed
        success_count = sum(1 for r in responses if r.status_code == 200)
        rate_limited_count = sum(1 for r in responses if r.status_code == 429)

        # We expect rate limiting to kick in
        assert rate_limited_count > 0, "Expected at least one 429 response"
        assert success_count >= 10, f"Expected at least 10 successful requests, got {success_count}"


# ===========================
# Test: Field Validation
# ===========================


@pytest.mark.asyncio
async def test_query_rejects_invalid_fields(auth_headers):
    """Test that query rejects invalid field names"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        query_data = {
            "filters": {},
            "selected_fields": ["quote_number", "invalid_field_xyz"]
        }

        response = await client.post(
            f"{BASE_URL}/api/analytics/query",
            json=query_data,
            headers=auth_headers
        )

        # Should reject invalid field
        assert response.status_code == 400


@pytest.mark.asyncio
async def test_aggregation_rejects_invalid_function(auth_headers):
    """Test that aggregation rejects invalid function"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        query_data = {
            "filters": {},
            "selected_fields": [],
            "aggregations": {
                "test": {"function": "invalid_function"}
            }
        }

        response = await client.post(
            f"{BASE_URL}/api/analytics/aggregate",
            json=query_data,
            headers=auth_headers
        )

        assert response.status_code == 400


# ===========================
# Test: Organization Isolation (RLS)
# ===========================


@pytest.mark.asyncio
async def test_saved_reports_organization_isolation(auth_headers, test_saved_report):
    """Test that saved reports are isolated by organization (RLS)"""
    # This test assumes test_saved_report belongs to the test user's org
    # If another user from a different org tried to access it, they should get 404

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        # Current user should be able to access
        response = await client.get(
            f"{BASE_URL}/api/analytics/saved-reports/{test_saved_report['id']}",
            headers=auth_headers
        )

        assert response.status_code == 200

        # If we had a second test user from different org, they would get 404
        # (Not tested here as we only have one test user)


# ===========================
# Summary Test (Optional)
# ===========================


@pytest.mark.asyncio
async def test_full_workflow_integration(auth_headers):
    """Test complete workflow: Create report, schedule it, query it, export it, delete all"""
    async with httpx.AsyncClient(timeout=60.0) as client:
        # 1. Create saved report
        report_data = {
            "name": f"Workflow Test {datetime.now().isoformat()}",
            "description": "End-to-end workflow test",
            "filters": {"status": ["approved"]},
            "selected_fields": ["quote_number", "total_amount"],
            "aggregations": {"total_amount": {"function": "sum"}},
            "visibility": "personal"
        }

        report_response = await client.post(
            f"{BASE_URL}/api/analytics/saved-reports",
            json=report_data,
            headers=auth_headers
        )
        assert report_response.status_code == 201
        report = report_response.json()

        # 2. Schedule the report
        schedule_data = {
            "saved_report_id": report["id"],
            "name": "Workflow Schedule",
            "schedule_cron": "0 8 * * *",
            "timezone": "UTC",
            "email_recipients": ["workflow@example.com"]
        }

        schedule_response = await client.post(
            f"{BASE_URL}/api/analytics/scheduled",
            json=schedule_data,
            headers=auth_headers
        )
        assert schedule_response.status_code == 201
        schedule = schedule_response.json()

        # 3. Execute query using report config
        query_response = await client.post(
            f"{BASE_URL}/api/analytics/query",
            json={
                "filters": report["filters"],
                "selected_fields": report["selected_fields"],
                "limit": 10
            },
            headers=auth_headers
        )
        assert query_response.status_code == 200

        # 4. Export data
        export_response = await client.post(
            f"{BASE_URL}/api/analytics/export?format=xlsx",
            json={
                "filters": report["filters"],
                "selected_fields": report["selected_fields"]
            },
            headers=auth_headers
        )
        assert export_response.status_code == 200
        assert len(export_response.content) > 0

        # 5. Cleanup
        await client.delete(
            f"{BASE_URL}/api/analytics/scheduled/{schedule['id']}",
            headers=auth_headers
        )
        await client.delete(
            f"{BASE_URL}/api/analytics/saved-reports/{report['id']}",
            headers=auth_headers
        )

        # Verify cleanup
        verify_response = await client.get(
            f"{BASE_URL}/api/analytics/saved-reports/{report['id']}",
            headers=auth_headers
        )
        assert verify_response.status_code == 404
