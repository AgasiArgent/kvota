"""
Specification Export Routes - Russian B2B Quotation System
Exports specification (Спецификация) documents as DOCX
"""
import os
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from supabase import Client
from dependencies import get_supabase

from auth import get_current_user, User, require_permission
from services.specification_export_service import generate_specification


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class SpecificationExportRequest(BaseModel):
    """Request model for exporting specification"""
    contract_id: UUID = Field(..., description="Contract UUID to use for this specification")
    # Either warehouse_index (legacy) or delivery_address_id (new) can be provided
    warehouse_index: Optional[int] = Field(None, ge=0, description="Index of warehouse address to use (0-based) - LEGACY")
    delivery_address_id: Optional[UUID] = Field(None, description="UUID of delivery address from customer_delivery_addresses table")
    signatory_contact_id: Optional[UUID] = Field(None, description="UUID of signatory contact from customer_contacts table")
    additional_conditions: Optional[str] = Field(None, description="Optional additional conditions text")

    class Config:
        json_schema_extra = {
            "example": {
                "contract_id": "123e4567-e89b-12d3-a456-426614174000",
                "delivery_address_id": "456e4567-e89b-12d3-a456-426614174000",
                "signatory_contact_id": "789e4567-e89b-12d3-a456-426614174000",
                "additional_conditions": "Доставка до склада покупателя включена"
            }
        }


# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(
    prefix="/api/quotes",
    tags=["specification-export"],
    dependencies=[Depends(get_current_user)]
)


# ============================================================================
# EXPORT ENDPOINT
# ============================================================================

@router.post("/{quote_id}/export/specification")
async def export_specification(
    quote_id: UUID,
    request: SpecificationExportRequest,
    user: User = Depends(require_permission("quotes:read")),
    supabase: Client = Depends(get_supabase)
):
    """
    Export specification (Спецификация) as DOCX document

    Steps:
    1. Validate quote exists and user has permission
    2. Validate contract exists and belongs to quote's customer
    3. Gather all required data (30 variables)
    4. Generate DOCX from template
    5. Increment specification number in contract
    6. Create audit record in specification_exports table
    7. Return DOCX file for download

    Required data:
    - Quote must have customer, products, and all required fields
    - Contract must exist for the customer
    - Customer must have signatory info
    - Organization must have signatory info
    - Customer must have warehouse address (or registration address will be used)

    Returns:
        DOCX file download with filename: specification_{quote_id}_{contract_id}_{timestamp}.docx
    """
    try:
        # 1. Verify quote exists and belongs to user's organization
        quote_result = supabase.table("quotes").select("*")\
            .eq("id", str(quote_id))\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not quote_result.data or len(quote_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quote not found"
            )

        quote = quote_result.data[0]

        # 2. Verify contract exists and belongs to the same customer
        contract_result = supabase.table("customer_contracts").select("*")\
            .eq("id", str(request.contract_id))\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not contract_result.data or len(contract_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contract not found"
            )

        contract = contract_result.data[0]

        # Verify contract belongs to quote's customer
        if contract["customer_id"] != quote["customer_id"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Contract does not belong to the quote's customer"
            )

        # 3. Verify contract is active
        if contract["status"] != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Contract status is '{contract['status']}'. Only 'active' contracts can be used for exports."
            )

        # 4. Validate quote has required data
        validation_errors = []

        if not quote.get("customer_id"):
            validation_errors.append("Quote does not have a customer assigned")

        if not quote.get("currency"):
            validation_errors.append("Quote does not have a currency set")

        # Note: payment_terms and delivery_days are now fetched from quote_calculation_variables
        # in the service, not from denormalized quote columns, so no validation needed here

        # Check for quote items
        items_result = supabase.table("quote_items").select("id")\
            .eq("quote_id", str(quote_id))\
            .execute()

        if not items_result.data or len(items_result.data) == 0:
            validation_errors.append("Quote has no products")

        # If validation errors, return them
        if validation_errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Quote is missing required data for specification export",
                    "errors": validation_errors
                }
            )

        # 5. Generate specification DOCX
        file_path = await generate_specification(
            quote_id=quote_id,
            contract_id=request.contract_id,
            org_id=user.current_organization_id,
            user_id=user.id,
            additional_conditions=request.additional_conditions,
            supabase_client=supabase,
            warehouse_index=request.warehouse_index,
            delivery_address_id=request.delivery_address_id,
            signatory_contact_id=request.signatory_contact_id
        )

        # 6. Return file as download
        # Use RFC 5987 encoding for UTF-8 filenames (Cyrillic support)
        from urllib.parse import quote
        filename = os.path.basename(file_path)
        filename_encoded = quote(filename, safe='')
        return FileResponse(
            path=file_path,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename=filename,
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{filename_encoded}"
            }
        )

    except HTTPException:
        raise
    except ValueError as e:
        # Handle validation errors from service
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except FileNotFoundError as e:
        # Handle template not found
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Template configuration error: {str(e)}"
        )
    except Exception as e:
        # Handle any other errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate specification: {str(e)}"
        )
