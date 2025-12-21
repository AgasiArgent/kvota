"""
List Presets API - CRUD operations for quote list column configurations

Presets store ag-Grid column state (visibility, order, width) for different views:
- System presets: Default department views (Sales, Logistics, Accounting, Management)
- Org presets: Shared within organization, editable by admins
- Personal presets: Private to the user who created them

TASK-008: Quote List Constructor with Department Presets
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict, Literal
from uuid import UUID
from datetime import datetime
import os

from supabase import create_client, Client
from auth import get_current_user, User, check_admin_permissions


router = APIRouter(prefix="/api/list-presets", tags=["list-presets"])


# =============================================================================
# Pydantic Models
# =============================================================================

class PresetType(str):
    """Preset type enum"""
    SYSTEM = "system"
    ORG = "org"
    PERSONAL = "personal"


class ListPresetBase(BaseModel):
    """Base model for list preset"""
    name: str = Field(..., min_length=1, max_length=100)
    department: Optional[str] = Field(
        None,
        description="Department: sales, logistics, accounting, management"
    )
    columns: Dict[str, Any] = Field(
        ...,
        description="ag-Grid column state (columnDefs, columnOrder, etc.)"
    )
    filters: Optional[Dict[str, Any]] = Field(
        None,
        description="Saved filter model"
    )
    sort_model: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="Saved sort model"
    )
    is_default: bool = Field(
        False,
        description="Whether this is the default preset for the user"
    )


class ListPresetCreate(ListPresetBase):
    """Model for creating a list preset"""
    preset_type: Literal["org", "personal"] = Field(
        "personal",
        description="Preset type: 'org' (shared) or 'personal' (private)"
    )


class ListPresetUpdate(BaseModel):
    """Model for updating a list preset"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    department: Optional[str] = None
    columns: Optional[Dict[str, Any]] = None
    filters: Optional[Dict[str, Any]] = None
    sort_model: Optional[List[Dict[str, Any]]] = None
    is_default: Optional[bool] = None


class ListPresetResponse(BaseModel):
    """Response model for list preset"""
    id: UUID
    organization_id: Optional[UUID] = None
    name: str
    preset_type: str
    department: Optional[str] = None
    created_by: Optional[UUID] = None
    columns: Dict[str, Any]
    filters: Optional[Dict[str, Any]] = None
    sort_model: Optional[List[Dict[str, Any]]] = None
    is_default: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


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

@router.get("/", response_model=List[ListPresetResponse])
async def list_presets(
    preset_type: Optional[str] = Query(
        None,
        description="Filter by type: system, org, personal"
    ),
    department: Optional[str] = Query(
        None,
        description="Filter by department: sales, logistics, accounting, management"
    ),
    user: User = Depends(get_current_user)
) -> List[ListPresetResponse]:
    """
    List all presets available to the current user.

    Returns:
    - All system presets (organization_id IS NULL)
    - Org presets for user's organization
    - User's personal presets

    Sorted by: preset_type (system first), then by name
    """
    supabase = get_supabase_client()

    # Build query for system presets (organization_id IS NULL)
    system_query = supabase.table("list_presets").select("*").is_("organization_id", "null")

    # Build query for org presets
    org_query = supabase.table("list_presets").select("*").eq(
        "organization_id", str(user.current_organization_id)
    ).eq("preset_type", "org")

    # Build query for personal presets
    personal_query = supabase.table("list_presets").select("*").eq(
        "created_by", str(user.id)
    ).eq("preset_type", "personal")

    # Apply filters to all queries
    if department:
        system_query = system_query.eq("department", department)
        org_query = org_query.eq("department", department)
        personal_query = personal_query.eq("department", department)

    # Execute queries
    presets = []

    if preset_type is None or preset_type == "system":
        system_result = system_query.order("name").execute()
        presets.extend(system_result.data)

    if preset_type is None or preset_type == "org":
        org_result = org_query.order("name").execute()
        presets.extend(org_result.data)

    if preset_type is None or preset_type == "personal":
        personal_result = personal_query.order("name").execute()
        presets.extend(personal_result.data)

    # Sort: system first, then org, then personal, then by name
    type_order = {"system": 0, "org": 1, "personal": 2}
    presets.sort(key=lambda p: (type_order.get(p["preset_type"], 99), p["name"]))

    return [ListPresetResponse(**p) for p in presets]


@router.get("/{preset_id}", response_model=ListPresetResponse)
async def get_preset(
    preset_id: UUID,
    user: User = Depends(get_current_user)
) -> ListPresetResponse:
    """Get a single preset by ID"""
    supabase = get_supabase_client()

    result = supabase.table("list_presets").select("*").eq(
        "id", str(preset_id)
    ).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пресет не найден"
        )

    preset = result.data[0]

    # Check access permissions
    if preset["preset_type"] == "system":
        # System presets are visible to all
        pass
    elif preset["preset_type"] == "org":
        # Org presets visible to org members
        if preset["organization_id"] != str(user.current_organization_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Нет доступа к этому пресету"
            )
    elif preset["preset_type"] == "personal":
        # Personal presets visible only to creator
        if preset["created_by"] != str(user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Нет доступа к этому пресету"
            )

    return ListPresetResponse(**preset)


@router.post("/", response_model=ListPresetResponse, status_code=status.HTTP_201_CREATED)
async def create_preset(
    preset: ListPresetCreate,
    user: User = Depends(get_current_user)
) -> ListPresetResponse:
    """
    Create a new list preset.

    - Personal presets: Any authenticated user can create
    - Org presets: Admin/Owner only
    - System presets: Cannot be created via API
    """
    supabase = get_supabase_client()

    # Validate preset type
    if preset.preset_type not in ["org", "personal"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Тип пресета должен быть 'org' или 'personal'"
        )

    # Check admin permissions for org presets
    if preset.preset_type == "org":
        await check_admin_permissions(user)

    # Validate department if provided
    valid_departments = ["sales", "logistics", "accounting", "management"]
    if preset.department and preset.department not in valid_departments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недопустимый отдел. Допустимые значения: {', '.join(valid_departments)}"
        )

    # Check for duplicate name within same scope
    if preset.preset_type == "org":
        existing = supabase.table("list_presets").select("id").eq(
            "organization_id", str(user.current_organization_id)
        ).eq("preset_type", "org").eq("name", preset.name).execute()
    else:
        existing = supabase.table("list_presets").select("id").eq(
            "created_by", str(user.id)
        ).eq("preset_type", "personal").eq("name", preset.name).execute()

    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Пресет с названием '{preset.name}' уже существует"
        )

    # If this preset is being set as default, unset other defaults
    if preset.is_default:
        if preset.preset_type == "personal":
            # Unset other personal defaults for this user
            supabase.table("list_presets").update({"is_default": False}).eq(
                "created_by", str(user.id)
            ).eq("preset_type", "personal").eq("is_default", True).execute()

    # Create the preset
    insert_data = {
        "organization_id": str(user.current_organization_id),
        "name": preset.name,
        "preset_type": preset.preset_type,
        "department": preset.department,
        "created_by": str(user.id),
        "columns": preset.columns,
        "filters": preset.filters,
        "sort_model": preset.sort_model,
        "is_default": preset.is_default
    }

    result = supabase.table("list_presets").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось создать пресет"
        )

    return ListPresetResponse(**result.data[0])


@router.put("/{preset_id}", response_model=ListPresetResponse)
async def update_preset(
    preset_id: UUID,
    preset: ListPresetUpdate,
    user: User = Depends(get_current_user)
) -> ListPresetResponse:
    """
    Update a list preset.

    - Personal presets: Only creator can update
    - Org presets: Admin/Owner only
    - System presets: Cannot be updated via API
    """
    supabase = get_supabase_client()

    # Get existing preset
    existing = supabase.table("list_presets").select("*").eq(
        "id", str(preset_id)
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пресет не найден"
        )

    existing_preset = existing.data[0]

    # Check permissions based on preset type
    if existing_preset["preset_type"] == "system":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Системные пресеты нельзя изменять"
        )
    elif existing_preset["preset_type"] == "org":
        # Check org membership and admin role
        if existing_preset["organization_id"] != str(user.current_organization_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Нет доступа к этому пресету"
            )
        await check_admin_permissions(user)
    elif existing_preset["preset_type"] == "personal":
        # Only creator can update
        if existing_preset["created_by"] != str(user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Нет доступа к этому пресету"
            )

    # Build update data
    update_data = preset.model_dump(exclude_unset=True)

    if not update_data:
        return ListPresetResponse(**existing_preset)

    # Validate department if being updated
    if "department" in update_data and update_data["department"]:
        valid_departments = ["sales", "logistics", "accounting", "management"]
        if update_data["department"] not in valid_departments:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Недопустимый отдел. Допустимые значения: {', '.join(valid_departments)}"
            )

    # Check for duplicate name if being updated
    if "name" in update_data:
        if existing_preset["preset_type"] == "org":
            dup_check = supabase.table("list_presets").select("id").eq(
                "organization_id", str(user.current_organization_id)
            ).eq("preset_type", "org").eq("name", update_data["name"]).neq(
                "id", str(preset_id)
            ).execute()
        else:
            dup_check = supabase.table("list_presets").select("id").eq(
                "created_by", str(user.id)
            ).eq("preset_type", "personal").eq("name", update_data["name"]).neq(
                "id", str(preset_id)
            ).execute()

        if dup_check.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Пресет с названием '{update_data['name']}' уже существует"
            )

    # If this preset is being set as default, unset other defaults
    if update_data.get("is_default"):
        if existing_preset["preset_type"] == "personal":
            supabase.table("list_presets").update({"is_default": False}).eq(
                "created_by", str(user.id)
            ).eq("preset_type", "personal").eq("is_default", True).neq(
                "id", str(preset_id)
            ).execute()

    # Update
    result = supabase.table("list_presets").update(update_data).eq(
        "id", str(preset_id)
    ).execute()

    return ListPresetResponse(**result.data[0])


@router.delete("/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_preset(
    preset_id: UUID,
    user: User = Depends(get_current_user)
) -> None:
    """
    Delete a list preset.

    - Personal presets: Only creator can delete
    - Org presets: Admin/Owner only
    - System presets: Cannot be deleted via API
    """
    supabase = get_supabase_client()

    # Get existing preset
    existing = supabase.table("list_presets").select("*").eq(
        "id", str(preset_id)
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пресет не найден"
        )

    existing_preset = existing.data[0]

    # Check permissions based on preset type
    if existing_preset["preset_type"] == "system":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Системные пресеты нельзя удалять"
        )
    elif existing_preset["preset_type"] == "org":
        # Check org membership and admin role
        if existing_preset["organization_id"] != str(user.current_organization_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Нет доступа к этому пресету"
            )
        await check_admin_permissions(user)
    elif existing_preset["preset_type"] == "personal":
        # Only creator can delete
        if existing_preset["created_by"] != str(user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Нет доступа к этому пресету"
            )

    # Delete
    supabase.table("list_presets").delete().eq(
        "id", str(preset_id)
    ).execute()


@router.post("/{preset_id}/duplicate", response_model=ListPresetResponse, status_code=status.HTTP_201_CREATED)
async def duplicate_preset(
    preset_id: UUID,
    new_name: Optional[str] = Query(None, description="Name for the duplicated preset"),
    user: User = Depends(get_current_user)
) -> ListPresetResponse:
    """
    Duplicate a preset as a personal preset.

    Useful for creating a personal copy of a system or org preset.
    """
    supabase = get_supabase_client()

    # Get existing preset
    existing = supabase.table("list_presets").select("*").eq(
        "id", str(preset_id)
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пресет не найден"
        )

    source_preset = existing.data[0]

    # Check access to source preset
    if source_preset["preset_type"] == "system":
        pass  # System presets are accessible to all
    elif source_preset["preset_type"] == "org":
        if source_preset["organization_id"] != str(user.current_organization_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Нет доступа к этому пресету"
            )
    elif source_preset["preset_type"] == "personal":
        if source_preset["created_by"] != str(user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Нет доступа к этому пресету"
            )

    # Generate new name if not provided
    if not new_name:
        new_name = f"{source_preset['name']} (копия)"

    # Check for duplicate name
    dup_check = supabase.table("list_presets").select("id").eq(
        "created_by", str(user.id)
    ).eq("preset_type", "personal").eq("name", new_name).execute()

    if dup_check.data:
        # Add number suffix
        base_name = new_name
        counter = 2
        while True:
            new_name = f"{base_name} {counter}"
            dup_check = supabase.table("list_presets").select("id").eq(
                "created_by", str(user.id)
            ).eq("preset_type", "personal").eq("name", new_name).execute()
            if not dup_check.data:
                break
            counter += 1

    # Create duplicate as personal preset
    insert_data = {
        "organization_id": str(user.current_organization_id),
        "name": new_name,
        "preset_type": "personal",
        "department": source_preset.get("department"),
        "created_by": str(user.id),
        "columns": source_preset["columns"],
        "filters": source_preset.get("filters"),
        "sort_model": source_preset.get("sort_model"),
        "is_default": False
    }

    result = supabase.table("list_presets").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось создать копию пресета"
        )

    return ListPresetResponse(**result.data[0])
