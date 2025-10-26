"""
Tests for User Profile Management Endpoints

Tests GET and PUT /api/users/profile endpoints,
including validation for email and phone formats.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
from uuid import UUID
from main import app
from auth import User, UserRole


client = TestClient(app)


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def mock_user():
    """Mock authenticated user"""
    return User(
        id=UUID("123e4567-e89b-12d3-a456-426614174000"),
        email="test@example.com",
        role=UserRole.SALES_MANAGER,
        current_organization_id=UUID("123e4567-e89b-12d3-a456-426614174001"),
        permissions=["users:read", "users:update"],
        created_at=datetime.now()
    )


@pytest.fixture
def mock_user_profile():
    """Mock user profile data"""
    return {
        "user_id": "123e4567-e89b-12d3-a456-426614174000",
        "full_name": "Test User",
        "phone": "+79991234567",
        "avatar_url": None,
        "title": "Sales Manager",
        "bio": None,
        "manager_name": "John Doe",
        "manager_phone": "+79997654321",
        "manager_email": "john@example.com",
        "last_active_organization_id": "org-123",
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z"
    }


# ============================================================================
# GET /api/users/profile TESTS
# ============================================================================

@patch('routes.users.get_current_user')
@patch('routes.users.create_client')
def test_get_user_profile_success(mock_create_client, mock_get_current_user, mock_user, mock_user_profile):
    """Test successful profile retrieval"""
    # Setup mocks
    mock_get_current_user.return_value = mock_user

    mock_supabase = MagicMock()
    mock_result = MagicMock()
    mock_result.data = [mock_user_profile]
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
    mock_create_client.return_value = mock_supabase

    # Make request
    response = client.get("/api/users/profile")

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == mock_user.id
    assert data["manager_name"] == "John Doe"
    assert data["manager_phone"] == "+79997654321"
    assert data["manager_email"] == "john@example.com"


@patch('routes.users.get_current_user')
@patch('routes.users.create_client')
def test_get_user_profile_not_found(mock_create_client, mock_get_current_user, mock_user):
    """Test profile not found"""
    # Setup mocks
    mock_get_current_user.return_value = mock_user

    mock_supabase = MagicMock()
    mock_result = MagicMock()
    mock_result.data = []  # No profile found
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
    mock_create_client.return_value = mock_supabase

    # Make request
    response = client.get("/api/users/profile")

    # Assertions
    assert response.status_code == 404
    assert "User profile not found" in response.json()["detail"]


# ============================================================================
# PUT /api/users/profile TESTS
# ============================================================================

@patch('routes.users.get_current_user')
@patch('routes.users.create_client')
def test_update_user_profile_success(mock_create_client, mock_get_current_user, mock_user, mock_user_profile):
    """Test successful profile update"""
    # Setup mocks
    mock_get_current_user.return_value = mock_user

    updated_profile = mock_user_profile.copy()
    updated_profile["manager_name"] = "Jane Smith"
    updated_profile["manager_phone"] = "+79991112233"
    updated_profile["manager_email"] = "jane@example.com"

    mock_supabase = MagicMock()
    mock_result = MagicMock()
    mock_result.data = [updated_profile]
    mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_result
    mock_create_client.return_value = mock_supabase

    # Make request
    response = client.put("/api/users/profile", json={
        "manager_name": "Jane Smith",
        "manager_phone": "+79991112233",
        "manager_email": "jane@example.com"
    })

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["manager_name"] == "Jane Smith"
    assert data["manager_phone"] == "+79991112233"
    assert data["manager_email"] == "jane@example.com"


@patch('routes.users.get_current_user')
@patch('routes.users.create_client')
def test_update_user_profile_partial(mock_create_client, mock_get_current_user, mock_user, mock_user_profile):
    """Test partial profile update (only manager_name)"""
    # Setup mocks
    mock_get_current_user.return_value = mock_user

    updated_profile = mock_user_profile.copy()
    updated_profile["manager_name"] = "Alice Johnson"

    mock_supabase = MagicMock()
    mock_result = MagicMock()
    mock_result.data = [updated_profile]
    mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_result
    mock_create_client.return_value = mock_supabase

    # Make request
    response = client.put("/api/users/profile", json={
        "manager_name": "Alice Johnson"
    })

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["manager_name"] == "Alice Johnson"


# ============================================================================
# VALIDATION TESTS
# ============================================================================

def test_update_profile_invalid_email():
    """Test validation: invalid email format"""
    response = client.put("/api/users/profile", json={
        "manager_email": "not-an-email"
    })

    # Should return 422 Unprocessable Entity or 400 Bad Request
    assert response.status_code in [400, 422]
    response_text = str(response.json()).lower()
    assert "validation" in response_text or "value" in response_text or "email" in response_text


def test_update_profile_invalid_phone_short():
    """Test validation: phone too short"""
    response = client.put("/api/users/profile", json={
        "manager_phone": "+7999"
    })

    # Should return 422 Unprocessable Entity or 400 Bad Request
    assert response.status_code in [400, 422]


def test_update_profile_invalid_phone_letters():
    """Test validation: phone contains letters"""
    response = client.put("/api/users/profile", json={
        "manager_phone": "+7999ABCDEFG"
    })

    # Should return 422 Unprocessable Entity or 400 Bad Request
    assert response.status_code in [400, 422]


@patch('routes.users.get_current_user')
@patch('routes.users.create_client')
def test_update_profile_valid_phone_formats(mock_create_client, mock_get_current_user, mock_user, mock_user_profile):
    """Test validation: valid phone formats"""
    # Setup mocks
    mock_get_current_user.return_value = mock_user

    mock_supabase = MagicMock()
    mock_result = MagicMock()
    mock_result.data = [mock_user_profile]
    mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_result
    mock_create_client.return_value = mock_supabase

    valid_phones = [
        "+79991234567",           # Russian international format
        "89991234567",            # Russian national format
        "+1234567890",            # International format (10 digits)
        "+12345678901234",        # International format (14 digits)
        "+7 (999) 123-45-67",     # Russian with formatting
        "+7 999 123 45 67",       # Russian with spaces
    ]

    for phone in valid_phones:
        response = client.put("/api/users/profile", json={
            "manager_phone": phone
        })
        assert response.status_code == 200, f"Phone {phone} should be valid"


# ============================================================================
# INTEGRATION WITH EXPORT SYSTEM TESTS
# ============================================================================

@patch('services.export_data_mapper.get_supabase_client')
@pytest.mark.asyncio
async def test_manager_info_in_export_data(mock_get_supabase):
    """Test that manager info from user_profiles appears in export data"""
    from services.export_data_mapper import fetch_export_data

    # Setup mock Supabase client
    mock_supabase = MagicMock()

    # Mock quote
    mock_quote_result = MagicMock()
    mock_quote_result.data = [{
        "id": "quote-123",
        "organization_id": "org-123",
        "customer_id": "customer-123",
        "contact_id": None,
        "created_by_user_id": "user-123",
        "manager_name": None,  # No quote-level override
        "manager_phone": None,
        "manager_email": None
    }]

    # Mock quote items
    mock_items_result = MagicMock()
    mock_items_result.data = []

    # Mock customer
    mock_customer_result = MagicMock()
    mock_customer_result.data = [{"id": "customer-123", "name": "Test Customer"}]

    # Mock user profile with manager info
    mock_profile_result = MagicMock()
    mock_profile_result.data = [{
        "user_id": "user-123",
        "full_name": "Test Manager",
        "phone": "+79991234567",
        "manager_name": "John Doe",
        "manager_phone": "+79997654321",
        "manager_email": "john@example.com"
    }]

    # Mock auth user
    mock_auth_user = MagicMock()
    mock_auth_user.user.email = "test@example.com"

    # Mock organization
    mock_org_result = MagicMock()
    mock_org_result.data = [{"id": "org-123", "name": "Test Org"}]

    # Mock variables
    mock_vars_result = MagicMock()
    mock_vars_result.data = [{"variables": {}}]

    # Setup mock responses
    def table_select_mock(table_name):
        mock_table = MagicMock()
        if table_name == "quotes":
            mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = mock_quote_result
        elif table_name == "quote_items":
            mock_table.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_items_result
        elif table_name == "customers":
            mock_table.select.return_value.eq.return_value.execute.return_value = mock_customer_result
        elif table_name == "user_profiles":
            mock_table.select.return_value.eq.return_value.execute.return_value = mock_profile_result
        elif table_name == "organizations":
            mock_table.select.return_value.eq.return_value.execute.return_value = mock_org_result
        elif table_name == "quote_calculation_variables":
            mock_table.select.return_value.eq.return_value.execute.return_value = mock_vars_result
        return mock_table

    mock_supabase.table = table_select_mock
    mock_supabase.auth.admin.get_user_by_id.return_value = mock_auth_user
    mock_get_supabase.return_value = mock_supabase

    # Fetch export data
    export_data = await fetch_export_data("quote-123", "org-123")

    # Assertions
    assert export_data.manager is not None
    assert export_data.manager["full_name"] == "John Doe"  # Uses manager_name from profile
    assert export_data.manager["phone"] == "+79997654321"
    assert export_data.manager["manager_email"] == "john@example.com"
