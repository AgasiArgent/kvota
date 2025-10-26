"""
Simplified Tests for User Profile Management

Tests validation logic and integration with export system.
"""
import pytest
from pydantic import ValidationError
from routes.users import UpdateUserProfileRequest


# ============================================================================
# VALIDATION TESTS
# ============================================================================

def test_valid_phone_formats():
    """Test that valid phone formats pass validation"""
    valid_phones = [
        "+79991234567",           # Russian international format
        "89991234567",            # Russian national format
        "+1234567890",            # International format (10 digits)
        "+12345678901234",        # International format (14 digits)
        "+7 (999) 123-45-67",     # Russian with formatting
        "+7 999 123 45 67",       # Russian with spaces
    ]

    for phone in valid_phones:
        try:
            request = UpdateUserProfileRequest(manager_phone=phone)
            assert request.manager_phone == phone
        except ValidationError as e:
            pytest.fail(f"Phone {phone} should be valid but failed: {e}")


def test_invalid_phone_short():
    """Test that short phone fails validation"""
    with pytest.raises(ValidationError) as exc_info:
        UpdateUserProfileRequest(manager_phone="+7999")

    assert "Phone must be in format" in str(exc_info.value)


def test_invalid_phone_letters():
    """Test that phone with letters fails validation"""
    with pytest.raises(ValidationError) as exc_info:
        UpdateUserProfileRequest(manager_phone="+7999ABCDEFG")

    assert "Phone must be in format" in str(exc_info.value)


def test_invalid_email():
    """Test that invalid email fails validation"""
    with pytest.raises(ValidationError):
        UpdateUserProfileRequest(manager_email="not-an-email")


def test_valid_email():
    """Test that valid email passes validation"""
    request = UpdateUserProfileRequest(manager_email="test@example.com")
    assert request.manager_email == "test@example.com"


def test_partial_update():
    """Test that partial updates work (only some fields)"""
    # Only manager_name
    request1 = UpdateUserProfileRequest(manager_name="John Doe")
    assert request1.manager_name == "John Doe"
    assert request1.manager_phone is None
    assert request1.manager_email is None

    # Only manager_email
    request2 = UpdateUserProfileRequest(manager_email="john@example.com")
    assert request2.manager_email == "john@example.com"
    assert request2.manager_name is None
    assert request2.manager_phone is None

    # All fields
    request3 = UpdateUserProfileRequest(
        manager_name="Jane Smith",
        manager_phone="+79991234567",
        manager_email="jane@example.com"
    )
    assert request3.manager_name == "Jane Smith"
    assert request3.manager_phone == "+79991234567"
    assert request3.manager_email == "jane@example.com"


def test_empty_phone_allowed():
    """Test that empty phone is allowed (optional field)"""
    request = UpdateUserProfileRequest(manager_phone="")
    assert request.manager_phone == ""

    request2 = UpdateUserProfileRequest(manager_phone=None)
    assert request2.manager_phone is None


# ============================================================================
# INTEGRATION WITH EXPORT SYSTEM
# ============================================================================

@pytest.mark.asyncio
async def test_manager_info_integration():
    """Test that manager info from user_profiles integrates with export mapper"""
    from services.export_data_mapper import get_manager_info, ExportData
    from unittest.mock import MagicMock

    # Test case 1: Quote-level override takes priority
    export_data = ExportData(
        quote={
            "manager_name": "Quote Override",
            "manager_phone": "+71111111111",
            "manager_email": "quote@example.com"
        },
        items=[],
        manager={
            "full_name": "Profile Name",
            "phone": "+72222222222",
            "manager_email": "profile@example.com"
        },
        organization={},
        variables={},
        calculations={}
    )

    manager_info = get_manager_info(export_data)
    assert manager_info["name"] == "Quote Override"
    assert manager_info["phone"] == "+71111111111"
    assert manager_info["email"] == "quote@example.com"


    # Test case 2: User profile fallback
    export_data2 = ExportData(
        quote={
            "manager_name": None,
            "manager_phone": None,
            "manager_email": None
        },
        items=[],
        manager={
            "full_name": "Profile Name",
            "phone": "+72222222222",
            "manager_email": "profile@example.com"
        },
        organization={},
        variables={},
        calculations={}
    )

    manager_info2 = get_manager_info(export_data2)
    assert manager_info2["name"] == "Profile Name"
    assert manager_info2["phone"] == "+72222222222"
    assert manager_info2["email"] == "profile@example.com"


    # Test case 3: Empty fallback
    export_data3 = ExportData(
        quote={},
        items=[],
        manager=None,
        organization={},
        variables={},
        calculations={}
    )

    manager_info3 = get_manager_info(export_data3)
    assert manager_info3["name"] == ""
    assert manager_info3["phone"] == ""
    assert manager_info3["email"] == ""
