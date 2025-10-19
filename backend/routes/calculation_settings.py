"""
Calculation Settings API Routes
Admin-only endpoints for managing organization-wide calculation defaults
"""

import os
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from decimal import Decimal
from typing import Optional
from datetime import datetime
from supabase import create_client, Client

from auth import get_current_user, User

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

router = APIRouter(prefix="/api/calculation-settings", tags=["Calculation Settings"])

# ============================================================================
# Pydantic Models
# ============================================================================

class CalculationSettings(BaseModel):
    """Calculation settings response model"""
    id: str
    organization_id: str
    rate_forex_risk: float = Field(..., description="Резерв на потери на курсовой разнице (%)")
    rate_fin_comm: float = Field(..., description="Комиссия ФинАгента (%)")
    rate_loan_interest_daily: float = Field(..., description="Дневная стоимость денег (%)")
    created_at: str
    updated_at: str
    updated_by: Optional[str] = None

    # Human-readable fields
    updated_by_name: Optional[str] = None
    updated_by_role: Optional[str] = None
    organization_name: Optional[str] = None
    organization_inn: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "organization_id": "550e8400-e29b-41d4-a716-446655440001",
                "rate_forex_risk": 3.0,
                "rate_fin_comm": 2.0,
                "rate_loan_interest_daily": 0.00069,
                "created_at": "2025-10-18T10:00:00Z",
                "updated_at": "2025-10-18T10:00:00Z",
                "updated_by": "550e8400-e29b-41d4-a716-446655440002",
                "updated_by_name": "Иван Иванов",
                "updated_by_role": "admin",
                "organization_name": "ООО Мастер Бэринг",
                "organization_inn": "1234567890"
            }
        }


class CalculationSettingsCreate(BaseModel):
    """Create/Update calculation settings"""
    rate_forex_risk: float = Field(..., ge=0, le=100, description="Резерв на потери на курсовой разнице (%)")
    rate_fin_comm: float = Field(..., ge=0, le=100, description="Комиссия ФинАгента (%)")
    rate_loan_interest_daily: float = Field(..., gt=0, description="Дневная стоимость денег (decimal)")

    class Config:
        json_schema_extra = {
            "example": {
                "rate_forex_risk": 3.0,
                "rate_fin_comm": 2.0,
                "rate_loan_interest_daily": 0.00069
            }
        }


# ============================================================================
# Helper Functions
# ============================================================================

async def get_user_organization_id(user: User) -> str:
    """Get the user's organization ID"""
    # Get user's organization membership
    response = supabase.table('organization_members')\
        .select('organization_id')\
        .eq('user_id', user.id)\
        .eq('status', 'active')\
        .limit(1)\
        .execute()

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of any organization"
        )

    return response.data[0]['organization_id']


async def check_admin_permissions(user: User, organization_id: str) -> bool:
    """Check if user has admin permissions for calculation settings"""
    # Get user's membership with role
    response = supabase.table('organization_members')\
        .select('is_owner, role_id, roles(slug)')\
        .eq('user_id', user.id)\
        .eq('organization_id', organization_id)\
        .eq('status', 'active')\
        .limit(1)\
        .execute()

    if not response.data:
        return False

    member = response.data[0]

    # Check if owner or admin
    if member['is_owner']:
        return True

    # Check role slug
    if member['roles'] and member['roles']['slug'] in ('admin', 'financial_admin'):
        return True

    return False


# ============================================================================
# API Endpoints
# ============================================================================

@router.get("", response_model=CalculationSettings)
async def get_calculation_settings(user: User = Depends(get_current_user)):
    """
    Get calculation settings for user's organization

    Returns organization-wide admin-controlled defaults for:
    - rate_forex_risk: Currency exchange risk reserve %
    - rate_fin_comm: Financial agent commission %
    - rate_loan_interest_daily: Daily loan interest rate
    """
    organization_id = await get_user_organization_id(user)

    # Get organization info
    org_response = supabase.table('organizations')\
        .select('name')\
        .eq('id', organization_id)\
        .limit(1)\
        .execute()

    org_name = org_response.data[0]['name'] if org_response.data else None
    org_inn = None  # INN field doesn't exist in organizations table yet

    # Get settings for organization
    response = supabase.table('calculation_settings')\
        .select('*')\
        .eq('organization_id', organization_id)\
        .limit(1)\
        .execute()

    if not response.data:
        # Return default settings if none exist
        return CalculationSettings(
            id="",
            organization_id=organization_id,
            rate_forex_risk=3.0,
            rate_fin_comm=2.0,
            rate_loan_interest_daily=0.00069,
            created_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat(),
            updated_by=None,
            updated_by_name=None,
            updated_by_role=None,
            organization_name=org_name,
            organization_inn=org_inn
        )

    settings = response.data[0]

    # Get updated_by user info if exists
    # Note: Simplified - skipping user info fetch for now due to schema complexity
    updated_by_name = None
    updated_by_role = None

    return CalculationSettings(
        id=settings['id'],
        organization_id=settings['organization_id'],
        rate_forex_risk=float(settings['rate_forex_risk']),
        rate_fin_comm=float(settings['rate_fin_comm']),
        rate_loan_interest_daily=float(settings['rate_loan_interest_daily']),
        created_at=settings['created_at'],
        updated_at=settings['updated_at'],
        updated_by=settings.get('updated_by'),
        updated_by_name=updated_by_name,
        updated_by_role=updated_by_role,
        organization_name=org_name,
        organization_inn=org_inn
    )


@router.post("", response_model=CalculationSettings, status_code=status.HTTP_201_CREATED)
async def create_or_update_calculation_settings(
    settings_data: CalculationSettingsCreate,
    user: User = Depends(get_current_user)
):
    """
    Create or update calculation settings for user's organization

    **Admin only**. Requires owner or admin/financial_admin role.

    Creates new settings if none exist, otherwise updates existing settings.
    """
    organization_id = await get_user_organization_id(user)

    # Check admin permissions
    is_admin = await check_admin_permissions(user, organization_id)
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization owners and admins can modify calculation settings"
        )

    # Check if settings already exist
    existing_response = supabase.table('calculation_settings')\
        .select('id')\
        .eq('organization_id', organization_id)\
        .limit(1)\
        .execute()

    if existing_response.data:
        # Update existing settings
        response = supabase.table('calculation_settings')\
            .update({
                'rate_forex_risk': settings_data.rate_forex_risk,
                'rate_fin_comm': settings_data.rate_fin_comm,
                'rate_loan_interest_daily': settings_data.rate_loan_interest_daily,
                'updated_by': str(user.id)
            })\
            .eq('organization_id', organization_id)\
            .execute()
    else:
        # Create new settings
        response = supabase.table('calculation_settings')\
            .insert({
                'organization_id': organization_id,
                'rate_forex_risk': settings_data.rate_forex_risk,
                'rate_fin_comm': settings_data.rate_fin_comm,
                'rate_loan_interest_daily': settings_data.rate_loan_interest_daily,
                'updated_by': str(user.id)
            })\
            .execute()

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save calculation settings"
        )

    saved_settings = response.data[0]

    # Get organization info
    org_response = supabase.table('organizations')\
        .select('name')\
        .eq('id', organization_id)\
        .limit(1)\
        .execute()

    org_name = org_response.data[0]['name'] if org_response.data else None
    org_inn = None  # INN field doesn't exist in organizations table yet

    # Get current user's role
    user_response = supabase.table('organization_members')\
        .select('roles(name, slug)')\
        .eq('user_id', user.id)\
        .eq('organization_id', organization_id)\
        .limit(1)\
        .execute()

    user_role = None
    if user_response.data:
        role_data = user_response.data[0].get('roles', {})
        user_role = role_data.get('name') if role_data else None

    return CalculationSettings(
        id=saved_settings['id'],
        organization_id=saved_settings['organization_id'],
        rate_forex_risk=float(saved_settings['rate_forex_risk']),
        rate_fin_comm=float(saved_settings['rate_fin_comm']),
        rate_loan_interest_daily=float(saved_settings['rate_loan_interest_daily']),
        created_at=saved_settings['created_at'],
        updated_at=saved_settings['updated_at'],
        updated_by=saved_settings.get('updated_by'),
        updated_by_name=user.full_name,
        updated_by_role=user_role,
        organization_name=org_name,
        organization_inn=org_inn
    )
