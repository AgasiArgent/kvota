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
from dependencies import get_supabase
from services.financial_review_export import create_financial_review_excel
from supabase import Client


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
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
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
        # Get quote with all related data including calculation summaries
        result = supabase.table("quotes") \
            .select("*, customer:customers(name), calculation_summary:quote_calculation_summaries(*)") \
            .eq("id", str(quote_id)) \
            .eq("organization_id", str(user.current_organization_id)) \
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quote not found"
            )

        quote = result.data[0]
        calc_summary = quote.get('calculation_summary')

        # If calculation summary is an array (Supabase returns single-row joins as arrays), get first element
        if isinstance(calc_summary, list):
            calc_summary = calc_summary[0] if calc_summary else None

        # BUGFIX: Load input variables from quote_calculation_variables table
        # These contain the ORIGINAL input values (markup, seller_company, etc.)
        # NOT the calculated/achieved values
        calc_vars_result = supabase.table("quote_calculation_variables") \
            .select("variables") \
            .eq("quote_id", str(quote_id)) \
            .execute()

        input_vars = {}
        if calc_vars_result.data and len(calc_vars_result.data) > 0:
            input_vars = calc_vars_result.data[0].get('variables', {})
            print(f"[DEBUG] Loaded input variables: markup={input_vars.get('markup')}, seller={input_vars.get('seller_company')}")
        else:
            print(f"[WARNING] No quote_calculation_variables found for quote {quote_id}")

        # Load quote items with calculation results (include base_price_vat and supplier_country)
        items_result = supabase.table("quote_items") \
            .select("id, product_name, description, quantity, custom_fields, base_price_vat, supplier_country") \
            .eq("quote_id", str(quote_id)) \
            .order("position") \
            .execute()

        # Load calculation results for products
        calc_results = supabase.table("quote_calculation_results") \
            .select("quote_item_id, phase_results") \
            .eq("quote_id", str(quote_id)) \
            .execute()

        # Create a map of item_id -> calculation results
        calc_map = {r['quote_item_id']: r['phase_results'] for r in calc_results.data}

        # Map quote items to product format expected by Excel generator
        products = []
        # BUGFIX: Use INPUT markup from quote_calculation_variables, not calculated markup
        # Product-level markup overrides are stored in custom_fields, quote-level is default
        quote_level_markup = Decimal(str(input_vars.get('markup', 0)))

        for item in items_result.data:
            item_id = str(item['id'])
            phase_results = calc_map.get(item_id, {})

            # Extract ALL calculation results from phase_results JSON
            # This gives financial manager full transparency into cost buildup
            quantity = Decimal(str(item.get('quantity', 1)))

            # Phase 1: Purchase pricing
            purchase_price_no_vat = Decimal(str(phase_results.get('purchase_price_no_vat', 0)))
            purchase_price_after_discount = Decimal(str(phase_results.get('purchase_price_after_discount', 0)))
            purchase_price_per_unit = Decimal(str(phase_results.get('purchase_price_per_unit_quote_currency', 0)))
            purchase_price_total = Decimal(str(phase_results.get('purchase_price_total_quote_currency', 0)))

            # Phase 3: Logistics (distributed to this product)
            logistics_total = Decimal(str(phase_results.get('logistics_total', 0)))

            # Phase 4: Customs & taxes
            customs_fee = Decimal(str(phase_results.get('customs_fee', 0)))
            excise_tax = Decimal(str(phase_results.get('excise_tax_amount', 0)))

            # Phase 9: Financing costs
            financing_cost_initial = Decimal(str(phase_results.get('financing_cost_initial', 0)))
            financing_cost_credit = Decimal(str(phase_results.get('financing_cost_credit', 0)))
            financing_cost_total = financing_cost_initial + financing_cost_credit

            # Phase 10: COGS
            cogs_per_unit = Decimal(str(phase_results.get('cogs_per_unit', 0)))
            cogs_total = Decimal(str(phase_results.get('cogs_per_product', 0)))

            # Phase 12-13: Sales pricing
            sales_price_no_vat = Decimal(str(phase_results.get('sales_price_total_no_vat', 0)))
            sales_price_with_vat = Decimal(str(phase_results.get('sales_price_total_with_vat', 0)))
            profit = Decimal(str(phase_results.get('profit', 0)))

            # BUGFIX: Use INPUT markup value, not calculated
            # Check for product-level markup override in custom_fields
            custom_fields = item.get('custom_fields', {})
            product_markup = custom_fields.get('markup') if custom_fields else None

            # Use product override if exists, otherwise use quote-level default
            if product_markup is not None:
                markup = Decimal(str(product_markup))
            else:
                markup = quote_level_markup

            # Use product_name if available, fallback to description
            product_name = item.get('product_name') or item.get('description') or 'Unnamed Product'

            products.append({
                'name': product_name,
                'quantity': int(quantity),
                'markup': markup,
                # VAT Removal Indicator fields (NEW - from quote_items + calculation results)
                'supplier_country': item.get('supplier_country', 'N/A'),
                'base_price_vat': Decimal(str(item.get('base_price_vat', 0))),
                'calc_n16_price_without_vat': Decimal(str(phase_results.get('purchase_price_no_vat', 0))),
                # Purchase pricing (supplier → quote currency)
                'purchase_price_supplier': purchase_price_no_vat,  # Original supplier price
                'purchase_price_after_discount': purchase_price_after_discount,
                'purchase_price_per_unit': purchase_price_per_unit,
                'purchase_price_total': purchase_price_total,
                # Cost components
                'logistics': logistics_total,
                'customs_fee': customs_fee,
                'excise_tax': excise_tax,
                'financing': financing_cost_total,
                # Total costs
                'cogs_per_unit': cogs_per_unit,
                'cogs': cogs_total,
                # Sales pricing
                'price_no_vat': sales_price_no_vat,
                'price_with_vat': sales_price_with_vat,
                'profit': profit,
            })

        # Get calculation results from quote_calculation_summaries table
        # If no calculation summary exists, use zeros (quote hasn't been calculated yet)
        if calc_summary:
            total_logistics = Decimal(str(calc_summary.get('calc_v16_total_logistics', 0)))
            total_cogs = Decimal(str(calc_summary.get('calc_ab16_cogs_total', 0)))
            total_revenue_no_vat = Decimal(str(calc_summary.get('calc_ae16_sale_price_total', 0)))
            total_revenue_with_vat = Decimal(str(calc_summary.get('calc_al16_total_with_vat', 0)))
            dm_fee_value = Decimal(str(calc_summary.get('calc_ag16_dm_fee', 0)))

            # BUGFIX: Use INPUT markup from quote_calculation_variables
            # NOT the calculated profit margin converted back to markup!
            markup = Decimal(str(input_vars.get('markup', 0)))

            # Calculate total margin = revenue - cogs
            total_margin = total_revenue_no_vat - total_cogs
        else:
            # No calculation results yet - use zeros
            total_logistics = Decimal('0')
            total_cogs = Decimal('0')
            total_revenue_no_vat = Decimal('0')
            total_revenue_with_vat = Decimal('0')
            dm_fee_value = Decimal('0')
            # BUGFIX: Even with no calc results, use INPUT markup
            markup = Decimal(str(input_vars.get('markup', 0)))
            total_margin = Decimal('0')

        # Prepare quote data for Excel export
        quote_data = {
            'idn_quote': quote.get('idn_quote', ''),
            'customer_name': quote.get('customer', {}).get('name', 'Unknown') if quote.get('customer') else 'Unknown',

            # BUGFIX: Use INPUT variables from quote_calculation_variables, not from quotes table
            # Basic info (D5-D11)
            'seller_company': input_vars.get('seller_company', ''),
            'offer_sale_type': input_vars.get('offer_sale_type', ''),
            'offer_incoterms': input_vars.get('offer_incoterms', ''),
            'currency_of_quote': input_vars.get('currency_of_quote', 'RUB'),
            'delivery_time': input_vars.get('delivery_time', 0),
            'advance_to_supplier': Decimal(str(input_vars.get('advance_to_supplier', 0))),

            # Payment terms (J5-K5)
            'advance_from_client': Decimal(str(input_vars.get('advance_from_client', 0))),
            'time_to_advance': input_vars.get('time_to_advance', 0),

            # Logistics (W2-W10)
            'logistics_supplier_hub': Decimal(str(input_vars.get('logistics_supplier_hub', 0))),
            'logistics_hub_customs': Decimal(str(input_vars.get('logistics_hub_customs', 0))),
            'logistics_customs_client': Decimal(str(input_vars.get('logistics_customs_client', 0))),
            'brokerage_hub': Decimal(str(input_vars.get('brokerage_hub', 0))),
            'brokerage_customs': Decimal(str(input_vars.get('brokerage_customs', 0))),
            'warehousing_at_customs': Decimal(str(input_vars.get('warehousing_at_customs', 0))),
            'customs_documentation': Decimal(str(input_vars.get('customs_documentation', 0))),
            'brokerage_extra': Decimal(str(input_vars.get('brokerage_extra', 0))),
            'insurance': Decimal(str(input_vars.get('insurance', 0))),

            # Totals (Row 13) - From calculation_summary
            'total_logistics': total_logistics,
            'total_cogs': total_cogs,
            'markup': markup,
            'total_revenue_no_vat': total_revenue_no_vat,
            'total_revenue_with_vat': total_revenue_with_vat,
            'total_amount': total_revenue_with_vat,  # Same as total_revenue_with_vat
            'total_margin': total_margin,

            # DM Fee - Type from input_vars, value from calculation_summary
            'dm_fee_type': input_vars.get('dm_fee_type', ''),
            'dm_fee_value': dm_fee_value,

            # VAT status
            'vat_removed': quote.get('vat_removed', False),

            # Products loaded from quote_items
            'products': products
        }

        # Debug: Log quote data being sent to Excel generator
        print(f"[DEBUG] Generating Excel for quote {quote_data.get('idn_quote')}")
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
        filename = f"Financial_Review_{quote_data['idn_quote']}.xlsx"
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


@router.post('/{quote_id}/financial-approve')
async def approve_quote(
    quote_id: uuid.UUID,
    request: ApprovalRequest,
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Approve quote by financial manager (Financial Approval Workflow)

    Workflow transition: awaiting_financial_approval → approved

    **Auth:** Finance Manager, Admin, Owner
    **Stores:** Comment in workflow_transitions + quotes table
    **Path:** POST /api/quotes/{id}/financial-approve (not /approve - that's for old approval system)
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

        # Record transition in quote_workflow_transitions table
        transition_result = supabase.table("quote_workflow_transitions").insert({
            "id": str(uuid.uuid4()),
            "quote_id": str(quote_id),
            "organization_id": str(user.current_organization_id),
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


@router.post('/{quote_id}/financial-send-back')
async def send_back_quote(
    quote_id: uuid.UUID,
    request: ApprovalRequest,
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Send quote back to sales manager for corrections (Financial Approval Workflow)

    Workflow transition: awaiting_financial_approval → draft

    **Auth:** Finance Manager, Admin, Owner
    **Requires:** Comments explaining what needs to be fixed
    **Path:** POST /api/quotes/{id}/financial-send-back (not /send-back - avoids conflicts)
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

        # Record transition in quote_workflow_transitions table
        transition_result = supabase.table("quote_workflow_transitions").insert({
            "id": str(uuid.uuid4()),
            "quote_id": str(quote_id),
            "organization_id": str(user.current_organization_id),
            "from_state": old_state,
            "to_state": new_state,
            "action": "send_back",
            "performed_by": str(user.id),
            "role_at_transition": user.current_role or 'finance_manager',
            "comments": request.comments,
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
