"""
Supplier Countries API

Provides reference data for supplier countries including VAT rates and internal markup percentages.
This is a read-only reference table used by the calculation engine.

Created: 2025-11-09
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from pydantic import BaseModel
from decimal import Decimal
import os

from supabase import create_client, Client
from auth import get_current_user, User

router = APIRouter(prefix="/api/supplier-countries", tags=["reference"])


class SupplierCountryResponse(BaseModel):
    """Response model for supplier country"""
    code: str
    name_ru: str
    vat_rate: Decimal
    internal_markup_ru: Decimal
    internal_markup_tr: Decimal


@router.get("/", response_model=List[SupplierCountryResponse])
async def list_supplier_countries(
    user: User = Depends(get_current_user)
):
    """
    Get list of all supplier countries with VAT and markup rates

    This is a reference table - same for all organizations.
    Used in quote creation for supplier_country dropdown.

    Returns:
        List of supplier countries with:
        - code: Internal code (e.g., 'turkey', 'china')
        - name_ru: Display name in Russian (e.g., 'Турция', 'Китай')
        - vat_rate: VAT rate in supplier country (0.20 = 20%)
        - internal_markup_ru: Markup when selling from Russian entity
        - internal_markup_tr: Markup when selling from Turkish entity

    Example response:
        [
            {
                "code": "turkey",
                "name_ru": "Турция",
                "vat_rate": 0.20,
                "internal_markup_ru": 0.02,
                "internal_markup_tr": 0.00
            },
            ...
        ]
    """
    try:
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        result = supabase.table("supplier_countries")\
            .select("code, name_ru, vat_rate, internal_markup_ru, internal_markup_tr")\
            .order("name_ru")\
            .execute()

        if not result.data:
            return []

        return [SupplierCountryResponse(**row) for row in result.data]

    except Exception as e:
        # Log and return empty list (graceful degradation)
        print(f"Error fetching supplier countries: {e}")
        return []


@router.get("/{code}", response_model=SupplierCountryResponse)
async def get_supplier_country(
    code: str,
    user: User = Depends(get_current_user)
):
    """
    Get specific supplier country by code

    Args:
        code: Country code (e.g., 'turkey', 'china', 'lithuania')

    Returns:
        Supplier country details with VAT and markup rates

    Raises:
        404: Country not found
    """
    try:
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        result = supabase.table("supplier_countries")\
            .select("code, name_ru, vat_rate, internal_markup_ru, internal_markup_tr")\
            .eq("code", code)\
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Supplier country not found: {code}"
            )

        return SupplierCountryResponse(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )
