"""
Customer Contracts Routes - Russian B2B Quotation System
Manages supply contracts with customers for specification exports
"""
from typing import List, Optional
from uuid import UUID
from datetime import date

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from supabase import Client
from dependencies import get_supabase

from auth import get_current_user, User, require_permission


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class ContractCreate(BaseModel):
    """Request model for creating a customer contract"""
    customer_id: UUID = Field(..., description="Customer UUID")
    contract_number: str = Field(..., min_length=1, max_length=100, description="Contract number (e.g., '001/2025')")
    contract_date: date = Field(..., description="Contract date")
    notes: Optional[str] = Field(None, description="Optional notes")

    class Config:
        json_schema_extra = {
            "example": {
                "customer_id": "123e4567-e89b-12d3-a456-426614174000",
                "contract_number": "001/2025",
                "contract_date": "2025-01-15",
                "notes": "Supply contract for 2025"
            }
        }


class ContractUpdate(BaseModel):
    """Request model for updating a customer contract"""
    contract_number: Optional[str] = Field(None, min_length=1, max_length=100)
    contract_date: Optional[date] = None
    status: Optional[str] = Field(None, pattern="^(active|expired|terminated)$")
    notes: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "status": "active",
                "notes": "Updated contract notes"
            }
        }


class ContractResponse(BaseModel):
    """Response model for customer contract"""
    id: UUID
    organization_id: UUID
    customer_id: UUID
    contract_number: str
    contract_date: date
    status: str
    next_specification_number: int
    notes: Optional[str]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(
    prefix="/api/customers",
    tags=["contracts"],
    dependencies=[Depends(get_current_user)]
)


# ============================================================================
# CONTRACT CRUD OPERATIONS
# ============================================================================

@router.get("/{customer_id}/contracts", response_model=List[ContractResponse])
async def list_customer_contracts(
    customer_id: UUID,
    status_filter: Optional[str] = None,
    user: User = Depends(require_permission("customers:read")),
    supabase: Client = Depends(get_supabase)
):
    """
    List all contracts for a customer

    Filters:
    - status_filter: Filter by contract status (active, expired, terminated)
    """
    try:
        # Verify customer exists and belongs to user's organization
        customer_result = supabase.table("customers").select("id")\
            .eq("id", str(customer_id))\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not customer_result.data or len(customer_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )

        # Build query for contracts
        query = supabase.table("customer_contracts").select("*")\
            .eq("customer_id", str(customer_id))\
            .eq("organization_id", str(user.current_organization_id))

        # Apply status filter if provided
        if status_filter:
            if status_filter not in ["active", "expired", "terminated"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid status filter. Must be: active, expired, or terminated"
                )
            query = query.eq("status", status_filter)

        # Order by contract date descending (newest first)
        query = query.order("contract_date", desc=True)

        result = query.execute()

        return [ContractResponse(**contract) for contract in result.data]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch contracts: {str(e)}"
        )


@router.post("/{customer_id}/contracts", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
async def create_customer_contract(
    customer_id: UUID,
    contract: ContractCreate,
    user: User = Depends(require_permission("customers:write")),
    supabase: Client = Depends(get_supabase)
):
    """
    Create a new supply contract for a customer

    Contract number must be unique within the organization.
    """
    try:
        # Verify customer_id in request matches URL parameter
        if contract.customer_id != customer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer ID in URL does not match request body"
            )

        # Verify customer exists and belongs to user's organization
        customer_result = supabase.table("customers").select("id")\
            .eq("id", str(customer_id))\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not customer_result.data or len(customer_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )

        # Check for duplicate contract number within organization
        duplicate_check = supabase.table("customer_contracts").select("id")\
            .eq("organization_id", str(user.current_organization_id))\
            .eq("contract_number", contract.contract_number)\
            .execute()

        if duplicate_check.data and len(duplicate_check.data) > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Contract number '{contract.contract_number}' already exists in your organization"
            )

        # Create contract
        contract_data = {
            "organization_id": str(user.current_organization_id),
            "customer_id": str(contract.customer_id),
            "contract_number": contract.contract_number,
            "contract_date": contract.contract_date.isoformat(),
            "status": "active",
            "next_specification_number": 1,
            "notes": contract.notes,
            "created_by": str(user.id)
        }

        result = supabase.table("customer_contracts").insert(contract_data).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create contract"
            )

        return ContractResponse(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create contract: {str(e)}"
        )


@router.put("/contracts/{contract_id}", response_model=ContractResponse)
async def update_customer_contract(
    contract_id: UUID,
    contract: ContractUpdate,
    user: User = Depends(require_permission("customers:write")),
    supabase: Client = Depends(get_supabase)
):
    """
    Update an existing customer contract

    Only contracts belonging to the user's organization can be updated.
    """
    try:
        # Verify contract exists and belongs to user's organization
        existing_contract = supabase.table("customer_contracts").select("*")\
            .eq("id", str(contract_id))\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not existing_contract.data or len(existing_contract.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contract not found"
            )

        # Build update data (only include fields that were provided)
        update_data = {}
        if contract.contract_number is not None:
            # Check for duplicate contract number (excluding current contract)
            duplicate_check = supabase.table("customer_contracts").select("id")\
                .eq("organization_id", str(user.current_organization_id))\
                .eq("contract_number", contract.contract_number)\
                .neq("id", str(contract_id))\
                .execute()

            if duplicate_check.data and len(duplicate_check.data) > 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Contract number '{contract.contract_number}' already exists in your organization"
                )

            update_data["contract_number"] = contract.contract_number

        if contract.contract_date is not None:
            update_data["contract_date"] = contract.contract_date.isoformat()

        if contract.status is not None:
            update_data["status"] = contract.status

        if contract.notes is not None:
            update_data["notes"] = contract.notes

        # If no fields to update, return existing contract
        if not update_data:
            return ContractResponse(**existing_contract.data[0])

        # Update contract
        result = supabase.table("customer_contracts")\
            .update(update_data)\
            .eq("id", str(contract_id))\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update contract"
            )

        return ContractResponse(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update contract: {str(e)}"
        )


@router.delete("/contracts/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer_contract(
    contract_id: UUID,
    user: User = Depends(require_permission("customers:delete")),
    supabase: Client = Depends(get_supabase)
):
    """
    Delete a customer contract

    Only contracts belonging to the user's organization can be deleted.
    Warning: This will also delete all associated specification exports.
    """
    try:
        # Verify contract exists and belongs to user's organization
        existing_contract = supabase.table("customer_contracts").select("id")\
            .eq("id", str(contract_id))\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not existing_contract.data or len(existing_contract.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contract not found"
            )

        # Delete contract (CASCADE will delete associated specification_exports)
        result = supabase.table("customer_contracts")\
            .delete()\
            .eq("id", str(contract_id))\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        # Return 204 No Content on success
        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete contract: {str(e)}"
        )
