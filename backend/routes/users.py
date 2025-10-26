"""
User Profile Management Routes

Provides endpoints for users to manage their profile information,
including manager contact details for quote exports.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional
import re
import os
from supabase import create_client, Client
from auth import get_current_user, User

router = APIRouter(prefix="/api/users", tags=["users"])


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class UserProfileResponse(BaseModel):
    """User profile response model"""
    user_id: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    title: Optional[str] = None
    bio: Optional[str] = None
    manager_name: Optional[str] = None
    manager_phone: Optional[str] = None
    manager_email: Optional[str] = None
    last_active_organization_id: Optional[str] = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class UpdateUserProfileRequest(BaseModel):
    """Request model for updating user profile"""
    manager_name: Optional[str] = Field(None, max_length=255)
    manager_phone: Optional[str] = Field(None, max_length=50)
    manager_email: Optional[EmailStr] = None

    @validator('manager_phone')
    def validate_phone(cls, v):
        """Validate phone format: allow +7, 8, and international formats"""
        if v is None or v == '':
            return v

        # Remove spaces, dashes, parentheses for validation
        phone_clean = re.sub(r'[\s\-\(\)]', '', v)

        # Allow international format (+7..., +1..., etc.) or Russian format (8...)
        # Must be 10-15 digits after cleaning
        if not re.match(r'^(\+?\d{10,15})$', phone_clean):
            raise ValueError(
                'Phone must be in format: +7XXXXXXXXXX, 8XXXXXXXXXX, or international format'
            )

        return v


# ============================================================================
# ROUTES
# ============================================================================

@router.get("/profile", response_model=UserProfileResponse)
async def get_user_profile(user: User = Depends(get_current_user)):
    """
    Get current user's profile including manager info.

    Returns:
        UserProfileResponse: User profile data
    """
    try:
        # Initialize Supabase client
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        # Fetch user profile
        result = supabase.table("user_profiles").select("*").eq(
            "user_id", str(user.id)
        ).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )

        profile = result.data[0]

        return UserProfileResponse(**profile)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch user profile: {str(e)}"
        )


@router.put("/profile", response_model=UserProfileResponse)
async def update_user_profile(
    profile_update: UpdateUserProfileRequest,
    user: User = Depends(get_current_user)
):
    """
    Update current user's manager info.

    Validates email and phone formats before updating.

    Args:
        profile_update: Manager info to update

    Returns:
        UserProfileResponse: Updated profile data
    """
    try:
        # Initialize Supabase client
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        # Build update dict (only include non-None values)
        update_data = profile_update.dict(exclude_unset=True)

        if not update_data:
            # No fields to update, just return current profile
            return await get_user_profile(user)

        # Update user profile
        result = supabase.table("user_profiles").update(update_data).eq(
            "user_id", str(user.id)
        ).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )

        updated_profile = result.data[0]

        return UserProfileResponse(**updated_profile)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user profile: {str(e)}"
        )
