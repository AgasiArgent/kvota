"""
Quote Workflow API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from uuid import UUID
from decimal import Decimal
import logging

from auth import get_current_user, User, check_admin_permissions
from workflow_models import (
    WorkflowStatus, WorkflowTransitionRequest, WorkflowTransitionResponse,
    WorkflowSettings, WorkflowSettingsUpdate, MyTask, WorkflowTransition
)
from workflow_validator import WorkflowValidator
from supabase import create_client, Client
import os

router = APIRouter(prefix="/api/quotes", tags=["workflow"])
logger = logging.getLogger(__name__)

supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

# ============================================================================
# ENDPOINT 1: Transition Workflow State
# ============================================================================

@router.post("/{quote_id}/transition", response_model=WorkflowTransitionResponse)
async def transition_quote_workflow(
    quote_id: UUID,
    request: WorkflowTransitionRequest,
    user: User = Depends(get_current_user)
):
    """
    Transition quote to next workflow state.

    Validates:
    - User has required role for this transition
    - Current state allows this action
    - Required fields are filled
    """
    # Get quote
    quote_result = supabase.table("quotes")\
        .select("*")\
        .eq("id", str(quote_id))\
        .eq("organization_id", str(user.current_organization_id))\
        .single()\
        .execute()

    if not quote_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found"
        )

    quote = quote_result.data

    # Get workflow settings
    settings_result = supabase.table("organization_workflow_settings")\
        .select("*")\
        .eq("organization_id", str(user.current_organization_id))\
        .single()\
        .execute()

    settings = WorkflowSettings(**settings_result.data)

    # Validate transition
    validator = WorkflowValidator(settings)
    is_valid, next_state, error = validator.validate_transition(
        from_state=quote["workflow_state"],
        action=request.action,
        user_role=user.role
    )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error
        )

    # Handle conditional states (threshold checks)
    if next_state == 'conditional':
        if quote["workflow_state"] == 'awaiting_financial_approval':
            # Check threshold after financial approval
            total_usd = Decimal(str(quote.get("total_amount", 0)))  # Assume USD for now
            required = validator.get_required_senior_approvals(total_usd)

            if required > 0:
                next_state = 'awaiting_senior_approval'
                # Update quote with approval requirements
                supabase.table("quotes").update({
                    "senior_approvals_required": required,
                    "senior_approvals_received": 0
                }).eq("id", str(quote_id)).execute()
            else:
                next_state = 'approved'

        elif quote["workflow_state"] == 'awaiting_senior_approval':
            # Count existing approvals
            current_approvals = quote.get("senior_approvals_received", 0)
            required = quote.get("senior_approvals_required", 1)

            if current_approvals + 1 >= required:
                next_state = 'approved'
            else:
                next_state = 'awaiting_senior_approval'
                # Increment approval count
                supabase.table("quotes").update({
                    "senior_approvals_received": current_approvals + 1
                }).eq("id", str(quote_id)).execute()

    # Handle parallel task flags
    if request.action == 'complete_logistics':
        supabase.table("quotes").update({
            "logistics_complete": True
        }).eq("id", str(quote_id)).execute()

        # Check if both complete
        if quote.get("customs_complete"):
            next_state = 'awaiting_sales_review'
            request.action = 'auto_transition'

    elif request.action == 'complete_customs':
        supabase.table("quotes").update({
            "customs_complete": True
        }).eq("id", str(quote_id)).execute()

        # Check if both complete
        if quote.get("logistics_complete"):
            next_state = 'awaiting_sales_review'
            request.action = 'auto_transition'

    # Update quote state
    next_assignee = get_next_assignee_role(next_state, settings.workflow_mode)

    supabase.table("quotes").update({
        "workflow_state": next_state,
        "current_assignee_role": next_assignee,
        "assigned_at": "now()"
    }).eq("id", str(quote_id)).execute()

    # Log transition
    transition_data = {
        "quote_id": str(quote_id),
        "organization_id": str(user.current_organization_id),
        "from_state": quote["workflow_state"],
        "to_state": next_state,
        "action": request.action,
        "performed_by": str(user.id),
        "role_at_transition": user.role,
        "comments": request.comments,
        "reason": request.reason
    }

    transition_result = supabase.table("quote_workflow_transitions")\
        .insert(transition_data)\
        .execute()

    return WorkflowTransitionResponse(
        quote_id=str(quote_id),
        old_state=quote["workflow_state"],
        new_state=next_state,
        transition_id=transition_result.data[0]["id"],
        next_assignee_role=next_assignee,
        message=get_transition_message(request.action, next_state)
    )

def get_next_assignee_role(state: str, mode: str) -> Optional[str]:
    """Get role that should be assigned for given state"""
    if mode == 'multi_role':
        assignments = {
            'awaiting_procurement': 'procurement_manager',
            'awaiting_logistics_customs': 'logistics_manager',  # Both logistics and customs
            'awaiting_sales_review': 'sales_manager',
            'awaiting_financial_approval': 'financial_manager',
            'awaiting_senior_approval': 'ceo',
        }
    else:  # simple mode
        assignments = {
            'awaiting_financial_approval': 'financial_manager',
            'awaiting_senior_approval': 'ceo',
        }

    return assignments.get(state)

def get_transition_message(action: str, next_state: str) -> str:
    """Generate user-friendly message for transition"""
    messages = {
        ('submit_procurement', 'awaiting_procurement'): "КП отправлен в закупки",
        ('submit_procurement', 'awaiting_logistics_customs'): "КП отправлен в логистику и таможню",
        ('complete_logistics', 'awaiting_logistics_customs'): "Логистика завершена",
        ('complete_customs', 'awaiting_logistics_customs'): "Таможня завершена",
        ('auto_transition', 'awaiting_sales_review'): "Логистика и таможня завершены - КП возвращен менеджеру",
        ('submit_approval', 'awaiting_financial_approval'): "КП отправлен на финансовое утверждение",
        ('approve', 'awaiting_senior_approval'): "Утверждено - требуется подпись руководства",
        ('approve', 'approved'): "КП утвержден",
        ('reject', 'rejected'): "КП отклонен",
        ('send_back', '*'): "КП возвращен на доработку"
    }

    key = (action, next_state)
    if key in messages:
        return messages[key]

    # Send back messages
    if action == 'send_back':
        return messages[('send_back', '*')]

    return f"Статус обновлен: {next_state}"
