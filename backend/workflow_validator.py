"""
Workflow Validation Logic
"""

from typing import Tuple, Optional, List
from decimal import Decimal
from workflow_models import WorkflowState, WorkflowMode, WorkflowActionType, WorkflowSettings

class TransitionError(Exception):
    """Workflow transition validation error"""
    pass

class WorkflowValidator:
    """Validates workflow state transitions and permissions"""

    # Allowed transitions by workflow mode
    TRANSITIONS = {
        'multi_role': {
            'draft': {
                'submit_procurement': ('awaiting_procurement', ['sales_manager'])
            },
            'awaiting_procurement': {
                'submit_procurement': ('awaiting_logistics_customs', ['procurement_manager']),
                'send_back': ('draft', ['procurement_manager'])
            },
            'awaiting_logistics_customs': {
                'complete_logistics': ('awaiting_logistics_customs', ['logistics_manager']),
                'complete_customs': ('awaiting_logistics_customs', ['customs_manager']),
                'send_back': ('awaiting_procurement', ['logistics_manager', 'customs_manager'])
            },
            'awaiting_sales_review': {
                'submit_approval': ('awaiting_financial_approval', ['sales_manager']),
                'send_back': ('awaiting_logistics_customs', ['sales_manager'])
            },
            'awaiting_financial_approval': {
                'approve': ('conditional', ['financial_manager']),  # Check threshold
                'reject': ('rejected', ['financial_manager']),
                'send_back': ('awaiting_sales_review', ['financial_manager'])
            },
            'awaiting_senior_approval': {
                'approve': ('conditional', ['ceo', 'cfo', 'top_sales_manager']),  # Check count
                'reject': ('rejected', ['ceo', 'cfo', 'top_sales_manager']),
                'send_back': ('awaiting_financial_approval', ['ceo', 'cfo'])
            }
        },
        'simple': {
            'draft': {
                'submit_approval': ('awaiting_financial_approval', ['sales_manager', 'manager', 'admin', 'owner'])
            },
            'awaiting_financial_approval': {
                'approve': ('conditional', ['financial_manager', 'admin', 'owner']),
                'reject': ('rejected', ['financial_manager', 'admin', 'owner'])
            },
            'awaiting_senior_approval': {
                'approve': ('conditional', ['ceo', 'cfo', 'top_sales_manager', 'owner']),
                'reject': ('rejected', ['ceo', 'cfo', 'top_sales_manager', 'owner'])
            }
        }
    }

    def __init__(self, settings: WorkflowSettings):
        self.settings = settings
        self.mode = settings.workflow_mode

    def validate_transition(
        self,
        from_state: WorkflowState,
        action: WorkflowActionType,
        user_role: str
    ) -> Tuple[bool, Optional[WorkflowState], Optional[str]]:
        """
        Validate if transition is allowed.

        Returns: (is_valid, next_state, error_message)
        """
        # Get workflow for current mode
        workflow = self.TRANSITIONS.get(self.mode)
        if not workflow:
            return (False, None, f"Invalid workflow mode: {self.mode}")

        # Check if current state exists
        if from_state not in workflow:
            return (False, None, f"Invalid state: {from_state}")

        # Check if action is allowed from this state
        if action not in workflow[from_state]:
            return (False, None, f"Action '{action}' not allowed from state '{from_state}'")

        # Get transition rule
        next_state, allowed_roles = workflow[from_state][action]

        # Check user has required role
        if user_role not in allowed_roles:
            return (False, None, f"Role '{user_role}' cannot perform '{action}'")

        return (True, next_state, None)

    def get_required_senior_approvals(self, total_usd: Decimal) -> int:
        """
        Calculate how many senior approvals are required based on amount.

        Thresholds cascade:
        - < $100k: 0 approvals
        - $100k - $500k: 1 approval
        - $500k - $1M: 2 approvals
        - >= $1M: 3 approvals
        """
        if total_usd >= self.settings.board_approval_threshold_usd:
            return self.settings.board_approvals_required

        if total_usd >= self.settings.multi_senior_threshold_usd:
            return self.settings.multi_senior_approvals_required

        if total_usd >= self.settings.senior_approval_threshold_usd:
            return self.settings.senior_approvals_required

        return 0  # No senior approval needed

    def calculate_next_state_after_approval(
        self,
        current_state: WorkflowState,
        total_usd: Decimal,
        current_senior_approvals: int = 0
    ) -> WorkflowState:
        """
        Calculate next state after approve action.

        Handles threshold checks and multi-approval counting.
        """
        if current_state == 'awaiting_financial_approval':
            # Check if senior approval needed
            required_approvals = self.get_required_senior_approvals(total_usd)

            if required_approvals > 0:
                return 'awaiting_senior_approval'
            else:
                return 'approved'

        elif current_state == 'awaiting_senior_approval':
            # Check if enough approvals received
            required_approvals = self.get_required_senior_approvals(total_usd)

            if current_senior_approvals + 1 >= required_approvals:
                return 'approved'
            else:
                return 'awaiting_senior_approval'  # Stay, need more

        return 'approved'  # Default
