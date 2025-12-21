"""
Purchasing Companies API - CRUD operations for managing purchasing companies

Purchasing companies are the legal entities used for sourcing products from suppliers.
Per-product assignment: each quote item can have a different purchasing company.

TASK-008: Quote List Constructor with Department Presets
"""

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
import os

from supabase import create_client, Client
from auth import get_current_user, User, check_admin_permissions


router = APIRouter(prefix="/api/purchasing-companies", tags=["purchasing-companies"])


# =============================================================================
# Pydantic Models
# =============================================================================

class PurchasingCompanyBase(BaseModel):
    """Base model for purchasing company"""
    name: str = Field(..., min_length=1, max_length=255)
    country: Optional[str] = Field(None, max_length=100)
    is_active: bool = True


class PurchasingCompanyCreate(PurchasingCompanyBase):
    """Model for creating a purchasing company"""
    pass


class PurchasingCompanyUpdate(BaseModel):
    """Model for updating a purchasing company"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    country: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


class PurchasingCompanyResponse(BaseModel):
    """Response model for purchasing company"""
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

@router.get("/", response_model=List[PurchasingCompanyResponse])
async def list_purchasing_companies(
    include_inactive: bool = False,
    user: User = Depends(get_current_user)
) -> List[PurchasingCompanyResponse]:
    """
    List all purchasing companies for the user's organization.

    By default, only active companies are returned.
    Use include_inactive=true to see all companies.
    """
    supabase = get_supabase_client()

    query = supabase.table("purchasing_companies").select("*").eq(
        "organization_id", str(user.current_organization_id)
    )

    if not include_inactive:
        query = query.eq("is_active", True)

    result = query.order("name").execute()

    return [PurchasingCompanyResponse(**item) for item in result.data]


@router.get("/{company_id}", response_model=PurchasingCompanyResponse)
async def get_purchasing_company(
    company_id: UUID,
    user: User = Depends(get_current_user)
) -> PurchasingCompanyResponse:
    """Get a single purchasing company by ID"""
    supabase = get_supabase_client()

    result = supabase.table("purchasing_companies").select("*").eq(
        "id", str(company_id)
    ).eq(
        "organization_id", str(user.current_organization_id)
    ).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Закупочная компания не найдена"
        )

    return PurchasingCompanyResponse(**result.data[0])


@router.post("/", response_model=PurchasingCompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_purchasing_company(
    company: PurchasingCompanyCreate,
    user: User = Depends(get_current_user)
) -> PurchasingCompanyResponse:
    """
    Create a new purchasing company.

    Admin/Owner only.
    Name must be unique within the organization.
    """
    await check_admin_permissions(user)

    supabase = get_supabase_client()

    # Check for duplicate name
    existing = supabase.table("purchasing_companies").select("id").eq(
        "organization_id", str(user.current_organization_id)
    ).eq("name", company.name).execute()

    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Закупочная компания с названием '{company.name}' уже существует"
        )

    # Create the company
    result = supabase.table("purchasing_companies").insert({
        "organization_id": str(user.current_organization_id),
        "name": company.name,
        "country": company.country,
        "is_active": company.is_active
    }).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось создать закупочную компанию"
        )

    return PurchasingCompanyResponse(**result.data[0])


@router.put("/{company_id}", response_model=PurchasingCompanyResponse)
async def update_purchasing_company(
    company_id: UUID,
    company: PurchasingCompanyUpdate,
    user: User = Depends(get_current_user)
) -> PurchasingCompanyResponse:
    """
    Update a purchasing company.

    Admin/Owner only.
    """
    await check_admin_permissions(user)

    supabase = get_supabase_client()

    # Check company exists and belongs to org
    existing = supabase.table("purchasing_companies").select("*").eq(
        "id", str(company_id)
    ).eq(
        "organization_id", str(user.current_organization_id)
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Закупочная компания не найдена"
        )

    # Build update data
    update_data = company.model_dump(exclude_unset=True)

    if not update_data:
        return PurchasingCompanyResponse(**existing.data[0])

    # Check for duplicate name if being updated
    if "name" in update_data:
        dup_check = supabase.table("purchasing_companies").select("id").eq(
            "organization_id", str(user.current_organization_id)
        ).eq("name", update_data["name"]).neq(
            "id", str(company_id)
        ).execute()

        if dup_check.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Закупочная компания с названием '{update_data['name']}' уже существует"
            )

    # Update
    result = supabase.table("purchasing_companies").update(update_data).eq(
        "id", str(company_id)
    ).execute()

    return PurchasingCompanyResponse(**result.data[0])


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_purchasing_company(
    company_id: UUID,
    user: User = Depends(get_current_user)
) -> None:
    """
    Delete a purchasing company.

    Admin/Owner only.
    Note: Consider using update with is_active=false instead for soft delete.
    """
    await check_admin_permissions(user)

    supabase = get_supabase_client()

    # Check company exists and belongs to org
    existing = supabase.table("purchasing_companies").select("id").eq(
        "id", str(company_id)
    ).eq(
        "organization_id", str(user.current_organization_id)
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Закупочная компания не найдена"
        )

    # Delete
    supabase.table("purchasing_companies").delete().eq(
        "id", str(company_id)
    ).execute()
