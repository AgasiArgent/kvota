"""
Customer Management Routes - Russian B2B Quotation System
Full CRUD operations with Russian business validation
"""
from typing import List, Optional
from uuid import UUID

import asyncpg
from fastapi import APIRouter, HTTPException, Depends, Query, status
from fastapi.responses import JSONResponse
from supabase import create_client, Client

from auth import get_current_user, get_auth_context, User, AuthContext, require_permission
from models import (
    Customer, CustomerCreate, CustomerUpdate, CustomerListResponse,
    PaginationParams, SuccessResponse, ErrorResponse
)
import os
from services.activity_log_service import log_activity, log_activity_decorator


# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(
    prefix="/api/customers",
    tags=["customers"],
    dependencies=[Depends(get_current_user)]  # All endpoints require authentication
)


# ============================================================================
# DATABASE HELPER FUNCTIONS
# ============================================================================

async def get_db_connection():
    """Get database connection with proper error handling"""
    try:
        return await asyncpg.connect(os.getenv("DATABASE_URL"))
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


# ============================================================================
# CUSTOMER CRUD OPERATIONS
# ============================================================================

@router.get("/", response_model=CustomerListResponse)
async def list_customers(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name, email, or INN"),
    status: Optional[str] = Query(None, description="Filter by status"),
    company_type: Optional[str] = Query(None, description="Filter by company type"),
    region: Optional[str] = Query(None, description="Filter by Russian region"),
    user: User = Depends(require_permission("customers:read"))
):
    """
    List customers with pagination and filtering

    Supports filtering by:
    - Search term (name, email, INN)
    - Customer status
    - Company type
    - Russian region
    """
    try:
        from supabase import create_client, Client

        # Create Supabase client with service role key
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        # Check if user has an organization
        if not user.current_organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is not associated with any organization"
            )

        # Build query - start with organization filter
        query = supabase.table("customers").select("*", count="exact")
        query = query.eq("organization_id", str(user.current_organization_id))

        # Apply filters
        if search:
            # Search across multiple fields using .or_()
            # Note: Use asterisks (*) for wildcards in .or_() syntax, not percent signs
            query = query.or_(
                f"name.ilike.*{search}*,"
                f"email.ilike.*{search}*,"
                f"inn.ilike.*{search}*"
            )

        if status:
            query = query.eq("status", status)

        if company_type:
            query = query.eq("company_type", company_type)

        if region:
            query = query.ilike("region", f"%{region}%")

        # Apply pagination
        offset = (page - 1) * limit
        query = query.range(offset, offset + limit - 1)

        # Order by name
        query = query.order("name", desc=False).order("created_at", desc=True)

        # Execute query
        result = query.execute()

        # Get total count
        total = result.count if result.count is not None else len(result.data)

        # Convert to Pydantic models
        customers = [Customer(**customer) for customer in result.data]

        return CustomerListResponse(
            customers=customers,
            total=total,
            page=page,
            limit=limit,
            has_more=offset + limit < total
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve customers: {str(e)}"
        )


@router.post("/", response_model=Customer)
@log_activity_decorator("customer", "created")
async def create_customer(
    customer_data: CustomerCreate,
    auth_context: AuthContext = Depends(get_auth_context)
):
    """
    Create a new customer with Russian business validation

    Validates:
    - INN format (10 digits for organizations, 12 for individuals)
    - KPP format (9 digits for organizations)
    - Russian postal code format (6 digits)
    """
    try:
        from supabase import create_client, Client

        # Create Supabase client with service role key for RLS bypass
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        # Check for duplicate INN if provided
        if customer_data.inn:
            existing = supabase.table("customers")\
                .select("id")\
                .eq("inn", customer_data.inn)\
                .eq("organization_id", customer_data.organization_id)\
                .execute()

            if existing.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Customer with INN {customer_data.inn} already exists"
                )

        # Insert new customer
        customer_dict = customer_data.dict()
        customer_dict['created_by'] = str(auth_context.user.id)

        # Convert any UUID/Decimal objects for Supabase
        from decimal import Decimal as DecimalType
        for key, value in customer_dict.items():
            if isinstance(value, UUID):
                customer_dict[key] = str(value)
            elif isinstance(value, DecimalType):
                customer_dict[key] = float(value)

        result = supabase.table("customers")\
            .insert(customer_dict)\
            .execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create customer"
            )

        customer = Customer(**result.data[0])

        # Log activity
        await log_activity(
            user_id=auth_context.user.id,
            organization_id=auth_context.user.current_organization_id,
            action="created",
            entity_type="customer",
            entity_id=customer.id
        )

        return customer

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create customer: {str(e)}"
        )


@router.get("/{customer_id}", response_model=Customer)
async def get_customer(
    customer_id: UUID,
    user: User = Depends(require_permission("customers:read"))
):
    """Get customer by ID"""
    try:
        from supabase import create_client, Client

        # Create Supabase client with service role key
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        # Check if user has an organization
        if not user.current_organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is not associated with any organization"
            )

        # Query customer by ID with organization check (RLS)
        result = supabase.table("customers").select("*").eq("id", str(customer_id)).eq("organization_id", str(user.current_organization_id)).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer {customer_id} not found"
            )

        return Customer(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve customer: {str(e)}"
        )



@router.put("/{customer_id}", response_model=Customer)
@log_activity_decorator("customer", "updated")
async def update_customer(
    customer_id: UUID,
    customer_update: CustomerUpdate,
    user: User = Depends(require_permission("customers:update"))
):
    """
    Update customer information with Russian business validation

    Only updates provided fields, preserves existing values for omitted fields
    """
    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    try:
        # Check if customer exists
        existing_result = supabase.table("customers").select("*")\
            .eq("id", str(customer_id))\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not existing_result.data or len(existing_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer {customer_id} not found"
            )

        existing = existing_result.data[0]

        # Check for INN conflict if INN is being updated
        if customer_update.inn and customer_update.inn != existing.get('inn'):
            inn_conflict = supabase.table("customers").select("id")\
                .eq("inn", customer_update.inn)\
                .eq("organization_id", str(user.current_organization_id))\
                .neq("id", str(customer_id))\
                .execute()

            if inn_conflict.data and len(inn_conflict.data) > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Customer with INN {customer_update.inn} already exists"
                )

        # Get only fields that are provided in the update
        update_data = customer_update.dict(exclude_unset=True)

        if not update_data:
            # No fields to update, return existing customer
            return Customer(**existing)

        # Update customer
        result = supabase.table("customers").update(update_data)\
            .eq("id", str(customer_id))\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer {customer_id} not found"
            )

        customer = Customer(**result.data[0])

        # Log activity
        await log_activity(
            user_id=user.id,
            organization_id=user.current_organization_id,
            action="updated",
            entity_type="customer",
            entity_id=customer.id
        )

        return customer

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update customer: {str(e)}"
        )


@router.delete("/{customer_id}", response_model=SuccessResponse)
@log_activity_decorator("customer", "deleted")
async def delete_customer(
    customer_id: UUID,
    user: User = Depends(require_permission("customers:delete"))
):
    """
    Delete customer by ID

    Checks for dependent quotes before deletion
    """
    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    try:
        # Check if customer has associated quotes
        quotes_result = supabase.table("quotes").select("id", count="exact")\
            .eq("customer_id", str(customer_id))\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        quote_count = quotes_result.count or 0

        if quote_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete customer: {quote_count} quotes are associated with this customer"
            )

        # Delete customer
        deleted_result = supabase.table("customers").delete()\
            .eq("id", str(customer_id))\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not deleted_result.data or len(deleted_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer {customer_id} not found"
            )

        # Log activity
        await log_activity(
            user_id=user.id,
            organization_id=user.current_organization_id,
            action="deleted",
            entity_type="customer",
            entity_id=customer_id
        )

        return SuccessResponse(
            message=f"Customer {customer_id} deleted successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete customer: {str(e)}"
        )


# ============================================================================
# CUSTOMER BUSINESS LOGIC ENDPOINTS
# ============================================================================

@router.get("/{customer_id}/quotes")
async def get_customer_quotes(
    customer_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(require_permission("quotes:read"))
):
    """Get all quotes for a specific customer"""
    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    try:
        # Verify customer exists
        customer_result = supabase.table("customers").select("id")\
            .eq("id", str(customer_id))\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not customer_result.data or len(customer_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer {customer_id} not found"
            )

        # Get paginated quotes with count
        offset = (page - 1) * limit

        quotes_result = supabase.table("quotes")\
            .select("id, quote_number, title, status, total_amount, quote_date, valid_until, created_at, updated_at", count="exact")\
            .eq("customer_id", str(customer_id))\
            .eq("organization_id", str(user.current_organization_id))\
            .order("created_at", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()

        total = quotes_result.count or 0
        quotes = quotes_result.data or []

        return {
            "customer_id": customer_id,
            "quotes": quotes,
            "total": total,
            "page": page,
            "limit": limit,
            "has_more": offset + limit < total
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve customer quotes: {str(e)}"
        )


@router.get("/search/inn/{inn}")
async def search_customer_by_inn(
    inn: str,
    user: User = Depends(require_permission("customers:read"))
):
    """
    Search customer by Russian INN (Tax ID)

    Useful for quick customer lookup during quote creation
    """
    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    try:
        # Clean INN (remove spaces and hyphens)
        inn_clean = ''.join(filter(str.isdigit, inn))

        if len(inn_clean) not in [10, 12]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="INN must be 10 digits for organizations or 12 for individuals"
            )

        result = supabase.table("customers").select("*")\
            .eq("inn", inn_clean)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer with INN {inn_clean} not found"
            )

        return Customer(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search customer by INN: {str(e)}"
        )


# ============================================================================
# ANALYTICS ENDPOINTS
# ============================================================================

# ============================================================================
# CUSTOMER CONTACTS CRUD OPERATIONS
# ============================================================================

@router.get("/{customer_id}/contacts")
async def list_customer_contacts(
    customer_id: UUID,
    user: User = Depends(require_permission("customers:read"))
):
    """List all contacts for a customer"""
    from supabase import create_client, Client

    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    # Verify customer belongs to user's organization
    customer = supabase.table("customers")\
        .select("id")\
        .eq("id", str(customer_id))\
        .eq("organization_id", str(user.current_organization_id))\
        .execute()

    if not customer.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    # Get contacts
    result = supabase.table("customer_contacts")\
        .select("*")\
        .eq("customer_id", str(customer_id))\
        .eq("organization_id", str(user.current_organization_id))\
        .order("is_primary", desc=True)\
        .order("created_at", desc=False)\
        .execute()

    return {"contacts": result.data}


@router.post("/{customer_id}/contacts")
@log_activity_decorator("contact", "created")
async def create_contact(
    customer_id: UUID,
    contact: dict,
    user: User = Depends(require_permission("customers:update"))
):
    """Create a new contact for customer"""
    from supabase import create_client, Client

    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    # Validate customer belongs to organization
    customer = supabase.table("customers")\
        .select("id")\
        .eq("id", str(customer_id))\
        .eq("organization_id", str(user.current_organization_id))\
        .execute()

    if not customer.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    # If setting as primary, unset other primary contacts
    if contact.get('is_primary'):
        supabase.table("customer_contacts")\
            .update({"is_primary": False})\
            .eq("customer_id", str(customer_id))\
            .execute()

    # Insert contact
    result = supabase.table("customer_contacts").insert({
        "customer_id": str(customer_id),
        "name": contact['name'],
        "last_name": contact.get('last_name'),
        "phone": contact.get('phone'),
        "email": contact.get('email'),
        "position": contact.get('position'),
        "is_primary": contact.get('is_primary', False),
        "notes": contact.get('notes'),
        "organization_id": str(user.current_organization_id)
    }).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create contact"
        )

    contact_data = result.data[0]

    # Log activity
    await log_activity(
        user_id=user.id,
        organization_id=user.current_organization_id,
        action="created",
        entity_type="contact",
        entity_id=UUID(contact_data['id'])
    )

    return contact_data


@router.put("/{customer_id}/contacts/{contact_id}")
@log_activity_decorator("contact", "updated")
async def update_contact(
    customer_id: UUID,
    contact_id: UUID,
    contact: dict,
    user: User = Depends(require_permission("customers:update"))
):
    """Update contact"""
    from supabase import create_client, Client

    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    # If setting as primary, unset others
    if contact.get('is_primary'):
        supabase.table("customer_contacts")\
            .update({"is_primary": False})\
            .eq("customer_id", str(customer_id))\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

    # Update contact
    result = supabase.table("customer_contacts")\
        .update(contact)\
        .eq("id", str(contact_id))\
        .eq("organization_id", str(user.current_organization_id))\
        .execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )

    contact_data = result.data[0]

    # Log activity
    await log_activity(
        user_id=user.id,
        organization_id=user.current_organization_id,
        action="updated",
        entity_type="contact",
        entity_id=contact_id
    )

    return contact_data


@router.delete("/{customer_id}/contacts/{contact_id}")
@log_activity_decorator("contact", "deleted")
async def delete_contact(
    customer_id: UUID,
    contact_id: UUID,
    user: User = Depends(require_permission("customers:update"))
):
    """Delete contact"""
    from supabase import create_client, Client

    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    result = supabase.table("customer_contacts")\
        .delete()\
        .eq("id", str(contact_id))\
        .eq("organization_id", str(user.current_organization_id))\
        .execute()

    # Log activity
    await log_activity(
        user_id=user.id,
        organization_id=user.current_organization_id,
        action="deleted",
        entity_type="contact",
        entity_id=contact_id
    )

    return {"success": True}


# ============================================================================
# ANALYTICS ENDPOINTS
# ============================================================================

@router.get("/stats/overview")
async def get_customer_stats(
    user: User = Depends(require_permission("customers:read"))
):
    """
    Get customer statistics overview

    Useful for dashboard and reporting
    """
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)

        stats = await conn.fetchrow("""
            SELECT
                COUNT(*) as total_customers,
                COUNT(*) FILTER (WHERE status = 'active') as active_customers,
                COUNT(*) FILTER (WHERE status = 'inactive') as inactive_customers,
                COUNT(*) FILTER (WHERE company_type = 'organization') as organizations,
                COUNT(*) FILTER (WHERE company_type = 'individual_entrepreneur') as entrepreneurs,
                COUNT(*) FILTER (WHERE region = 'Москва') as moscow_customers,
                AVG(credit_limit) as avg_credit_limit,
                SUM(credit_limit) as total_credit_limit
            FROM customers
        """)

        # Get regional breakdown
        regions = await conn.fetch("""
            SELECT region, COUNT(*) as count
            FROM customers
            WHERE region IS NOT NULL
            GROUP BY region
            ORDER BY count DESC
            LIMIT 10
        """)

        return {
            "overview": dict(stats),
            "top_regions": [dict(row) for row in regions]
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve customer statistics: {str(e)}"
        )
    finally:
        await conn.close()