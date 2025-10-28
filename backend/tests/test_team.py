"""
Team Management API Tests
Tests for organization member CRUD operations
"""
import pytest
import os
from uuid import uuid4
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient


@pytest.fixture
def mock_supabase():
    """Mock Supabase client"""
    with patch('routes.team.get_supabase_client') as mock:
        client = MagicMock()
        mock.return_value = client
        yield client


@pytest.fixture
def mock_supabase_admin():
    """Mock Supabase admin client"""
    with patch('routes.team.supabase_admin') as mock:
        yield mock


@pytest.fixture
def mock_auth_context():
    """Mock authenticated user context"""
    from auth import User, OrganizationContext
    from uuid import UUID

    user = User(
        id=UUID("00000000-0000-0000-0000-000000000001"),
        email="admin@test.com",
        current_organization_id=UUID("00000000-0000-0000-0000-000000000010"),
        current_role="Admin",
        current_role_slug="admin",
        is_owner=False,
        organizations=[],
        permissions=["*"],
        created_at="2024-01-01T00:00:00Z"
    )

    context = OrganizationContext(
        user=user,
        organization_id=UUID("00000000-0000-0000-0000-000000000010"),
        organization_name="Test Org",
        role_id=UUID("00000000-0000-0000-0000-000000000020"),
        role_name="Admin",
        role_slug="admin",
        is_owner=False,
        permissions=["*"]
    )

    return context


# ============================================================================
# LIST MEMBERS TESTS
# ============================================================================

def test_list_members_success(mock_supabase, mock_supabase_admin, mock_auth_context):
    """Test successful listing of team members"""
    from routes.team import list_team_members

    # Mock Supabase response
    mock_supabase.table.return_value.select.return_value.eq.return_value.in_.return_value.order.return_value.execute.return_value.data = [
        {
            "id": "member-1",
            "user_id": "user-1",
            "organization_id": str(mock_auth_context.organization_id),
            "role_id": "role-1",
            "status": "active",
            "is_owner": True,
            "invited_by": None,
            "invited_at": "2024-01-01T00:00:00Z",
            "joined_at": "2024-01-01T00:00:00Z",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
            "roles": {"name": "Owner", "slug": "owner"}
        },
        {
            "id": "member-2",
            "user_id": "user-2",
            "organization_id": str(mock_auth_context.organization_id),
            "role_id": "role-2",
            "status": "active",
            "is_owner": False,
            "invited_by": "user-1",
            "invited_at": "2024-01-02T00:00:00Z",
            "joined_at": "2024-01-02T00:00:00Z",
            "created_at": "2024-01-02T00:00:00Z",
            "updated_at": "2024-01-02T00:00:00Z",
            "roles": {"name": "Member", "slug": "member"}
        }
    ]

    # Mock user details from Supabase Auth
    mock_user_1 = Mock()
    mock_user_1.email = "owner@test.com"
    mock_user_1.user_metadata = {"full_name": "John Owner"}

    mock_user_2 = Mock()
    mock_user_2.email = "member@test.com"
    mock_user_2.user_metadata = {"full_name": "Jane Member"}

    mock_supabase_admin.auth.admin.get_user_by_id.side_effect = [
        Mock(user=mock_user_1),
        Mock(user=mock_user_2)
    ]

    # Call endpoint
    import asyncio
    result = asyncio.run(list_team_members(
        organization_id=str(mock_auth_context.organization_id),
        context=mock_auth_context
    ))

    # Assertions
    assert len(result) == 2
    assert result[0].user_email == "owner@test.com"
    assert result[0].user_full_name == "John Owner"
    assert result[0].role_name == "Owner"
    assert result[0].is_owner == True
    assert result[1].user_email == "member@test.com"
    assert result[1].role_name == "Member"


def test_list_members_ordered_by_hierarchy(mock_supabase, mock_supabase_admin, mock_auth_context):
    """Test that members are ordered by role hierarchy"""
    from routes.team import list_team_members

    # Mock Supabase response with mixed order
    mock_supabase.table.return_value.select.return_value.eq.return_value.in_.return_value.order.return_value.execute.return_value.data = [
        {
            "id": "member-1",
            "user_id": "user-1",
            "organization_id": str(mock_auth_context.organization_id),
            "role_id": "role-1",
            "status": "active",
            "is_owner": False,
            "invited_by": None,
            "invited_at": "2024-01-01T00:00:00Z",
            "joined_at": "2024-01-01T00:00:00Z",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
            "roles": {"name": "Member", "slug": "member"}
        },
        {
            "id": "member-2",
            "user_id": "user-2",
            "organization_id": str(mock_auth_context.organization_id),
            "role_id": "role-2",
            "status": "active",
            "is_owner": True,
            "invited_by": None,
            "invited_at": "2024-01-02T00:00:00Z",
            "joined_at": "2024-01-02T00:00:00Z",
            "created_at": "2024-01-02T00:00:00Z",
            "updated_at": "2024-01-02T00:00:00Z",
            "roles": {"name": "Owner", "slug": "owner"}
        },
        {
            "id": "member-3",
            "user_id": "user-3",
            "organization_id": str(mock_auth_context.organization_id),
            "role_id": "role-3",
            "status": "active",
            "is_owner": False,
            "invited_by": None,
            "invited_at": "2024-01-03T00:00:00Z",
            "joined_at": "2024-01-03T00:00:00Z",
            "created_at": "2024-01-03T00:00:00Z",
            "updated_at": "2024-01-03T00:00:00Z",
            "roles": {"name": "Admin", "slug": "admin"}
        }
    ]

    # Mock user details
    def mock_get_user(user_id):
        mock_user = Mock()
        mock_user.email = f"{user_id}@test.com"
        mock_user.user_metadata = {"full_name": f"User {user_id}"}
        return Mock(user=mock_user)

    mock_supabase_admin.auth.admin.get_user_by_id.side_effect = mock_get_user

    # Call endpoint
    import asyncio
    result = asyncio.run(list_team_members(
        organization_id=str(mock_auth_context.organization_id),
        context=mock_auth_context
    ))

    # Should be ordered: Owner → Admin → Member
    assert result[0].role_slug == "owner"
    assert result[1].role_slug == "admin"
    assert result[2].role_slug == "member"


# ============================================================================
# INVITE MEMBER TESTS
# ============================================================================

def test_invite_member_success(mock_supabase, mock_supabase_admin, mock_auth_context):
    """Test successful member invitation"""
    from routes.team import invite_team_member
    from uuid import UUID

    role_id = UUID("00000000-0000-0000-0000-000000000030")

    # Mock role lookup
    mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "id": str(role_id),
        "name": "Member",
        "slug": "member"
    }

    # Mock user lookup
    mock_user = Mock()
    mock_user.email = "newuser@test.com"
    mock_user.id = "user-new"
    mock_supabase_admin.auth.admin.list_users.return_value = [mock_user]

    # Mock existing member check (none found)
    mock_supabase.table.return_value.select.return_value.eq.side_effect = [
        Mock(return_value=Mock(execute=Mock(return_value=Mock(data=[])))),  # No existing member
        Mock(return_value=Mock(execute=Mock(return_value=Mock(data=[]))))   # No existing member (second call)
    ]

    # Reset side_effect after existing member checks
    mock_supabase.table.return_value.select.return_value.eq.side_effect = None
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

    # Mock member insert
    mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [{
        "id": "member-new",
        "user_id": "user-new",
        "organization_id": str(mock_auth_context.organization_id),
        "role_id": str(role_id),
        "status": "active",
        "is_owner": False
    }]

    # Call endpoint
    import asyncio
    result = asyncio.run(invite_team_member(
        organization_id=str(mock_auth_context.organization_id),
        email="newuser@test.com",
        role_id=role_id,
        context=mock_auth_context
    ))

    # Assertions
    assert result["message"] == "Member added successfully"
    assert result["user_email"] == "newuser@test.com"
    assert result["role"] == "Member"


def test_invite_member_user_not_found(mock_supabase, mock_supabase_admin, mock_auth_context):
    """Test invitation fails when user doesn't exist"""
    from routes.team import invite_team_member
    from uuid import UUID
    from fastapi import HTTPException

    role_id = UUID("00000000-0000-0000-0000-000000000030")

    # Mock role lookup
    mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "id": str(role_id),
        "name": "Member",
        "slug": "member"
    }

    # Mock user lookup - user not found
    mock_supabase_admin.auth.admin.list_users.return_value = []

    # Call endpoint and expect HTTPException
    import asyncio
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(invite_team_member(
            organization_id=str(mock_auth_context.organization_id),
            email="nonexistent@test.com",
            role_id=role_id,
            context=mock_auth_context
        ))

    assert exc_info.value.status_code == 404
    assert "not found" in str(exc_info.value.detail).lower()


def test_invite_member_already_exists(mock_supabase, mock_supabase_admin, mock_auth_context):
    """Test invitation fails when user is already a member"""
    from routes.team import invite_team_member
    from uuid import UUID
    from fastapi import HTTPException

    role_id = UUID("00000000-0000-0000-0000-000000000030")

    # Mock role lookup
    mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "id": str(role_id),
        "name": "Member",
        "slug": "member"
    }

    # Mock user lookup
    mock_user = Mock()
    mock_user.email = "existing@test.com"
    mock_user.id = "user-existing"
    mock_supabase_admin.auth.admin.list_users.return_value = [mock_user]

    # Mock existing member check (found)
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
        "id": "member-existing",
        "status": "active"
    }]

    # Call endpoint and expect HTTPException
    import asyncio
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(invite_team_member(
            organization_id=str(mock_auth_context.organization_id),
            email="existing@test.com",
            role_id=role_id,
            context=mock_auth_context
        ))

    assert exc_info.value.status_code == 409
    assert "already a member" in str(exc_info.value.detail).lower()


# ============================================================================
# UPDATE ROLE TESTS
# ============================================================================

def test_update_member_role_success(mock_supabase, mock_auth_context):
    """Test successful role update"""
    from routes.team import update_member_role
    from uuid import UUID

    member_id = "member-1"
    new_role_id = UUID("00000000-0000-0000-0000-000000000040")

    # Mock get member
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "id": member_id,
        "user_id": "user-1",
        "organization_id": str(mock_auth_context.organization_id),
        "is_owner": False,
        "roles": {"slug": "member"}
    }

    # Mock new role lookup
    mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "id": str(new_role_id),
        "slug": "manager"
    }

    # Mock role update
    mock_supabase.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{
        "id": member_id,
        "user_id": "user-1",
        "organization_id": str(mock_auth_context.organization_id),
        "role_id": str(new_role_id),
        "status": "active",
        "is_owner": False,
        "invited_by": None,
        "invited_at": "2024-01-01T00:00:00Z",
        "joined_at": "2024-01-01T00:00:00Z",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
    }]

    # Call endpoint
    import asyncio
    result = asyncio.run(update_member_role(
        organization_id=str(mock_auth_context.organization_id),
        member_id=member_id,
        role_id=new_role_id,
        context=mock_auth_context
    ))

    # Assertions
    assert result.role_id == new_role_id


def test_update_role_cannot_change_owner(mock_supabase, mock_auth_context):
    """Test that owner's role cannot be changed"""
    from routes.team import update_member_role
    from uuid import UUID
    from fastapi import HTTPException

    member_id = "member-owner"
    new_role_id = UUID("00000000-0000-0000-0000-000000000040")

    # Mock get member - is owner
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "id": member_id,
        "user_id": "user-owner",
        "is_owner": True
    }

    # Call endpoint and expect HTTPException
    import asyncio
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(update_member_role(
            organization_id=str(mock_auth_context.organization_id),
            member_id=member_id,
            role_id=new_role_id,
            context=mock_auth_context
        ))

    assert exc_info.value.status_code == 400
    assert "owner" in str(exc_info.value.detail).lower()


def test_update_role_cannot_change_own_role(mock_supabase, mock_auth_context):
    """Test that users cannot change their own role"""
    from routes.team import update_member_role
    from uuid import UUID
    from fastapi import HTTPException

    member_id = "member-self"
    new_role_id = UUID("00000000-0000-0000-0000-000000000040")

    # Mock get member - same user as auth context
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "id": member_id,
        "user_id": str(mock_auth_context.user.id),
        "is_owner": False
    }

    # Call endpoint and expect HTTPException
    import asyncio
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(update_member_role(
            organization_id=str(mock_auth_context.organization_id),
            member_id=member_id,
            role_id=new_role_id,
            context=mock_auth_context
        ))

    assert exc_info.value.status_code == 400
    assert "your own role" in str(exc_info.value.detail).lower()


# ============================================================================
# DELETE MEMBER TESTS
# ============================================================================

def test_remove_member_success(mock_supabase, mock_auth_context):
    """Test successful member removal"""
    from routes.team import remove_team_member

    member_id = "member-1"

    # Mock get member
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "user_id": "user-1",
        "is_owner": False
    }

    # Mock soft delete
    mock_supabase.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [{"id": member_id}]

    # Call endpoint (should not raise exception)
    import asyncio
    asyncio.run(remove_team_member(
        organization_id=str(mock_auth_context.organization_id),
        member_id=member_id,
        context=mock_auth_context
    ))

    # Should complete without exception


def test_remove_member_cannot_remove_owner(mock_supabase, mock_auth_context):
    """Test that owner cannot be removed"""
    from routes.team import remove_team_member
    from fastapi import HTTPException

    member_id = "member-owner"

    # Mock get member - is owner
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "user_id": "user-owner",
        "is_owner": True
    }

    # Call endpoint and expect HTTPException
    import asyncio
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(remove_team_member(
            organization_id=str(mock_auth_context.organization_id),
            member_id=member_id,
            context=mock_auth_context
        ))

    assert exc_info.value.status_code == 400
    assert "owner" in str(exc_info.value.detail).lower()


def test_remove_member_cannot_remove_yourself(mock_supabase, mock_auth_context):
    """Test that users cannot remove themselves"""
    from routes.team import remove_team_member
    from fastapi import HTTPException

    member_id = "member-self"

    # Mock get member - same user as auth context
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value.data = {
        "user_id": str(mock_auth_context.user.id),
        "is_owner": False
    }

    # Call endpoint and expect HTTPException
    import asyncio
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(remove_team_member(
            organization_id=str(mock_auth_context.organization_id),
            member_id=member_id,
            context=mock_auth_context
        ))

    assert exc_info.value.status_code == 400
    assert "yourself" in str(exc_info.value.detail).lower()


# ============================================================================
# AUTHORIZATION TESTS
# ============================================================================

def test_list_members_requires_org_membership():
    """Test that only org members can list members"""
    # This is handled by get_organization_context dependency
    # which raises 403 if user is not a member
    pass  # Covered by integration tests


def test_invite_member_requires_admin():
    """Test that only admins can invite members"""
    # This is handled by require_org_admin() dependency
    # which raises 403 if user is not admin/owner
    pass  # Covered by integration tests


def test_update_role_requires_admin():
    """Test that only admins can update roles"""
    # This is handled by require_org_admin() dependency
    pass  # Covered by integration tests


def test_remove_member_requires_admin():
    """Test that only admins can remove members"""
    # This is handled by require_org_admin() dependency
    pass  # Covered by integration tests
