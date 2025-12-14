"""
Seller Companies API - CRUD operations for managing seller companies

Seller companies are used in quote creation to identify the selling entity.
Each company has a unique 3-letter supplier code used in IDN generation.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from uuid import UUID
import os
import re

from supabase import create_client, Client
from auth import get_current_user, User, check_admin_permissions

router = APIRouter(prefix="/api/seller-companies", tags=["seller-companies"])


# =============================================================================
# Pydantic Models
# =============================================================================

class SellerCompanyBase(BaseModel):
    """Base model for seller company"""
    name: str = Field(..., min_length=1, max_length=255)
    supplier_code: str = Field(..., min_length=3, max_length=3)
    country: Optional[str] = Field(None, max_length=100)
    is_active: bool = True

    @field_validator('supplier_code')
    @classmethod
    def validate_supplier_code(cls, v: str) -> str:
        """Supplier code must be 3 uppercase letters"""
        v = v.upper()
        if not re.match(r'^[A-Z]{3}$', v):
            raise ValueError('Код поставщика должен состоять из 3 заглавных букв (A-Z)')
        return v


class SellerCompanyCreate(SellerCompanyBase):
    """Model for creating a seller company"""
    pass


class SellerCompanyUpdate(BaseModel):
    """Model for updating a seller company"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    supplier_code: Optional[str] = Field(None, min_length=3, max_length=3)
    country: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None

    @field_validator('supplier_code')
    @classmethod
    def validate_supplier_code(cls, v: Optional[str]) -> Optional[str]:
        """Supplier code must be 3 uppercase letters"""
        if v is None:
            return v
        v = v.upper()
        if not re.match(r'^[A-Z]{3}$', v):
            raise ValueError('Код поставщика должен состоять из 3 заглавных букв (A-Z)')
        return v


class SellerCompanyResponse(BaseModel):
    """Response model for seller company"""
    id: UUID
    organization_id: UUID
    name: str
    supplier_code: str
    country: Optional[str]
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

@router.get("/", response_model=list[SellerCompanyResponse])
async def list_seller_companies(
    include_inactive: bool = False,
    user: User = Depends(get_current_user)
) -> list[SellerCompanyResponse]:
    """
    List all seller companies for the user's organization.

    By default, only active companies are returned.
    Use include_inactive=true to see all companies.
    """
    supabase = get_supabase_client()

    query = supabase.table("seller_companies").select("*").eq(
        "organization_id", str(user.current_organization_id)
    )

    if not include_inactive:
        query = query.eq("is_active", True)

    result = query.order("name").execute()

    return [SellerCompanyResponse(**item) for item in result.data]


@router.get("/{company_id}", response_model=SellerCompanyResponse)
async def get_seller_company(
    company_id: UUID,
    user: User = Depends(get_current_user)
) -> SellerCompanyResponse:
    """Get a single seller company by ID"""
    supabase = get_supabase_client()

    result = supabase.table("seller_companies").select("*").eq(
        "id", str(company_id)
    ).eq(
        "organization_id", str(user.current_organization_id)
    ).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Компания-продавец не найдена"
        )

    return SellerCompanyResponse(**result.data[0])


@router.post("/", response_model=SellerCompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_seller_company(
    company: SellerCompanyCreate,
    user: User = Depends(get_current_user)
) -> SellerCompanyResponse:
    """
    Create a new seller company.

    Admin/Owner only.
    Supplier code must be unique within the organization.
    """
    await check_admin_permissions(user)

    supabase = get_supabase_client()

    # Check for duplicate supplier code
    existing = supabase.table("seller_companies").select("id").eq(
        "organization_id", str(user.current_organization_id)
    ).eq(
        "supplier_code", company.supplier_code
    ).execute()

    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Код поставщика '{company.supplier_code}' уже используется"
        )

    # Check for duplicate name
    existing_name = supabase.table("seller_companies").select("id").eq(
        "organization_id", str(user.current_organization_id)
    ).eq(
        "name", company.name
    ).execute()

    if existing_name.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Компания с названием '{company.name}' уже существует"
        )

    # Create the company
    result = supabase.table("seller_companies").insert({
        "organization_id": str(user.current_organization_id),
        "name": company.name,
        "supplier_code": company.supplier_code,
        "country": company.country,
        "is_active": company.is_active
    }).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось создать компанию-продавца"
        )

    return SellerCompanyResponse(**result.data[0])


@router.put("/{company_id}", response_model=SellerCompanyResponse)
async def update_seller_company(
    company_id: UUID,
    company: SellerCompanyUpdate,
    user: User = Depends(get_current_user)
) -> SellerCompanyResponse:
    """
    Update a seller company.

    Admin/Owner only.
    """
    await check_admin_permissions(user)

    supabase = get_supabase_client()

    # Check company exists and belongs to org
    existing = supabase.table("seller_companies").select("*").eq(
        "id", str(company_id)
    ).eq(
        "organization_id", str(user.current_organization_id)
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Компания-продавец не найдена"
        )

    # Build update data
    update_data = company.model_dump(exclude_unset=True)

    if not update_data:
        return SellerCompanyResponse(**existing.data[0])

    # Check for duplicate supplier code if being updated
    if "supplier_code" in update_data:
        dup_check = supabase.table("seller_companies").select("id").eq(
            "organization_id", str(user.current_organization_id)
        ).eq(
            "supplier_code", update_data["supplier_code"]
        ).neq(
            "id", str(company_id)
        ).execute()

        if dup_check.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Код поставщика '{update_data['supplier_code']}' уже используется"
            )

    # Check for duplicate name if being updated
    if "name" in update_data:
        dup_check = supabase.table("seller_companies").select("id").eq(
            "organization_id", str(user.current_organization_id)
        ).eq(
            "name", update_data["name"]
        ).neq(
            "id", str(company_id)
        ).execute()

        if dup_check.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Компания с названием '{update_data['name']}' уже существует"
            )

    # Update
    result = supabase.table("seller_companies").update(
        update_data
    ).eq(
        "id", str(company_id)
    ).execute()

    return SellerCompanyResponse(**result.data[0])


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_seller_company(
    company_id: UUID,
    user: User = Depends(get_current_user)
) -> None:
    """
    Delete a seller company.

    Admin/Owner only.
    Note: This is a hard delete. Consider using update with is_active=false instead.
    """
    await check_admin_permissions(user)

    supabase = get_supabase_client()

    # Check company exists and belongs to org
    existing = supabase.table("seller_companies").select("id").eq(
        "id", str(company_id)
    ).eq(
        "organization_id", str(user.current_organization_id)
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Компания-продавец не найдена"
        )

    # Delete
    supabase.table("seller_companies").delete().eq(
        "id", str(company_id)
    ).execute()
