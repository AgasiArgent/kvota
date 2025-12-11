"""
Workflow System - Pydantic Models
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime
from decimal import Decimal

WorkflowState = Literal[
    'draft',
    'awaiting_procurement',
    'awaiting_logistics_customs',
    'awaiting_sales_review',
    'awaiting_financial_approval',
    'financially_approved',
    'sent_back_for_revision',
    'rejected_by_finance',
    'awaiting_senior_approval',
    'approved',
    'rejected'
]

WorkflowMode = Literal['simple', 'multi_role']

WorkflowActionType = Literal[
    'submit_procurement',
    'complete_logistics',
    'complete_customs',
    'submit_approval',
    'approve',
    'reject',
    'send_back',
    'auto_transition'
]

class WorkflowTransition(BaseModel):
    """Single workflow transition record"""
    id: str
    quote_id: str
    from_state: WorkflowState
    to_state: WorkflowState
    action: WorkflowActionType
    performed_by: str
    performed_by_name: Optional[str] = None
    role_at_transition: str
    performed_at: datetime
    comments: Optional[str] = None
    reason: Optional[str] = None

class WorkflowStatus(BaseModel):
    """Current workflow status for a quote"""
    current_state: WorkflowState
    current_assignee_role: Optional[str] = None
    assigned_at: Optional[datetime] = None

    # User capabilities
    can_user_act: bool
    available_actions: List[WorkflowActionType]

    # Parallel tasks
    logistics_complete: bool = False
    customs_complete: bool = False

    # Multi-senior approval
    senior_approvals_required: int = 0
    senior_approvals_received: int = 0

    # History
    transitions: List[WorkflowTransition]

class WorkflowTransitionRequest(BaseModel):
    """Request to transition workflow state"""
    action: WorkflowActionType
    comments: Optional[str] = Field(None, max_length=500)
    reason: Optional[str] = Field(None, max_length=500)

class WorkflowTransitionResponse(BaseModel):
    """Response after successful transition"""
    quote_id: str
    old_state: WorkflowState
    new_state: WorkflowState
    transition_id: str
    next_assignee_role: Optional[str] = None
    message: str

class WorkflowSettings(BaseModel):
    """Organization workflow configuration"""
    organization_id: str
    workflow_mode: WorkflowMode = WorkflowMode.SIMPLE

    # Thresholds (default: no thresholds - everything auto-approved)
    financial_approval_threshold_usd: Decimal = Decimal("0")
    senior_approval_threshold_usd: Decimal = Decimal("50000")
    multi_senior_threshold_usd: Decimal = Decimal("100000")
    board_approval_threshold_usd: Decimal = Decimal("500000")

    # Approval counts
    senior_approvals_required: int = 1
    multi_senior_approvals_required: int = 2
    board_approvals_required: int = 3

    # Features
    enable_parallel_logistics_customs: bool = False
    allow_send_back: bool = True

    # Legacy fields (for backwards compatibility)
    thresholds: Optional[list] = None
    require_procurement_review: Optional[bool] = None
    require_logistics_customs_parallel: Optional[bool] = None

class WorkflowSettingsUpdate(BaseModel):
    """Update workflow settings (admin only)"""
    workflow_mode: Optional[WorkflowMode] = None
    senior_approval_threshold_usd: Optional[Decimal] = None
    multi_senior_threshold_usd: Optional[Decimal] = None
    board_approval_threshold_usd: Optional[Decimal] = None
    senior_approvals_required: Optional[int] = Field(None, ge=1, le=5)
    multi_senior_approvals_required: Optional[int] = Field(None, ge=1, le=5)
    board_approvals_required: Optional[int] = Field(None, ge=1, le=5)

class MyTask(BaseModel):
    """Quote in user's task list"""
    quote_id: str
    quote_number: str
    customer_name: str
    total_amount: Decimal
    workflow_state: WorkflowState
    assigned_at: datetime
    age_hours: int
