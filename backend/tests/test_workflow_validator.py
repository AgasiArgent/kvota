import pytest
from workflow_validator import WorkflowValidator, TransitionError
from workflow_models import WorkflowSettings, WorkflowMode
from decimal import Decimal

@pytest.fixture
def default_settings():
    return WorkflowSettings(
        organization_id="test-org",
        workflow_mode="multi_role",
        financial_approval_threshold_usd=Decimal("0"),
        senior_approval_threshold_usd=Decimal("100000"),
        multi_senior_threshold_usd=Decimal("500000"),
        board_approval_threshold_usd=Decimal("1000000"),
        senior_approvals_required=1,
        multi_senior_approvals_required=2,
        board_approvals_required=3,
        enable_parallel_logistics_customs=True,
        allow_send_back=True
    )

def test_valid_transition_draft_to_procurement(default_settings):
    """Test valid transition from draft to awaiting_procurement"""
    validator = WorkflowValidator(default_settings)

    is_valid, next_state, error = validator.validate_transition(
        from_state="draft",
        action="submit_procurement",
        user_role="sales_manager"
    )

    assert is_valid is True
    assert next_state == "awaiting_procurement"
    assert error is None

def test_invalid_role_for_transition(default_settings):
    """Test transition rejected for wrong role"""
    validator = WorkflowValidator(default_settings)

    is_valid, next_state, error = validator.validate_transition(
        from_state="draft",
        action="submit_procurement",
        user_role="procurement_manager"  # Wrong role!
    )

    assert is_valid is False
    assert error is not None
    assert "role" in error.lower()

def test_threshold_triggers_senior_approval(default_settings):
    """Test quote > $100k requires senior approval"""
    validator = WorkflowValidator(default_settings)

    required = validator.get_required_senior_approvals(Decimal("150000"))

    assert required == 1  # 1 senior approval

def test_multi_senior_threshold(default_settings):
    """Test quote > $500k requires 2 senior approvals"""
    validator = WorkflowValidator(default_settings)

    required = validator.get_required_senior_approvals(Decimal("600000"))

    assert required == 2  # 2 senior approvals
