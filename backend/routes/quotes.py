"""
Quote Management Routes - Russian B2B Quotation System
Multi-manager approval workflow with status transitions
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Depends, Query, status
from fastapi.responses import JSONResponse

from auth import get_current_user, User, require_permission, require_manager_or_above
from models import (
    Quote, QuoteCreate, QuoteUpdate, QuoteWithItems,
    QuoteItem, QuoteItemCreate, QuoteItemUpdate,
    QuoteApproval, QuoteApprovalCreate, QuoteApprovalUpdate,
    QuoteListResponse, ApprovalWorkflowRequest,
    QuoteStatus, ApprovalStatus, ApprovalType,
    SuccessResponse, ErrorResponse
)
from pdf_service import QuotePDFService
from file_service import file_processor
from fastapi.responses import Response
from fastapi import File, UploadFile
import os


# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(
    prefix="/api/quotes",
    tags=["quotes"],
    dependencies=[Depends(get_current_user)]
)


# ============================================================================
# DATABASE HELPER FUNCTIONS
# ============================================================================

def get_supabase_client():
    """Get Supabase client for database operations"""
    from supabase import create_client, Client

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase configuration missing"
        )

    return create_client(supabase_url, supabase_key)


async def get_db_connection():
    """Get database connection with proper error handling"""
    import asyncpg
    try:
        # Use POSTGRES_DIRECT_URL for asyncpg (pooler URL has parsing issues)
        db_url = os.getenv("POSTGRES_DIRECT_URL") or os.getenv("DATABASE_URL")
        return await asyncpg.connect(db_url)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connection failed: {str(e)}"
        )


async def set_rls_context(conn, user: User):
    """Set Row Level Security context for database queries"""
    await conn.execute(
        "SELECT set_config('request.jwt.claims', $1, true)",
        f'{{"sub": "{user.id}", "role": "authenticated"}}'
    )


async def validate_quote_access(conn, quote_id: UUID, user: User, action: str = "view"):
    """
    Validate user access to quote based on RLS and business rules
    Returns quote data if access is granted
    """
    # Select all fields explicitly to ensure new columns are included
    query = """
        SELECT q.id, q.organization_id, q.customer_id, q.created_by,
               q.quote_number, q.title, q.description, q.status,
               q.quote_date, q.valid_until,
               q.subtotal, q.discount_percentage, q.discount_amount,
               q.tax_rate, q.tax_amount, q.total_amount,
               q.notes, q.terms_conditions,
               q.created_at, q.updated_at, q.deleted_at
        FROM quotes q
        WHERE q.id = $1
    """

    row = await conn.fetchrow(query, quote_id)
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quote {quote_id} not found or access denied"
        )
    
    # Additional business rule validations
    quote_data = dict(row)

    if action == "edit" and quote_data['status'] not in ['draft', 'revision_needed']:
        if quote_data['created_by'] != user.id:  # Not the quote creator (database field is created_by, not user_id)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only edit quotes in draft or revision_needed status"
            )

    return quote_data


# ============================================================================
# QUOTE CRUD OPERATIONS
# ============================================================================

@router.get("/")
async def list_quotes(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    quote_status: Optional[str] = Query(None, description="Filter by quote status"),
    customer_id: Optional[UUID] = Query(None, description="Filter by customer"),
    date_from: Optional[date] = Query(None, description="Filter quotes from date"),
    date_to: Optional[date] = Query(None, description="Filter quotes to date"),
    currency: Optional[str] = Query(None, description="Filter by currency"),
    min_amount: Optional[float] = Query(None, description="Minimum total amount"),
    max_amount: Optional[float] = Query(None, description="Maximum total amount"),
    search: Optional[str] = Query(None, description="Search in quote number, customer name, or title"),
    user: User = Depends(get_current_user)
):
    """
    List quotes with filtering and pagination

    Uses Supabase client for database operations (RLS enforced automatically)
    """
    try:
        supabase = get_supabase_client()

        # Build query with joins, exclude soft-deleted quotes
        # Explicitly list fields to ensure new columns are included
        query = supabase.table("quotes").select(
            "id, quote_number, customer_id, title, description, status, "
            "quote_date, valid_until, "
            "subtotal, discount_percentage, discount_amount, tax_rate, tax_amount, total_amount, "
            "notes, terms_conditions, created_at, updated_at, deleted_at, "
            "customers(name)",
            count="exact"
        ).eq("organization_id", user.current_organization_id).is_("deleted_at", "null")

        # Apply filters
        if quote_status:
            query = query.eq("status", quote_status)
        if customer_id:
            query = query.eq("customer_id", str(customer_id))
        if date_from:
            query = query.gte("quote_date", date_from.isoformat())
        if date_to:
            query = query.lte("quote_date", date_to.isoformat())
        if currency:
            query = query.eq("currency", currency)
        if min_amount:
            query = query.gte("total_amount", min_amount)
        if max_amount:
            query = query.lte("total_amount", max_amount)
        if search:
            # Search in quote_number, customer name, or title
            query = query.or_(
                f"quote_number.ilike.%{search}%,"
                f"title.ilike.%{search}%"
            )

        # Apply pagination
        offset = (page - 1) * limit
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)

        # Execute query
        result = query.execute()

        total = result.count if result.count is not None else 0
        total_pages = (total + limit - 1) // limit if total > 0 else 0

        # Transform data for response
        quotes_data = []
        for quote in result.data:
            quotes_data.append({
                "id": quote["id"],
                "quote_number": quote["quote_number"],
                "customer_name": quote["customers"]["name"] if quote.get("customers") else "",
                "title": quote.get("title", ""),
                "status": quote["status"],
                "total_amount": quote.get("total_amount", 0),
                "quote_date": quote.get("quote_date"),
                "valid_until": quote.get("valid_until"),
                "created_at": quote["created_at"]
            })

        return {
            "quotes": quotes_data,
            "total": total,
            "page": page,
            "limit": limit,
            "has_more": page < total_pages
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch quotes: {str(e)}"
        )


@router.post("/", response_model=Quote)
async def create_quote(
    quote_data: QuoteCreate,
    user: User = Depends(require_permission("quotes:create"))
):
    """
    Create a new quote
    
    Automatically assigns the current user as the quote creator
    """
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)
        
        # Validate customer exists if customer_id provided
        if quote_data.customer_id:
            customer_exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM customers WHERE id = $1)",
                quote_data.customer_id
            )
            if not customer_exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Customer {quote_data.customer_id} not found"
                )
        
        # Insert new quote (quote_number will be auto-generated by trigger)
        query = """
            INSERT INTO quotes (
                user_id, customer_id, customer_name, customer_email, customer_address,
                title, description, currency, exchange_rate, discount_type, discount_rate,
                discount_amount, vat_rate, vat_included, import_duty_rate, credit_rate,
                quote_date, valid_until, delivery_date, payment_terms, delivery_terms,
                warranty_terms, notes, internal_notes, requires_approval, required_approvers,
                approval_type
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
            ) RETURNING *
        """
        
        row = await conn.fetchrow(
            query,
            user.id,  # Current user as quote creator
            quote_data.customer_id,
            quote_data.customer_name,
            quote_data.customer_email,
            quote_data.customer_address,
            quote_data.title,
            quote_data.description,
            quote_data.currency,
            quote_data.exchange_rate,
            quote_data.discount_type,
            quote_data.discount_rate,
            quote_data.discount_amount,
            quote_data.vat_rate,
            quote_data.vat_included,
            quote_data.import_duty_rate,
            quote_data.credit_rate,
            quote_data.quote_date,
            quote_data.valid_until,
            quote_data.delivery_date,
            quote_data.payment_terms,
            quote_data.delivery_terms,
            quote_data.warranty_terms,
            quote_data.notes,
            quote_data.internal_notes,
            quote_data.requires_approval,
            quote_data.required_approvers,
            quote_data.approval_type
        )
        
        return Quote(**dict(row))
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create quote: {str(e)}"
        )
    finally:
        await conn.close()


@router.get("/{quote_id}", response_model=QuoteWithItems)
async def get_quote(
    quote_id: UUID,
    user: User = Depends(get_current_user)
):
    """Get quote with all items and approval information"""
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)
        
        # Validate access and get quote
        quote_data = await validate_quote_access(conn, quote_id, user, "view")
        quote = Quote(**quote_data)

        # Get customer information if customer_id exists
        customer = None
        if quote.customer_id:
            customer_row = await conn.fetchrow("""
                SELECT id, name, email, phone, address, city, region, country,
                       inn, kpp, ogrn, company_type, industry, notes,
                       created_at, updated_at
                FROM customers
                WHERE id = $1
            """, quote.customer_id)
            if customer_row:
                customer_dict = dict(customer_row)
                # Map 'name' to 'company_name' for frontend compatibility
                customer_dict['company_name'] = customer_dict.get('name')
                customer = customer_dict

        # Get quote items with field mapping
        items_rows = await conn.fetch("""
            SELECT
                id, quote_id, position,
                product_name as description,
                product_code,
                brand,
                sku,
                quantity::numeric as quantity,
                unit,
                base_price_vat as unit_price,
                weight_in_kg,
                supplier_country as country_of_origin,
                customs_code,
                created_at, updated_at
            FROM quote_items
            WHERE quote_id = $1
            ORDER BY position ASC, created_at ASC
        """, quote_id)

        # Map database rows to QuoteItem model with defaults for missing fields
        items = []
        for row in items_rows:
            item_dict = dict(row)
            # Add required fields with defaults if missing
            item_dict.setdefault('discount_type', 'percentage')
            item_dict.setdefault('discount_rate', 0)
            item_dict.setdefault('discount_amount', 0)
            item_dict.setdefault('vat_rate', 20)
            item_dict.setdefault('import_duty_rate', 0)

            # Add frontend-compatible fields
            item_dict['name'] = item_dict.get('description')  # Frontend expects 'name'
            item_dict['final_price'] = item_dict.get('unit_price')  # Frontend expects 'final_price'

            items.append(QuoteItem(**item_dict))

        # Get calculation results for all items
        calc_results_rows = await conn.fetch("""
            SELECT qcr.quote_item_id, qcr.phase_results, qcr.calculated_at
            FROM quote_calculation_results qcr
            WHERE qcr.quote_id = $1
        """, quote_id)

        # Create a map of item_id -> calculation results
        calc_results_map = {str(row['quote_item_id']): dict(row) for row in calc_results_rows}

        # Attach calculation results to each item and extract final selling price
        for item in items:
            item_id_str = str(item.id)
            if item_id_str in calc_results_map:
                # Add calculation results as extra attributes
                phase_results_raw = calc_results_map[item_id_str]['phase_results']

                # Parse JSON string to dict if needed
                import json
                if isinstance(phase_results_raw, str):
                    phase_results = json.loads(phase_results_raw)
                else:
                    phase_results = phase_results_raw

                item.calculation_results = phase_results
                item.calculated_at = calc_results_map[item_id_str]['calculated_at']

                # Extract final selling price from calculation results
                # The selling price is stored as 'sales_price_per_unit_with_vat' at root level
                if phase_results and isinstance(phase_results, dict):
                    selling_price = phase_results.get('sales_price_per_unit_with_vat')
                    if selling_price is not None:
                        item.final_price = Decimal(str(selling_price))
            else:
                item.calculation_results = None
                item.calculated_at = None

        # Get approval information (if quote_approvals table exists)
        approvals = []
        try:
            approvals_rows = await conn.fetch("""
                SELECT qa.*,
                       u.email as approver_email,
                       up.raw_user_meta_data->>'full_name' as approver_name
                FROM quote_approvals qa
                JOIN auth.users u ON qa.approver_id = u.id
                LEFT JOIN auth.users up ON qa.approver_id = up.id
                WHERE qa.quote_id = $1
                ORDER BY qa.approval_order ASC, qa.assigned_at ASC
            """, quote_id)

            for row in approvals_rows:
                approval_dict = dict(row)
                # Remove non-model fields
                approval_dict.pop('approver_email', None)
                approval_dict.pop('approver_name', None)
                approval = QuoteApproval(**approval_dict)
                # Add extra info for frontend
                approval.approver_email = row['approver_email']
                approval.approver_name = row['approver_name']
                approvals.append(approval)
        except Exception:
            # quote_approvals table doesn't exist yet (stub feature)
            pass
        
        # Create response with items, customer, and approvals
        quote_response = QuoteWithItems(**quote.dict())
        quote_response.items = items
        quote_response.customer = customer
        quote_response.approvals = approvals

        return quote_response
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"ERROR in get_quote: {str(e)}")
        print(f"Traceback:\n{error_traceback}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve quote: {str(e)}"
        )
    finally:
        await conn.close()


@router.put("/{quote_id}", response_model=Quote)
async def update_quote(
    quote_id: UUID,
    quote_update: QuoteUpdate,
    user: User = Depends(get_current_user)
):
    """
    Update quote information
    
    Only quote creators can update quotes in draft or revision_needed status
    """
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)
        
        # Validate access and editability
        quote_data = await validate_quote_access(conn, quote_id, user, "edit")
        
        # Check if customer exists if customer_id is being updated
        if quote_update.customer_id and quote_update.customer_id != quote_data.get('customer_id'):
            customer_exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM customers WHERE id = $1)",
                quote_update.customer_id
            )
            if not customer_exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Customer {quote_update.customer_id} not found"
                )
        
        # Build dynamic UPDATE query
        update_fields = []
        params = []
        param_count = 0
        
        # Get only fields that are provided in the update
        update_data = quote_update.dict(exclude_unset=True)
        
        for field, value in update_data.items():
            param_count += 1
            update_fields.append(f"{field} = ${param_count}")
            params.append(value)
        
        if not update_fields:
            # No fields to update, return existing quote
            return Quote(**quote_data)
        
        # Add quote_id parameter
        param_count += 1
        params.append(quote_id)
        
        query = f"""
            UPDATE quotes 
            SET {', '.join(update_fields)}, updated_at = TIMEZONE('utc', NOW())
            WHERE id = ${param_count}
            RETURNING *
        """
        
        row = await conn.fetchrow(query, *params)
        return Quote(**dict(row))
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update quote: {str(e)}"
        )
    finally:
        await conn.close()


@router.delete("/{quote_id}", response_model=SuccessResponse)
async def delete_quote(
    quote_id: UUID,
    user: User = Depends(get_current_user)
):
    """
    Delete quote

    Only quote creators can delete quotes in draft status
    """
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)

        # Validate access
        quote_data = await validate_quote_access(conn, quote_id, user, "edit")

        # Only allow deletion of draft quotes
        if quote_data['status'] != 'draft':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only delete quotes in draft status"
            )

        # Only quote creator can delete
        if quote_data['created_by'] != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only quote creator can delete quote"
            )

        # Delete quote (CASCADE will delete items and approvals)
        deleted = await conn.fetchval(
            "DELETE FROM quotes WHERE id = $1 RETURNING id",
            quote_id
        )

        return SuccessResponse(
            message=f"Quote {quote_data['quote_number']} deleted successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete quote: {str(e)}"
        )
    finally:
        await conn.close()


# ============================================================================
# SOFT DELETE & RESTORATION
# ============================================================================

@router.patch("/{quote_id}/soft-delete", response_model=SuccessResponse)
async def soft_delete_quote(
    quote_id: UUID,
    user: User = Depends(get_current_user)
):
    """
    Soft delete quote (move to bin)

    Sets deleted_at timestamp without permanently removing data
    """
    try:
        supabase = get_supabase_client()

        # Verify quote exists and user has access
        result = supabase.table("quotes").select("id, quote_number, organization_id, deleted_at").eq("id", str(quote_id)).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quote not found or access denied"
            )

        quote = result.data[0]

        # Verify organization access
        if quote["organization_id"] != str(user.current_organization_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Check if already soft-deleted
        if quote.get("deleted_at"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Quote is already in bin"
            )

        # Soft delete by setting deleted_at
        update_result = supabase.table("quotes").update({
            "deleted_at": datetime.utcnow().isoformat()
        }).eq("id", str(quote_id)).execute()

        return SuccessResponse(
            message="Quote moved to bin"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to soft delete quote: {str(e)}"
        )


@router.patch("/{quote_id}/restore", response_model=SuccessResponse)
async def restore_quote(
    quote_id: UUID,
    user: User = Depends(get_current_user)
):
    """
    Restore soft-deleted quote from bin

    Clears deleted_at timestamp to restore access
    """
    try:
        supabase = get_supabase_client()

        # Verify quote exists and user has access
        result = supabase.table("quotes").select("id, quote_number, organization_id, deleted_at").eq("id", str(quote_id)).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quote not found or access denied"
            )

        quote = result.data[0]

        # Verify organization access
        if quote["organization_id"] != str(user.current_organization_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Check if quote is actually soft-deleted
        if not quote.get("deleted_at"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Quote is not in bin"
            )

        # Restore by clearing deleted_at
        update_result = supabase.table("quotes").update({
            "deleted_at": None
        }).eq("id", str(quote_id)).execute()

        return SuccessResponse(
            message="Quote restored"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to restore quote: {str(e)}"
        )


@router.delete("/{quote_id}/permanent", response_model=SuccessResponse)
async def permanently_delete_quote(
    quote_id: UUID,
    user: User = Depends(get_current_user)
):
    """
    Permanently delete quote

    Only allowed for quotes that are already soft-deleted (in bin)
    This operation cannot be undone
    """
    try:
        supabase = get_supabase_client()

        # Verify quote exists and user has access
        result = supabase.table("quotes").select("id, quote_number, organization_id, deleted_at").eq("id", str(quote_id)).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quote not found or access denied"
            )

        quote = result.data[0]

        # Verify organization access
        if quote["organization_id"] != str(user.current_organization_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Only allow permanent deletion if quote is soft-deleted
        if not quote.get("deleted_at"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Quote must be in bin before permanent deletion. Use soft-delete first."
            )

        # Permanently delete quote (CASCADE will delete quote_items and quote_approvals)
        delete_result = supabase.table("quotes").delete().eq("id", str(quote_id)).execute()

        return SuccessResponse(
            message="Quote permanently deleted"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to permanently delete quote: {str(e)}"
        )


@router.get("/bin")
async def list_bin_quotes(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    user: User = Depends(get_current_user)
):
    """
    List soft-deleted quotes (bin)

    Shows quotes that have been moved to bin and can be restored or permanently deleted

    NOTE: Soft-deleted quotes older than 7 days are automatically cleaned up.
    This is handled by a scheduled cron job or Supabase Edge Function that runs:
    DELETE FROM quotes WHERE deleted_at < NOW() - INTERVAL '7 days'
    """
    try:
        supabase = get_supabase_client()

        # Build query for soft-deleted quotes
        # Explicitly list fields to ensure new columns are included
        query = supabase.table("quotes").select(
            "id, quote_number, customer_id, title, description, status, "
            "quote_date, valid_until, "
            "subtotal, discount_percentage, discount_amount, tax_rate, tax_amount, total_amount, "
            "notes, terms_conditions, created_at, updated_at, deleted_at, "
            "customers(name)",
            count="exact"
        ).eq("organization_id", user.current_organization_id).not_.is_("deleted_at", "null")

        # Apply pagination
        offset = (page - 1) * limit
        query = query.order("deleted_at", desc=True).range(offset, offset + limit - 1)

        # Execute query
        result = query.execute()

        total = result.count if result.count is not None else 0
        total_pages = (total + limit - 1) // limit if total > 0 else 0

        # Transform data for response
        quotes_data = []
        for quote in result.data:
            quotes_data.append({
                "id": quote["id"],
                "quote_number": quote["quote_number"],
                "customer_name": quote["customers"]["name"] if quote.get("customers") else "",
                "title": quote.get("title", ""),
                "status": quote["status"],
                "total_amount": quote.get("total_amount", 0),
                "quote_date": quote.get("quote_date"),
                "valid_until": quote.get("valid_until"),
                "created_at": quote["created_at"],
                "deleted_at": quote["deleted_at"]  # Include deletion timestamp
            })

        return {
            "quotes": quotes_data,
            "total": total,
            "page": page,
            "limit": limit,
            "has_more": page < total_pages
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch bin quotes: {str(e)}"
        )


# ============================================================================
# QUOTE ITEM MANAGEMENT
# ============================================================================

@router.post("/{quote_id}/items", response_model=QuoteItem)
async def add_quote_item(
    quote_id: UUID,
    item_data: QuoteItemCreate,
    user: User = Depends(get_current_user)
):
    """Add item to quote"""
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)
        
        # Validate quote access and editability - FIXED: Remove the quote_data usage
        # Just validate access without storing the result if not needed
        quote_data = await validate_quote_access(conn, quote_id, user, "edit")
        
        # Ensure item's quote_id matches URL parameter
        if item_data.quote_id != quote_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Quote ID in item data must match URL parameter"
            )
        
        # Insert new item (calculations will be handled by database trigger)
        query = """
            INSERT INTO quote_items (
                quote_id, description, product_code, category, brand, model,
                country_of_origin, manufacturer, quantity, unit, unit_cost, unit_price,
                discount_type, discount_rate, discount_amount, vat_rate, import_duty_rate,
                lead_time_days, delivery_notes, position, notes
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
            ) RETURNING *
        """
        
        row = await conn.fetchrow(
            query,
            item_data.quote_id, 
            item_data.description, 
            item_data.product_code,
            item_data.category, 
            item_data.brand, 
            item_data.model,
            item_data.country_of_origin, 
            item_data.manufacturer,
            item_data.quantity, 
            item_data.unit, 
            item_data.unit_cost, 
            item_data.unit_price,
            item_data.discount_type,
            item_data.discount_rate,
            item_data.discount_amount,
            item_data.vat_rate,
            item_data.import_duty_rate,
            item_data.lead_time_days,
            item_data.delivery_notes,
            item_data.position,
            item_data.notes
        )
        
        return QuoteItem(**dict(row))
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add quote item: {str(e)}"
        )
    finally:
        await conn.close()


@router.put("/{quote_id}/items/{item_id}", response_model=QuoteItem)
async def update_quote_item(
    quote_id: UUID,
    item_id: UUID,
    item_update: QuoteItemUpdate,
    user: User = Depends(get_current_user)
):
    """Update quote item"""
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)
        
        # Validate quote access
        await validate_quote_access(conn, quote_id, user, "edit")
        
        # Verify item belongs to this quote
        item_exists = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM quote_items WHERE id = $1 AND quote_id = $2)",
            item_id, quote_id
        )
        
        if not item_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Quote item {item_id} not found in quote {quote_id}"
            )
        
        # Build dynamic UPDATE query
        update_fields = []
        params = []
        param_count = 0
        
        update_data = item_update.dict(exclude_unset=True)
        
        for field, value in update_data.items():
            param_count += 1
            update_fields.append(f"{field} = ${param_count}")
            params.append(value)
        
        if not update_fields:
            # No fields to update, return existing item
            row = await conn.fetchrow("SELECT * FROM quote_items WHERE id = $1", item_id)
            return QuoteItem(**dict(row))
        
        # Add item_id parameter
        param_count += 1
        params.append(item_id)
        
        query = f"""
            UPDATE quote_items 
            SET {', '.join(update_fields)}, updated_at = TIMEZONE('utc', NOW())
            WHERE id = ${param_count}
            RETURNING *
        """
        
        row = await conn.fetchrow(query, *params)
        return QuoteItem(**dict(row))
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update quote item: {str(e)}"
        )
    finally:
        await conn.close()


@router.delete("/{quote_id}/items/{item_id}", response_model=SuccessResponse)
async def delete_quote_item(
    quote_id: UUID,
    item_id: UUID,
    user: User = Depends(get_current_user)
):
    """Delete quote item"""
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)
        
        # Validate quote access
        await validate_quote_access(conn, quote_id, user, "edit")
        
        # Delete item
        deleted = await conn.fetchval(
            "DELETE FROM quote_items WHERE id = $1 AND quote_id = $2 RETURNING id",
            item_id, quote_id
        )
        
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Quote item {item_id} not found in quote {quote_id}"
            )
        
        return SuccessResponse(
            message=f"Quote item deleted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete quote item: {str(e)}"
        )
    finally:
        await conn.close()


# ============================================================================
# MULTI-MANAGER APPROVAL WORKFLOW
# ============================================================================

@router.post("/{quote_id}/submit-for-approval", response_model=SuccessResponse)
async def submit_quote_for_approval(
    quote_id: UUID,
    approval_request: ApprovalWorkflowRequest,
    user: User = Depends(get_current_user)
):
    """
    Submit quote for multi-manager approval
    
    Sets up the approval workflow with specified managers
    """
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)
        
        # Validate quote access and that it's in draft status
        quote_data = await validate_quote_access(conn, quote_id, user, "edit")
        
        if quote_data['status'] != 'draft':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only submit draft quotes for approval"
            )

        if quote_data['created_by'] != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only quote creator can submit for approval"
            )
        
        # Verify all approvers exist and have manager permissions
        approvers_check = await conn.fetch("""
            SELECT id, email, raw_user_meta_data->>'role' as role
            FROM auth.users 
            WHERE id = ANY($1)
        """, approval_request.approver_ids)
        
        found_ids = [row['id'] for row in approvers_check]
        missing_ids = set(approval_request.approver_ids) - set(found_ids)
        
        if missing_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Approvers not found: {missing_ids}"
            )
        
        # Start transaction for atomic workflow setup
        async with conn.transaction():
            # Update quote status and approval settings
            await conn.execute("""
                UPDATE quotes 
                SET status = 'pending_approval',
                    requires_approval = true,
                    required_approvers = $2,
                    approval_type = $3,
                    submitted_for_approval_at = TIMEZONE('utc', NOW())
                WHERE id = $1
            """, quote_id, len(approval_request.approver_ids), approval_request.approval_type)
            
            # Create approval records
            for order, approver_id in enumerate(approval_request.approver_ids, 1):
                await conn.execute("""
                    INSERT INTO quote_approvals (quote_id, approver_id, approval_order)
                    VALUES ($1, $2, $3)
                """, quote_id, approver_id, order)
        
        # TODO: Send notification emails to approvers
        
        return SuccessResponse(
            message=f"Quote {quote_data['quote_number']} submitted for approval to {len(approval_request.approver_ids)} managers"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit quote for approval: {str(e)}"
        )
    finally:
        await conn.close()


@router.post("/{quote_id}/approve", response_model=SuccessResponse)
async def approve_quote(
    quote_id: UUID,
    approval_update: QuoteApprovalUpdate,
    user: User = Depends(require_manager_or_above())
):
    """
    Approve quote (manager access required)
    
    Updates approval status and triggers quote status recalculation
    """
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)
        
        # Verify user has pending approval for this quote
        approval_record = await conn.fetchrow("""
            SELECT * FROM quote_approvals 
            WHERE quote_id = $1 AND approver_id = $2 AND approval_status = 'pending'
        """, quote_id, user.id)
        
        if not approval_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No pending approval found for this quote and user"
            )
        
        # Update approval record
        await conn.execute("""
            UPDATE quote_approvals 
            SET approval_status = $3,
                decision_notes = $4,
                revision_notes = $5,
                decided_at = TIMEZONE('utc', NOW())
            WHERE id = $1 AND approver_id = $2
        """, 
        approval_record['id'], user.id,
        approval_update.approval_status,
        approval_update.decision_notes,
        approval_update.revision_notes)
        
        # Get updated quote status (database trigger will recalculate)
        updated_quote = await conn.fetchrow(
            "SELECT quote_number, status FROM quotes WHERE id = $1",
            quote_id
        )
        
        # TODO: Send notification emails based on new status
        
        return SuccessResponse(
            message=f"Quote {updated_quote['quote_number']} {approval_update.approval_status}. New status: {updated_quote['status']}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve quote: {str(e)}"
        )
    finally:
        await conn.close()


@router.get("/pending-approval", response_model=QuoteListResponse)
async def get_quotes_pending_approval(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(require_manager_or_above())
):
    """
    Get quotes pending approval by current user
    
    Only returns quotes where the current user has a pending approval
    """
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)
        
        # Count total pending approvals for this user
        total = await conn.fetchval("""
            SELECT COUNT(*)
            FROM quotes q
            JOIN quote_approvals qa ON q.id = qa.quote_id
            WHERE qa.approver_id = $1 AND qa.approval_status = 'pending'
        """, user.id)
        
        # Get paginated results
        offset = (page - 1) * limit
        rows = await conn.fetch("""
            SELECT q.*, qa.assigned_at, qa.approval_order
            FROM quotes q
            JOIN quote_approvals qa ON q.id = qa.quote_id
            WHERE qa.approver_id = $1 AND qa.approval_status = 'pending'
            ORDER BY qa.assigned_at ASC, q.created_at DESC
            LIMIT $2 OFFSET $3
        """, user.id, limit, offset)
        
        quotes = []
        for row in rows:
            quote_dict = dict(row)
            # Remove approval-specific fields
            quote_dict.pop('assigned_at', None)
            quote_dict.pop('approval_order', None)
            quotes.append(Quote(**quote_dict))
        
        return QuoteListResponse(
            quotes=quotes,
            total=total,
            page=page,
            limit=limit,
            has_more=offset + limit < total
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve pending approvals: {str(e)}"
        )
    finally:
        await conn.close()


# ============================================================================
# QUOTE STATUS OPERATIONS
# ============================================================================

@router.post("/{quote_id}/send-to-customer", response_model=SuccessResponse)
async def send_quote_to_customer(
    quote_id: UUID,
    user: User = Depends(require_manager_or_above())
):
    """
    Send approved quote to customer
    
    Changes status from 'approved' to 'sent'
    """
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)
        
        # Validate quote access
        quote_data = await validate_quote_access(conn, quote_id, user, "view")
        
        if quote_data['status'] != 'approved':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only send approved quotes to customer"
            )
        
        # Update status to sent
        await conn.execute("""
            UPDATE quotes 
            SET status = 'sent', sent_at = TIMEZONE('utc', NOW())
            WHERE id = $1
        """, quote_id)
        
        # TODO: Generate PDF and send email to customer
        
        return SuccessResponse(
            message=f"Quote {quote_data['quote_number']} sent to customer {quote_data['customer_name']}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send quote to customer: {str(e)}"
        )
    finally:
        await conn.close()


@router.post("/{quote_id}/mark-accepted", response_model=SuccessResponse)
async def mark_quote_accepted(
    quote_id: UUID,
    user: User = Depends(get_current_user)
):
    """
    Mark quote as accepted by customer
    
    Changes status from 'sent' or 'viewed' to 'accepted'
    """
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)
        
        # Validate quote access
        quote_data = await validate_quote_access(conn, quote_id, user, "view")
        
        if quote_data['status'] not in ['sent', 'viewed']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only mark sent or viewed quotes as accepted"
            )
        
        # Update status to accepted
        await conn.execute("""
            UPDATE quotes 
            SET status = 'accepted'
            WHERE id = $1
        """, quote_id)
        
        return SuccessResponse(
            message=f"Quote {quote_data['quote_number']} marked as accepted by customer"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark quote as accepted: {str(e)}"
        )
    finally:
        await conn.close()


# ============================================================================
# PDF GENERATION
# ============================================================================

@router.get("/{quote_id}/pdf")
async def generate_quote_pdf(
    quote_id: UUID,
    user: User = Depends(get_current_user)
):
    """
    Generate PDF for quote
    Returns PDF file as response
    """
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)

        # Validate quote access
        await validate_quote_access(conn, quote_id, user, "view")

        # Get complete quote data with items
        quote_query = """
            SELECT
                q.*,
                c.name as customer_name,
                c.inn as customer_inn,
                c.kpp as customer_kpp,
                c.address as customer_address,
                c.email as customer_email,
                c.phone as customer_phone,
                u.full_name as manager_name,
                u.email as manager_email
            FROM quotes q
            LEFT JOIN customers c ON q.customer_id = c.id
            LEFT JOIN auth.users u ON q.created_by::text = u.id::text
            WHERE q.id = $1
        """

        quote_row = await conn.fetchrow(quote_query, quote_id)

        if not quote_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quote not found"
            )

        # Get quote items
        items_query = """
            SELECT *
            FROM quote_items
            WHERE quote_id = $1
            ORDER BY created_at
        """

        items_rows = await conn.fetch(items_query, quote_id)

        # Prepare quote data for PDF
        quote_data = {
            "quote_number": quote_row['quote_number'],
            "created_at": quote_row['created_at'],
            "valid_until": quote_row['valid_until'],
            "currency": quote_row['currency'],
            "status": quote_row['status'],
            "description": quote_row['description'],
            "notes": quote_row['notes'],
            "payment_terms": quote_row['payment_terms'],
            "delivery_terms": quote_row['delivery_terms'],

            # Customer info
            "customer_name": quote_row['customer_name'],
            "customer_inn": quote_row['customer_inn'],
            "customer_kpp": quote_row['customer_kpp'],
            "customer_address": quote_row['customer_address'],
            "customer_email": quote_row['customer_email'],
            "customer_phone": quote_row['customer_phone'],

            # Manager info
            "manager_name": quote_row['manager_name'],
            "manager_email": quote_row['manager_email'],

            # Financial totals
            "subtotal": quote_row['subtotal'],
            "discount_amount": quote_row['discount_amount'],
            "vat_amount": quote_row['vat_amount'],
            "vat_rate": quote_row['vat_rate'],
            "import_duty_amount": quote_row['import_duty_amount'],
            "total_amount": quote_row['total_amount'],

            # Quote items
            "items": [
                {
                    "description": item['description'],
                    "quantity": item['quantity'],
                    "unit": item['unit'],
                    "unit_price": item['unit_price'],
                    "line_total": item['line_total'],
                    "notes": item['notes'],
                    "category": item['category'],
                    "brand": item['brand']
                }
                for item in items_rows
            ]
        }

        # Initialize PDF service and generate PDF
        pdf_service = QuotePDFService()

        # Convert to QuoteWithItems format
        from models import QuoteWithItems
        quote_with_items = QuoteWithItems(
            **{k: v for k, v in quote_data.items() if k != 'items'},
            items=quote_data['items']
        )

        pdf_bytes = pdf_service.generate_quote_pdf(quote_with_items)

        # Return PDF as response
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=quote_{quote_row['quote_number']}.pdf"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF generation failed: {str(e)}"
        )
    finally:
        await conn.close()


@router.get("/{quote_id}/export/pdf")
async def export_quote_pdf(
    quote_id: UUID,
    format: str = Query(..., regex="^(supply|openbook|supply-letter|openbook-letter)$"),
    user: User = Depends(get_current_user)
):
    """
    Export quote as PDF with specified format

    Format options:
    - supply: КП поставка (9-column supply quote)
    - openbook: КП open book (21-column detailed quote)
    - supply-letter: КП поставка письмо (formal letter + 9-column grid)
    - openbook-letter: КП open book письмо (formal letter + 21-column grid)
    """
    import tempfile
    from fastapi.responses import FileResponse
    from starlette.background import BackgroundTask
    from services.export_data_mapper import fetch_export_data

    try:
        # Fetch all export data
        export_data = await fetch_export_data(str(quote_id), str(user.current_organization_id))

        # Initialize PDF service
        pdf_service = QuotePDFService()

        # Generate PDF based on format
        if format == "supply":
            pdf_bytes = pdf_service.generate_supply_pdf(export_data)
            format_name = "supply"
        elif format == "openbook":
            pdf_bytes = pdf_service.generate_openbook_pdf(export_data)
            format_name = "openbook"
        elif format == "supply-letter":
            pdf_bytes = pdf_service.generate_supply_letter_pdf(export_data)
            format_name = "supply_letter"
        else:  # openbook-letter
            pdf_bytes = pdf_service.generate_openbook_letter_pdf(export_data)
            format_name = "openbook_letter"

        # Generate filename
        # Parse created_at (comes from Supabase as ISO string)
        quote_date = ''
        if export_data.quote.get('created_at'):
            from datetime import datetime
            created_at_str = export_data.quote['created_at']
            if isinstance(created_at_str, str):
                # Parse ISO format: "2025-10-21T19:44:04.236Z"
                created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                quote_date = created_at.strftime('%Y%m%d')
            else:
                # Already datetime object
                quote_date = created_at_str.strftime('%Y%m%d')

        customer_name = export_data.customer.get('name', 'customer')[:20] if export_data.customer else 'customer'
        # Clean customer name for filename (transliterate Cyrillic)
        customer_name_clean = ''.join(c if c.isalnum() or c in '-_' else '_' for c in customer_name)
        quote_number = export_data.quote.get('quote_number', 'quote')
        # Clean quote number (remove 'КП-' prefix if present)
        quote_number_clean = quote_number.replace('КП-', '').replace('КП', '')
        filename = f"kvota_{format_name}_{quote_date}_{quote_number_clean}_{customer_name_clean}.pdf"

        # Write to temp file and return
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name

        return FileResponse(
            tmp_path,
            media_type='application/pdf',
            filename=filename,
            background=BackgroundTask(os.unlink, tmp_path)
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"ERROR in export_quote_pdf: {str(e)}")
        print(f"Traceback:\n{error_traceback}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF export failed: {str(e)}"
        )


# ============================================================================
# FILE UPLOAD & PROCESSING
# ============================================================================

@router.post("/upload-items")
async def upload_quote_items_file(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    """
    Upload and process Excel/CSV file to extract quote items
    Returns processed items for preview before adding to quote
    """
    try:
        # Process the uploaded file
        items, summary = await file_processor.process_file(file)

        return {
            "success": True,
            "message": f"Successfully processed {summary['total_rows_processed']} items from {file.filename}",
            "items": items,
            "summary": summary,
            "preview": True  # Indicates these are preview items, not yet saved
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"File upload processing failed: {str(e)}"
        )


@router.post("/{quote_id}/import-items")
async def import_items_to_quote(
    quote_id: UUID,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    """
    Upload file and directly add items to existing quote
    Validates quote access and adds processed items
    """
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)

        # Validate quote access and ensure it s editable
        quote_data = await validate_quote_access(conn, quote_id, user, "edit")

        # Process the uploaded file
        items, summary = await file_processor.process_file(file)

        if not items:
            raise HTTPException(
                status_code=400,
                detail="No valid items found in uploaded file"
            )

        # Add items to quote
        added_items = []

        for item in items:
            try:
                # Insert quote item
                insert_query = """
                    INSERT INTO quote_items (
                        quote_id, description, quantity, unit, unit_price, line_total,
                        category, brand, notes, sku, country_of_origin
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    RETURNING id, created_at
                """

                result = await conn.fetchrow(
                    insert_query,
                    quote_id,
                    item["description"],
                    item["quantity"],
                    item["unit"],
                    item["unit_price"],
                    item["line_total"],
                    item["category"] or None,
                    item["brand"] or None,
                    item["notes"] or None,
                    item["sku"] or None,
                    item["country_of_origin"] or None
                )

                added_items.append({
                    "id": result["id"],
                    "created_at": result["created_at"],
                    **item
                })

            except Exception as e:
                print(f"Error adding item: {str(e)}")
                continue

        if not added_items:
            raise HTTPException(
                status_code=500,
                detail="Failed to add any items to quote"
            )

        return {
            "success": True,
            "message": f"Successfully imported {len(added_items)} items to quote {quote_data['quote_number']}",
            "items_added": len(added_items),
            "total_items_processed": len(items),
            "summary": summary,
            "added_items": added_items
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Items import failed: {str(e)}"
        )
    finally:
        await conn.close()


# ============================================================================
# EXCEL EXPORT ENDPOINTS
# ============================================================================

@router.get("/{quote_id}/export/excel")
async def export_quote_excel(
    quote_id: str,
    format: str = Query(..., pattern="^(validation|supply-grid|openbook-grid)$", description="Export format"),
    user: User = Depends(get_current_user)
):
    """
    Export quote as Excel file

    Args:
        quote_id: Quote UUID
        format: Export format ('validation', 'supply-grid', or 'openbook-grid')
            - validation: Input/Output comparison format for checking against old Excel
            - grid: Professional 2-sheet export (КП поставка + КП open book)
        user: Current authenticated user

    Returns:
        Excel file (.xlsx)

    Raises:
        404: Quote not found
        500: Export generation failed
    """
    from fastapi.responses import FileResponse
    from services.excel_service import QuoteExcelService
    from services.export_data_mapper import fetch_export_data
    import tempfile

    try:
        # Fetch data
        export_data = await fetch_export_data(quote_id, user.current_organization_id)

        # Generate Excel based on format
        if format == "validation":
            excel_bytes = QuoteExcelService.generate_validation_export(export_data)
            format_suffix = "validation"
        elif format == "supply-grid":
            excel_bytes = QuoteExcelService.generate_supply_grid_export(export_data)
            format_suffix = "supply_grid"
        elif format == "openbook-grid":
            excel_bytes = QuoteExcelService.generate_openbook_grid_export(export_data)
            format_suffix = "openbook_grid"
        else:
            raise ValueError(f"Unknown format: {format}")

        # Save to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
            tmp.write(excel_bytes)
            tmp_path = tmp.name

        # Generate filename
        # Parse created_at for date
        from datetime import datetime
        quote_date = ''
        if export_data.quote.get('created_at'):
            created_at_str = export_data.quote['created_at']
            if isinstance(created_at_str, str):
                created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                quote_date = created_at.strftime('%Y%m%d')
            else:
                quote_date = created_at_str.strftime('%Y%m%d')

        quote_number = export_data.quote.get('quote_number', 'quote')
        # Clean quote number (remove 'КП-' prefix if present)
        quote_number_clean = quote_number.replace('КП-', '').replace('КП', '')

        customer_name = export_data.customer.get('name', 'customer')[:20] if export_data.customer else 'customer'
        # Clean customer name for filename (remove special characters)
        import re
        clean_customer = re.sub(r'[^\w\s-]', '', customer_name).strip().replace(' ', '_')

        filename = f"kvota_{format_suffix}_{quote_date}_{quote_number_clean}_{clean_customer}.xlsx"

        from starlette.background import BackgroundTask
        return FileResponse(
            tmp_path,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename=filename,
            background=BackgroundTask(os.unlink, tmp_path)
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Excel export failed: {str(e)}"
        )
