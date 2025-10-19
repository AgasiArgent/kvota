"""
Customer Management Routes - Russian B2B Quotation System
Full CRUD operations with Russian business validation
"""
from typing import List, Optional
from uuid import UUID

import asyncpg
from fastapi import APIRouter, HTTPException, Depends, Query, status
from fastapi.responses import JSONResponse

from auth import get_current_user, get_auth_context, User, AuthContext, require_permission
from models import (
    Customer, CustomerCreate, CustomerUpdate, CustomerListResponse,
    PaginationParams, SuccessResponse, ErrorResponse
)
import os


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
            # Supabase doesn't support OR in a single filter, so we'll fetch and filter in Python
            # For now, let's just search by name
            query = query.ilike("name", f"%{search}%")

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

        return Customer(**result.data[0])

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
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)
        
        row = await conn.fetchrow(
            "SELECT * FROM customers WHERE id = $1",
            customer_id
        )
        
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer {customer_id} not found"
            )
        
        return Customer(**dict(row))
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve customer: {str(e)}"
        )
    finally:
        await conn.close()


@router.put("/{customer_id}", response_model=Customer)
async def update_customer(
    customer_id: UUID,
    customer_update: CustomerUpdate,
    user: User = Depends(require_permission("customers:update"))
):
    """
    Update customer information with Russian business validation
    
    Only updates provided fields, preserves existing values for omitted fields
    """
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)
        
        # Check if customer exists
        existing = await conn.fetchrow(
            "SELECT * FROM customers WHERE id = $1",
            customer_id
        )
        
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer {customer_id} not found"
            )
        
        # Check for INN conflict if INN is being updated
        if customer_update.inn and customer_update.inn != existing['inn']:
            inn_conflict = await conn.fetchval(
                "SELECT id FROM customers WHERE inn = $1 AND id != $2",
                customer_update.inn, customer_id
            )
            if inn_conflict:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Customer with INN {customer_update.inn} already exists"
                )
        
        # Build dynamic UPDATE query
        update_fields = []
        params = []
        param_count = 0
        
        # Get only fields that are provided in the update
        update_data = customer_update.dict(exclude_unset=True)
        
        for field, value in update_data.items():
            param_count += 1
            update_fields.append(f"{field} = ${param_count}")
            params.append(value)
        
        if not update_fields:
            # No fields to update, return existing customer
            return Customer(**dict(existing))
        
        # Add customer_id parameter
        param_count += 1
        params.append(customer_id)
        
        query = f"""
            UPDATE customers 
            SET {', '.join(update_fields)}, updated_at = TIMEZONE('utc', NOW())
            WHERE id = ${param_count}
            RETURNING *
        """
        
        row = await conn.fetchrow(query, *params)
        return Customer(**dict(row))
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update customer: {str(e)}"
        )
    finally:
        await conn.close()


@router.delete("/{customer_id}", response_model=SuccessResponse)
async def delete_customer(
    customer_id: UUID,
    user: User = Depends(require_permission("customers:delete"))
):
    """
    Delete customer by ID
    
    Checks for dependent quotes before deletion
    """
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)
        
        # Check if customer has associated quotes
        quote_count = await conn.fetchval(
            "SELECT COUNT(*) FROM quotes WHERE customer_id = $1",
            customer_id
        )
        
        if quote_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete customer: {quote_count} quotes are associated with this customer"
            )
        
        # Delete customer
        deleted = await conn.fetchval(
            "DELETE FROM customers WHERE id = $1 RETURNING id",
            customer_id
        )
        
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer {customer_id} not found"
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
    finally:
        await conn.close()


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
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)
        
        # Verify customer exists
        customer_exists = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM customers WHERE id = $1)",
            customer_id
        )
        
        if not customer_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer {customer_id} not found"
            )
        
        # Count total quotes
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM quotes WHERE customer_id = $1",
            customer_id
        )
        
        # Get paginated quotes
        offset = (page - 1) * limit
        rows = await conn.fetch("""
            SELECT id, quote_number, title, status, total_amount, currency, 
                   quote_date, valid_until, created_at, updated_at
            FROM quotes 
            WHERE customer_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        """, customer_id, limit, offset)
        
        quotes = [dict(row) for row in rows]
        
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
    finally:
        await conn.close()


@router.get("/search/inn/{inn}")
async def search_customer_by_inn(
    inn: str,
    user: User = Depends(require_permission("customers:read"))
):
    """
    Search customer by Russian INN (Tax ID)
    
    Useful for quick customer lookup during quote creation
    """
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)
        
        # Clean INN (remove spaces and hyphens)
        inn_clean = ''.join(filter(str.isdigit, inn))
        
        if len(inn_clean) not in [10, 12]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="INN must be 10 digits for organizations or 12 for individuals"
            )
        
        row = await conn.fetchrow(
            "SELECT * FROM customers WHERE inn = $1",
            inn_clean
        )
        
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer with INN {inn_clean} not found"
            )
        
        return Customer(**dict(row))
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search customer by INN: {str(e)}"
        )
    finally:
        await conn.close()


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