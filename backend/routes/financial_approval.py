"""
Financial Approval API Endpoints

Provides endpoints for financial manager to:
- Download Financial Review Excel
- Approve quotes
- Send quotes back for revisions
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal
from datetime import datetime
from io import BytesIO
import uuid
import os

from auth import get_current_user, User
from services.financial_review_export import create_financial_review_excel
from supabase import create_client, Client

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

router = APIRouter(prefix='/api/quotes', tags=['financial-approval'])


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class ApprovalRequest(BaseModel):
    """Request to approve or send back a quote"""
    comments: Optional[str] = Field(None, max_length=500, description="Comments from financial manager")


class ApprovalResponse(BaseModel):
    """Response after approval action"""
    success: bool
    quote_id: str
    old_workflow_state: str
    new_workflow_state: str
    message: str


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get('/{quote_id}/financial-review')
async def get_financial_review_excel(
    quote_id: uuid.UUID,
    user: User = Depends(get_current_user)
):
    """
    Generate Excel file for financial manager review

    Returns Excel with:
    - Quote data (basic info, payment terms, logistics)
    - Quote totals and margins
    - Auto-validations (highlighted cells for issues)
    - Comments on problems

    **Auth:** Any authenticated user (filtered by organization_id)
    """
    try:
        # Get quote with all related data
        result = supabase.table("quotes") \
            .select("*, customer:customers(name)") \
            .eq("id", str(quote_id)) \
            .eq("organization_id", str(user.current_organization_id)) \
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quote not found"
            )

        quote = result.data[0]

        # Prepare quote data for Excel export
        # TODO: Get calculation results from calculation engine
        # For now, use quote fields directly
        quote_data = {
            'quote_number': quote.get('quote_number', ''),
            'customer_name': quote.get('customer', {}).get('name', 'Unknown') if quote.get('customer') else 'Unknown',

            # Basic info (D5-D11)
            'seller_company': quote.get('seller_company', ''),
            'offer_sale_type': quote.get('offer_sale_type', ''),
            'offer_incoterms': quote.get('offer_incoterms', ''),
            'currency_of_quote': quote.get('currency_of_quote', 'RUB'),
            'delivery_time': quote.get('delivery_time', 0),
            'advance_to_supplier': Decimal(str(quote.get('advance_to_supplier', 0))),

            # Payment terms (J5-K5)
            'advance_from_client': Decimal(str(quote.get('advance_from_client', 0))),
            'time_to_advance': quote.get('time_to_advance', 0),

            # Logistics (W2-W10)
            'logistics_supplier_hub': Decimal(str(quote.get('logistics_supplier_hub', 0))),
            'logistics_hub_customs': Decimal(str(quote.get('logistics_hub_customs', 0))),
            'logistics_customs_client': Decimal(str(quote.get('logistics_customs_client', 0))),
            'brokerage_hub': Decimal(str(quote.get('brokerage_hub', 0))),
            'brokerage_customs': Decimal(str(quote.get('brokerage_customs', 0))),
            'warehousing_at_customs': Decimal(str(quote.get('warehousing_at_customs', 0))),
            'customs_documentation': Decimal(str(quote.get('customs_documentation', 0))),
            'brokerage_extra': Decimal(str(quote.get('brokerage_extra', 0))),
            'insurance': Decimal(str(quote.get('insurance', 0))),

            # Totals (Row 13)
            'total_logistics': Decimal(str(quote.get('total_logistics', 0))),
            'total_cogs': Decimal(str(quote.get('total_cogs', 0))),
            'markup': Decimal(str(quote.get('markup', 0))),
            'total_revenue_no_vat': Decimal(str(quote.get('total_revenue_no_vat', 0))),
            'total_revenue_with_vat': Decimal(str(quote.get('total_revenue_with_vat', 0))),
            'total_amount': Decimal(str(quote.get('total_revenue_with_vat', 0))),  # Same as total_revenue_with_vat
            'total_margin': Decimal(str(quote.get('total_margin', 0))),

            # DM Fee
            'dm_fee_type': quote.get('dm_fee_type', ''),
            'dm_fee_value': Decimal(str(quote.get('dm_fee_value', 0))),

            # VAT status
            'vat_removed': quote.get('vat_removed', False),

            # Products (if any)
            'products': []  # TODO: Load from quote_items table
        }

        # Debug: Log quote data being sent to Excel generator
        print(f"[DEBUG] Generating Excel for quote {quote_data.get('quote_number')}")
        print(f"[DEBUG] Quote data keys: {list(quote_data.keys())}")
        print(f"[DEBUG] Has products: {len(quote_data.get('products', []))}")

        # Generate Excel
        try:
            workbook = create_financial_review_excel(quote_data)
            print(f"[DEBUG] Excel generation successful")
        except Exception as excel_error:
            print(f"[DEBUG] Excel generation FAILED: {type(excel_error).__name__}: {excel_error}")
            raise

        # Save to BytesIO
        output = BytesIO()
        workbook.save(output)
        output.seek(0)

        # Return as download
        # URL-encode filename to handle Russian characters (КП)
        from urllib.parse import quote
        filename = f"Financial_Review_{quote_data['quote_number']}.xlsx"
        filename_encoded = quote(filename)

        return StreamingResponse(
            output,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                'Content-Disposition': f"attachment; filename*=UTF-8''{filename_encoded}"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"[ERROR] Excel generation failed: {error_detail}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate Excel: {str(e)}"
        )


@router.post('/{quote_id}/approve')
async def approve_quote(
    quote_id: uuid.UUID,
    request: ApprovalRequest,
    user: User = Depends(get_current_user)
):
    """
    Approve quote by financial manager

    Workflow transition: awaiting_financial_approval → approved

    **Auth:** Finance Manager, Admin, Owner
    **Stores:** Comment in workflow_transitions + quotes table
    """
    try:
        # Get quote
        result = supabase.table("quotes") \
            .select("*") \
            .eq("id", str(quote_id)) \
            .eq("organization_id", str(user.current_organization_id)) \
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quote not found"
            )

        quote = result.data[0]
        old_state = quote['workflow_state']

        # Verify current state
        if old_state != 'awaiting_financial_approval':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Quote must be in 'awaiting_financial_approval' state. Current state: {old_state}"
            )

        # Update workflow state
        new_state = 'approved'
        update_result = supabase.table("quotes").update({
            "workflow_state": new_state,
            "last_financial_comment": request.comments or '',
            "financial_reviewed_at": datetime.utcnow().isoformat(),
            "financial_reviewed_by": str(user.id)
        }).eq("id", str(quote_id)).execute()

        # Record transition in workflow_transitions table
        transition_result = supabase.table("workflow_transitions").insert({
            "id": str(uuid.uuid4()),
            "quote_id": str(quote_id),
            "from_state": old_state,
            "to_state": new_state,
            "action": "approve",
            "performed_by": str(user.id),
            "role_at_transition": user.current_role or 'finance_manager',
            "comments": request.comments or '',
            "performed_at": datetime.utcnow().isoformat()
        }).execute()

        return ApprovalResponse(
            success=True,
            quote_id=str(quote_id),
            old_workflow_state=old_state,
            new_workflow_state=new_state,
            message="Quote approved by financial manager"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve quote: {str(e)}"
        )


@router.post('/{quote_id}/send-back')
async def send_back_quote(
    quote_id: uuid.UUID,
    request: ApprovalRequest,
    user: User = Depends(get_current_user)
):
    """
    Send quote back to sales manager for corrections

    Workflow transition: awaiting_financial_approval → draft

    **Auth:** Finance Manager, Admin, Owner
    **Requires:** Comments explaining what needs to be fixed
    """
    try:
        # Require comments for send back
        if not request.comments or len(request.comments.strip()) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Comments are required when sending quote back"
            )

        # Get quote
        result = supabase.table("quotes") \
            .select("*") \
            .eq("id", str(quote_id)) \
            .eq("organization_id", str(user.current_organization_id)) \
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quote not found"
            )

        quote = result.data[0]
        old_state = quote['workflow_state']

        # Verify current state
        if old_state != 'awaiting_financial_approval':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Quote must be in 'awaiting_financial_approval' state. Current state: {old_state}"
            )

        # Update workflow state
        new_state = 'draft'
        update_result = supabase.table("quotes").update({
            "workflow_state": new_state,
            "last_sendback_reason": request.comments,
            "financial_reviewed_at": datetime.utcnow().isoformat(),
            "financial_reviewed_by": str(user.id)
        }).eq("id", str(quote_id)).execute()

        # Record transition in workflow_transitions table
        transition_result = supabase.table("workflow_transitions").insert({
            "id": str(uuid.uuid4()),
            "quote_id": str(quote_id),
            "from_state": old_state,
            "to_state": new_state,
            "action": "send_back",
            "performed_by": str(user.id),
            "role_at_transition": user.current_role or 'finance_manager',
            "reason": request.comments,
            "performed_at": datetime.utcnow().isoformat()
        }).execute()

        return ApprovalResponse(
            success=True,
            quote_id=str(quote_id),
            old_workflow_state=old_state,
            new_workflow_state=new_state,
            message="Quote sent back to sales manager"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send quote back: {str(e)}"
        )
