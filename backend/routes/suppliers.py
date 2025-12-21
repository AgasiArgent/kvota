"""
Suppliers API - CRUD operations for managing suppliers

Suppliers are the companies that provide products.
Per-product assignment: each quote item can have a different supplier.

TASK-008: Quote List Constructor with Department Presets
"""

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
import os

from supabase import create_client, Client
from auth import get_current_user, User, check_admin_permissions


router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


# =============================================================================
# Pydantic Models
# =============================================================================

class SupplierBase(BaseModel):
    """Base model for supplier"""
    name: str = Field(..., min_length=1, max_length=255)
    country: Optional[str] = Field(None, max_length=100)
    is_active: bool = True


class SupplierCreate(SupplierBase):
    """Model for creating a supplier"""
    pass


class SupplierUpdate(BaseModel):
    """Model for updating a supplier"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    country: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


class SupplierResponse(BaseModel):
    """Response model for supplier"""
    id: UUID
    organization_id: UUID
    name: str
    country: Optional[str] = None
    is_active: bool
    created_at: str
    updated_at: str


# =============================================================================
# Helper Functions
# =============================================================================

def get_supabase_client() -> Client:
    """Get Supabase client with service role key"""
    return create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/", response_model=List[SupplierResponse])
async def list_suppliers(
    include_inactive: bool = False,
    user: User = Depends(get_current_user)
) -> List[SupplierResponse]:
    """
    List all suppliers for the user's organization.

    By default, only active suppliers are returned.
    Use include_inactive=true to see all suppliers.
    """
    supabase = get_supabase_client()

    query = supabase.table("suppliers").select("*").eq(
        "organization_id", str(user.current_organization_id)
    )

    if not include_inactive:
        query = query.eq("is_active", True)

    result = query.order("name").execute()

    return [SupplierResponse(**item) for item in result.data]


@router.get("/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(
    supplier_id: UUID,
    user: User = Depends(get_current_user)
) -> SupplierResponse:
    """Get a single supplier by ID"""
    supabase = get_supabase_client()

    result = supabase.table("suppliers").select("*").eq(
        "id", str(supplier_id)
    ).eq(
        "organization_id", str(user.current_organization_id)
    ).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Поставщик не найден"
        )

    return SupplierResponse(**result.data[0])


@router.post("/", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    supplier: SupplierCreate,
    user: User = Depends(get_current_user)
) -> SupplierResponse:
    """
    Create a new supplier.

    Admin/Owner only.
    Name must be unique within the organization.
    """
    await check_admin_permissions(user)

    supabase = get_supabase_client()

    # Check for duplicate name
    existing = supabase.table("suppliers").select("id").eq(
        "organization_id", str(user.current_organization_id)
    ).eq("name", supplier.name).execute()

    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Поставщик с названием '{supplier.name}' уже существует"
        )

    # Create the supplier
    result = supabase.table("suppliers").insert({
        "organization_id": str(user.current_organization_id),
        "name": supplier.name,
        "country": supplier.country,
        "is_active": supplier.is_active
    }).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось создать поставщика"
        )

    return SupplierResponse(**result.data[0])


@router.put("/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: UUID,
    supplier: SupplierUpdate,
    user: User = Depends(get_current_user)
) -> SupplierResponse:
    """
    Update a supplier.

    Admin/Owner only.
    """
    await check_admin_permissions(user)

    supabase = get_supabase_client()

    # Check supplier exists and belongs to org
    existing = supabase.table("suppliers").select("*").eq(
        "id", str(supplier_id)
    ).eq(
        "organization_id", str(user.current_organization_id)
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Поставщик не найден"
        )

    # Build update data
    update_data = supplier.model_dump(exclude_unset=True)

    if not update_data:
        return SupplierResponse(**existing.data[0])

    # Check for duplicate name if being updated
    if "name" in update_data:
        dup_check = supabase.table("suppliers").select("id").eq(
            "organization_id", str(user.current_organization_id)
        ).eq("name", update_data["name"]).neq(
            "id", str(supplier_id)
        ).execute()

        if dup_check.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Поставщик с названием '{update_data['name']}' уже существует"
            )

    # Update
    result = supabase.table("suppliers").update(update_data).eq(
        "id", str(supplier_id)
    ).execute()

    return SupplierResponse(**result.data[0])


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supplier(
    supplier_id: UUID,
    user: User = Depends(get_current_user)
) -> None:
    """
    Delete a supplier.

    Admin/Owner only.
    Note: Consider using update with is_active=false instead for soft delete.
    """
    await check_admin_permissions(user)

    supabase = get_supabase_client()

    # Check supplier exists and belongs to org
    existing = supabase.table("suppliers").select("id").eq(
        "id", str(supplier_id)
    ).eq(
        "organization_id", str(user.current_organization_id)
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Поставщик не найден"
        )

    # Delete
    supabase.table("suppliers").delete().eq(
        "id", str(supplier_id)
    ).execute()
