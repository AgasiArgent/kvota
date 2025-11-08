"""
E2E Tests - Multi-Role Quote Workflow

Tests the complete 6-step workflow from draft to approved:
1. Sales manager creates quote and submits to procurement
2. Procurement manager adds prices and submits to logistics/customs
3a. Logistics manager completes logistics
3b. Customs manager completes customs (triggers auto-transition)
4. Sales manager adds markup and submits for approval
5. Financial manager approves (may require senior approval based on threshold)
6. Senior approval (if quote > threshold)
"""

import pytest
import os
from uuid import uuid4, UUID
from decimal import Decimal
from unittest.mock import Mock, MagicMock, patch
from fastapi.testclient import TestClient

# Import app - this will fail if main.py doesn't exist
try:
    from main import app
    client = TestClient(app)
    APP_AVAILABLE = True
except ImportError:
    APP_AVAILABLE = False
    client = None


# ============================================================================
# FIXTURES - User Contexts for Different Roles
# ============================================================================

@pytest.fixture
def test_organization_id():
    """Test organization ID"""
    return UUID("00000000-0000-0000-0000-000000000010")


@pytest.fixture
def test_quote_id():
    """Test quote ID"""
    return UUID("00000000-0000-0000-0000-000000000001")


@pytest.fixture
def sales_manager_user(test_organization_id):
    """Sales manager user fixture"""
    from auth import User

    return User(
        id=UUID("00000000-0000-0000-0000-000000000101"),
        email="sales@test.com",
        current_organization_id=test_organization_id,
        current_role="Sales Manager",
        current_role_slug="sales_manager",
        is_owner=False,
        organizations=[],
        permissions=["quotes:create", "quotes:read", "quotes:update", "quotes:submit_procurement", "quotes:submit_approval"],
        created_at="2024-01-01T00:00:00Z"
    )


@pytest.fixture
def procurement_manager_user(test_organization_id):
    """Procurement manager user fixture"""
    from auth import User

    return User(
        id=UUID("00000000-0000-0000-0000-000000000102"),
        email="procurement@test.com",
        current_organization_id=test_organization_id,
        current_role="Procurement Manager",
        current_role_slug="procurement_manager",
        is_owner=False,
        organizations=[],
        permissions=["quotes:read", "quotes:update_procurement"],
        created_at="2024-01-01T00:00:00Z"
    )


@pytest.fixture
def logistics_manager_user(test_organization_id):
    """Logistics manager user fixture"""
    from auth import User

    return User(
        id=UUID("00000000-0000-0000-0000-000000000103"),
        email="logistics@test.com",
        current_organization_id=test_organization_id,
        current_role="Logistics Manager",
        current_role_slug="logistics_manager",
        is_owner=False,
        organizations=[],
        permissions=["quotes:read", "quotes:update_logistics", "quotes:complete_logistics"],
        created_at="2024-01-01T00:00:00Z"
    )


@pytest.fixture
def customs_manager_user(test_organization_id):
    """Customs manager user fixture"""
    from auth import User

    return User(
        id=UUID("00000000-0000-0000-0000-000000000104"),
        email="customs@test.com",
        current_organization_id=test_organization_id,
        current_role="Customs Manager",
        current_role_slug="customs_manager",
        is_owner=False,
        organizations=[],
        permissions=["quotes:read", "quotes:update_customs", "quotes:complete_customs"],
        created_at="2024-01-01T00:00:00Z"
    )


@pytest.fixture
def financial_manager_user(test_organization_id):
    """Financial manager user fixture"""
    from auth import User

    return User(
        id=UUID("00000000-0000-0000-0000-000000000105"),
        email="finance@test.com",
        current_organization_id=test_organization_id,
        current_role="Financial Manager",
        current_role_slug="financial_manager",
        is_owner=False,
        organizations=[],
        permissions=["quotes:read", "quotes:approve_financial"],
        created_at="2024-01-01T00:00:00Z"
    )


@pytest.fixture
def ceo_user(test_organization_id):
    """CEO user fixture (for senior approval)"""
    from auth import User

    return User(
        id=UUID("00000000-0000-0000-0000-000000000106"),
        email="ceo@test.com",
        current_organization_id=test_organization_id,
        current_role="CEO",
        current_role_slug="ceo",
        is_owner=False,
        organizations=[],
        permissions=["quotes:read", "quotes:approve_senior", "quotes:approve_all"],
        created_at="2024-01-01T00:00:00Z"
    )


# ============================================================================
# MOCK FIXTURES - Supabase Client
# ============================================================================

@pytest.fixture
def mock_supabase():
    """Mock Supabase client for testing"""
    with patch('routes.workflow.supabase') as mock:
        client = MagicMock()
        mock.return_value = client
        yield client


@pytest.fixture
def mock_workflow_settings(test_organization_id):
    """Mock workflow settings"""
    return {
        "organization_id": str(test_organization_id),
        "workflow_mode": "multi_role",
        "financial_approval_threshold_usd": Decimal("0.00"),
        "senior_approval_threshold_usd": Decimal("100000.00"),
        "multi_senior_threshold_usd": Decimal("500000.00"),
        "board_approval_threshold_usd": Decimal("1000000.00"),
        "senior_approvals_required": 1,
        "multi_senior_approvals_required": 2,
        "board_approvals_required": 3,
        "enable_parallel_logistics_customs": True,
        "allow_send_back": True
    }


@pytest.fixture
def mock_test_quote(test_quote_id, test_organization_id):
    """Mock test quote"""
    return {
        "id": str(test_quote_id),
        "organization_id": str(test_organization_id),
        "quote_number": "QT-2024-001",
        "customer_id": "customer-1",
        "total_amount": 50000.00,  # Under $100k threshold
        "workflow_state": "draft",
        "current_assignee_role": None,
        "assigned_at": None,
        "logistics_complete": False,
        "customs_complete": False,
        "senior_approvals_required": 0,
        "senior_approvals_received": 0,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
    }


# ============================================================================
# E2E TEST - Complete Multi-Role Workflow
# ============================================================================

@pytest.mark.skipif(not APP_AVAILABLE, reason="FastAPI app not available - endpoints not implemented yet")
@pytest.mark.e2e
def test_complete_multi_role_workflow(
    mock_supabase,
    mock_workflow_settings,
    mock_test_quote,
    test_quote_id,
    sales_manager_user,
    procurement_manager_user,
    logistics_manager_user,
    customs_manager_user,
    financial_manager_user
):
    """
    Test complete 6-step multi-role workflow from draft to approved.

    This test verifies:
    - Role-based transition validation
    - State machine correctness
    - Parallel task handling (logistics + customs)
    - Auto-transitions when both parallel tasks complete
    - Threshold-based approval routing
    - Audit trail creation

    NOTE: This is a MOCK test that will need to be updated to use real
    database connections once the workflow endpoints are fully implemented.
    """

    # Setup mock Supabase responses
    mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = mock_test_quote
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = mock_workflow_settings

    quote = mock_test_quote.copy()

    # ========================================================================
    # STEP 1: Sales Manager submits to procurement
    # ========================================================================

    with patch('routes.workflow.get_current_user', return_value=sales_manager_user):
        # Mock quote in draft state
        quote["workflow_state"] = "draft"
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = quote

        response = client.post(
            f"/api/quotes/{test_quote_id}/transition",
            json={"action": "submit_procurement", "comments": "Готово к закупкам"}
        )

        # Verify transition
        assert response.status_code == 200, f"Step 1 failed: {response.json()}"
        data = response.json()
        assert data["old_state"] == "draft"
        assert data["new_state"] == "awaiting_procurement"
        assert data["next_assignee_role"] == "procurement_manager"

        # Update mock quote state
        quote["workflow_state"] = "awaiting_procurement"
        quote["current_assignee_role"] = "procurement_manager"

    # ========================================================================
    # STEP 2: Procurement Manager adds prices and submits
    # ========================================================================

    with patch('routes.workflow.get_current_user', return_value=procurement_manager_user):
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = quote

        response = client.post(
            f"/api/quotes/{test_quote_id}/transition",
            json={"action": "submit_procurement", "comments": "Цены добавлены"}
        )

        assert response.status_code == 200, f"Step 2 failed: {response.json()}"
        data = response.json()
        assert data["old_state"] == "awaiting_procurement"
        assert data["new_state"] == "awaiting_logistics_customs"

        # Update mock quote state
        quote["workflow_state"] = "awaiting_logistics_customs"
        quote["current_assignee_role"] = "logistics_manager"

    # ========================================================================
    # STEP 3a: Logistics Manager completes logistics
    # ========================================================================

    with patch('routes.workflow.get_current_user', return_value=logistics_manager_user):
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = quote

        response = client.post(
            f"/api/quotes/{test_quote_id}/transition",
            json={"action": "complete_logistics", "comments": "Логистика рассчитана"}
        )

        assert response.status_code == 200, f"Step 3a failed: {response.json()}"
        # Should stay in awaiting_logistics_customs (waiting for customs)

        # Update mock quote state
        quote["logistics_complete"] = True

    # ========================================================================
    # STEP 3b: Customs Manager completes (triggers auto-transition)
    # ========================================================================

    with patch('routes.workflow.get_current_user', return_value=customs_manager_user):
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = quote

        response = client.post(
            f"/api/quotes/{test_quote_id}/transition",
            json={"action": "complete_customs", "comments": "Таможня рассчитана"}
        )

        assert response.status_code == 200, f"Step 3b failed: {response.json()}"
        data = response.json()
        # Should auto-transition to awaiting_sales_review
        assert data["new_state"] == "awaiting_sales_review"
        assert data["next_assignee_role"] == "sales_manager"

        # Update mock quote state
        quote["workflow_state"] = "awaiting_sales_review"
        quote["customs_complete"] = True
        quote["current_assignee_role"] = "sales_manager"

    # ========================================================================
    # STEP 4: Sales Manager adds markup and submits for approval
    # ========================================================================

    with patch('routes.workflow.get_current_user', return_value=sales_manager_user):
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = quote

        response = client.post(
            f"/api/quotes/{test_quote_id}/transition",
            json={"action": "submit_approval", "comments": "Наценка добавлена"}
        )

        assert response.status_code == 200, f"Step 4 failed: {response.json()}"
        data = response.json()
        assert data["old_state"] == "awaiting_sales_review"
        assert data["new_state"] == "awaiting_financial_approval"
        assert data["next_assignee_role"] == "financial_manager"

        # Update mock quote state
        quote["workflow_state"] = "awaiting_financial_approval"
        quote["current_assignee_role"] = "financial_manager"

    # ========================================================================
    # STEP 5: Financial Manager approves
    # ========================================================================

    with patch('routes.workflow.get_current_user', return_value=financial_manager_user):
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = quote

        response = client.post(
            f"/api/quotes/{test_quote_id}/transition",
            json={"action": "approve", "comments": "Финансово утверждено"}
        )

        assert response.status_code == 200, f"Step 5 failed: {response.json()}"
        data = response.json()
        assert data["old_state"] == "awaiting_financial_approval"
        # Should go to approved (quote is $50k < $100k threshold)
        assert data["new_state"] == "approved"

        # Update mock quote state
        quote["workflow_state"] = "approved"
        quote["current_assignee_role"] = None

    # ========================================================================
    # VERIFY: Final workflow status
    # ========================================================================

    with patch('routes.workflow.get_current_user', return_value=sales_manager_user):
        # Mock transition history
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value.data = [
            {
                "id": str(uuid4()),
                "quote_id": str(test_quote_id),
                "from_state": "draft",
                "to_state": "awaiting_procurement",
                "action": "submit_procurement",
                "performed_by": str(sales_manager_user.id),
                "role_at_transition": "sales_manager",
                "performed_at": "2024-01-01T10:00:00Z",
                "comments": "Готово к закупкам",
                "reason": None
            },
            # ... (other transitions would be here)
            {
                "id": str(uuid4()),
                "quote_id": str(test_quote_id),
                "from_state": "awaiting_financial_approval",
                "to_state": "approved",
                "action": "approve",
                "performed_by": str(financial_manager_user.id),
                "role_at_transition": "financial_manager",
                "performed_at": "2024-01-01T15:00:00Z",
                "comments": "Финансово утверждено",
                "reason": None
            }
        ]

        response = client.get(f"/api/quotes/{test_quote_id}/workflow")

        assert response.status_code == 200, "Workflow status check failed"
        workflow = response.json()
        assert workflow["current_state"] == "approved"
        assert workflow["logistics_complete"] is True
        assert workflow["customs_complete"] is True
        assert len(workflow["transitions"]) > 0  # Has transition history


@pytest.mark.skipif(not APP_AVAILABLE, reason="FastAPI app not available - endpoints not implemented yet")
@pytest.mark.e2e
def test_high_value_quote_requires_senior_approval(
    mock_supabase,
    mock_workflow_settings,
    mock_test_quote,
    test_quote_id,
    financial_manager_user,
    ceo_user
):
    """
    Test that high-value quotes (>$100k) require senior approval.

    Verifies threshold-based routing works correctly.
    """

    # Setup high-value quote
    quote = mock_test_quote.copy()
    quote["total_amount"] = 150000.00  # Above $100k threshold
    quote["workflow_state"] = "awaiting_financial_approval"

    mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = quote
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = mock_workflow_settings

    # Financial manager approves
    with patch('routes.workflow.get_current_user', return_value=financial_manager_user):
        response = client.post(
            f"/api/quotes/{test_quote_id}/transition",
            json={"action": "approve"}
        )

        assert response.status_code == 200
        data = response.json()
        # Should route to senior approval (not directly to approved)
        assert data["new_state"] == "awaiting_senior_approval"
        assert data["next_assignee_role"] == "ceo"

        # Update mock state
        quote["workflow_state"] = "awaiting_senior_approval"
        quote["senior_approvals_required"] = 1
        quote["senior_approvals_received"] = 0

    # CEO approves
    with patch('routes.workflow.get_current_user', return_value=ceo_user):
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = quote

        response = client.post(
            f"/api/quotes/{test_quote_id}/transition",
            json={"action": "approve"}
        )

        assert response.status_code == 200
        data = response.json()
        # Now should go to approved (1 senior approval received = 1 required)
        assert data["new_state"] == "approved"


@pytest.mark.skipif(not APP_AVAILABLE, reason="FastAPI app not available - endpoints not implemented yet")
@pytest.mark.e2e
def test_send_back_workflow(
    mock_supabase,
    mock_workflow_settings,
    mock_test_quote,
    test_quote_id,
    procurement_manager_user,
    sales_manager_user
):
    """
    Test send_back functionality - returning quote to previous state.
    """

    quote = mock_test_quote.copy()
    quote["workflow_state"] = "awaiting_procurement"

    mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = quote
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = mock_workflow_settings

    # Procurement manager sends back to sales
    with patch('routes.workflow.get_current_user', return_value=procurement_manager_user):
        response = client.post(
            f"/api/quotes/{test_quote_id}/transition",
            json={"action": "send_back", "reason": "Нужно уточнить требования клиента"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["old_state"] == "awaiting_procurement"
        assert data["new_state"] == "draft"
        assert "доработку" in data["message"].lower()


# ============================================================================
# SKIP MARKER - Tests that require real database
# ============================================================================

@pytest.mark.skip(reason="Requires real database and Supabase connection")
@pytest.mark.integration
def test_real_database_workflow():
    """
    PLACEHOLDER: Real E2E test with actual database.

    To implement this test:
    1. Create test users in Supabase Auth for each role
    2. Create test organization with workflow settings
    3. Create test quote
    4. Run through full workflow with real API calls
    5. Verify transitions in database
    6. Clean up test data

    This requires:
    - SUPABASE_URL environment variable
    - SUPABASE_SERVICE_ROLE_KEY environment variable
    - Test user credentials
    """
    pass


if __name__ == "__main__":
    # Allow running tests directly
    pytest.main([__file__, "-v", "--tb=short"])
