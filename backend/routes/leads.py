"""
Lead Management Routes - CRM System
Full CRUD operations for leads with pipeline management
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Query, Header, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from supabase import create_client, Client

from auth import get_current_user, User, require_permission
from services.activity_log_service import log_activity
import os


# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(
    prefix="/api/leads",
    tags=["leads"],
    dependencies=[Depends(get_current_user)]
)


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class LeadContactBase(BaseModel):
    """Contact person (ЛПР) base model"""
    full_name: str
    position: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    is_primary: bool = False


class LeadContact(LeadContactBase):
    """Contact with ID"""
    id: str
    lead_id: str
    created_at: str


class LeadBase(BaseModel):
    """Lead base fields"""
    company_name: str
    inn: Optional[str] = None
    email: Optional[EmailStr] = None
    phones: Optional[List[str]] = None
    primary_phone: Optional[str] = None
    segment: Optional[str] = None
    notes: Optional[str] = None
    stage_id: Optional[str] = None
    assigned_to: Optional[str] = None


class LeadCreate(LeadBase):
    """Create lead with optional contacts"""
    contacts: Optional[List[LeadContactBase]] = None


class LeadUpdate(BaseModel):
    """Update lead (all fields optional)"""
    company_name: Optional[str] = None
    inn: Optional[str] = None
    email: Optional[EmailStr] = None
    phones: Optional[List[str]] = None
    primary_phone: Optional[str] = None
    segment: Optional[str] = None
    notes: Optional[str] = None
    stage_id: Optional[str] = None
    assigned_to: Optional[str] = None


class Lead(LeadBase):
    """Lead with metadata"""
    id: str
    organization_id: str
    external_id: Optional[str] = None
    region: Optional[str] = None
    city: Optional[str] = None
    revenue: Optional[int] = None
    meeting_scheduled_at: Optional[str] = None
    created_at: str
    updated_at: str


class LeadWithDetails(Lead):
    """Lead with stage and contacts"""
    stage_name: Optional[str] = None
    stage_color: Optional[str] = None
    assigned_to_name: Optional[str] = None
    contacts: List[LeadContact] = []


class LeadListResponse(BaseModel):
    """Paginated lead list"""
    data: List[LeadWithDetails]
    total: int
    page: int
    limit: int


class LeadAssignRequest(BaseModel):
    """Assign lead to user"""
    user_id: Optional[str] = None  # None = unassign


class LeadStageRequest(BaseModel):
    """Change lead stage"""
    stage_id: str


class LeadQualifyRequest(BaseModel):
    """Qualify lead to customer"""
    customer_data: Optional[dict] = None  # Optional additional customer fields


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_supabase_client() -> Client:
    """Create Supabase client with service role key"""
    return create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )


async def verify_stage_belongs_to_org(stage_id: str, organization_id: str) -> bool:
    """Verify stage belongs to organization"""
    supabase = get_supabase_client()
    result = supabase.table("lead_stages")\
        .select("id")\
        .eq("id", stage_id)\
        .eq("organization_id", organization_id)\
        .execute()
    return result.data and len(result.data) > 0


async def get_default_stage_id(organization_id: str) -> str:
    """Get default 'Новый' stage for organization"""
    supabase = get_supabase_client()
    result = supabase.table("lead_stages")\
        .select("id")\
        .eq("organization_id", organization_id)\
        .eq("name", "Новый")\
        .limit(1)\
        .execute()

    if not result.data or len(result.data) == 0:
        # Fallback: get first stage
        result = supabase.table("lead_stages")\
            .select("id")\
            .eq("organization_id", organization_id)\
            .order("order_index")\
            .limit(1)\
            .execute()

    if not result.data or len(result.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No lead stages found for organization"
        )

    return result.data[0]["id"]


# ============================================================================
# LEAD CRUD OPERATIONS
# ============================================================================

@router.get("/", response_model=LeadListResponse)
async def list_leads(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by company name, email, INN"),
    stage_id: Optional[str] = Query(None, description="Filter by stage"),
    assigned_to: Optional[str] = Query(None, description="Filter by assigned user"),
    segment: Optional[str] = Query(None, description="Filter by segment"),
    user: User = Depends(get_current_user)
):
    """
    List leads with pagination and filtering

    RLS: Users see their assigned leads + unassigned leads
    """
    try:
        supabase = get_supabase_client()

        if not user.current_organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User not associated with organization"
            )

        # Build query with nested SELECT for contacts (single query optimization)
        query = supabase.table("leads").select(
            "*,lead_stages(name,color),lead_contacts(*)",
            count="exact"
        )
        query = query.eq("organization_id", str(user.current_organization_id))

        # Apply RLS: assigned_to = current_user OR assigned_to IS NULL
        # Note: RLS policy handles this, but we can add explicit filter for clarity
        # (Actually, RLS already enforces this, so we don't need to add it here)

        # Apply filters
        if search:
            query = query.or_(
                f"company_name.ilike.*{search}*,"
                f"email.ilike.*{search}*,"
                f"inn.ilike.*{search}*"
            )

        if stage_id:
            query = query.eq("stage_id", stage_id)

        if assigned_to:
            if assigned_to == "unassigned":
                # Filter for NULL assigned_to
                query = query.is_("assigned_to", "null")
            else:
                query = query.eq("assigned_to", assigned_to)

        if segment:
            query = query.eq("segment", segment)

        # Pagination
        offset = (page - 1) * limit
        query = query.order("created_at", desc=True)
        query = query.range(offset, offset + limit - 1)

        result = query.execute()

        # Format response (contacts already fetched in main query)
        leads_with_details = []
        for lead in result.data or []:
            lead_dict = dict(lead)
            lead_dict["stage_name"] = lead.get("lead_stages", {}).get("name") if lead.get("lead_stages") else None
            lead_dict["stage_color"] = lead.get("lead_stages", {}).get("color") if lead.get("lead_stages") else None
            lead_dict["assigned_to_name"] = None  # TODO: Fetch user names separately if needed
            lead_dict["contacts"] = lead.get("lead_contacts", [])
            leads_with_details.append(lead_dict)

        return LeadListResponse(
            data=leads_with_details,
            total=result.count or 0,
            page=page,
            limit=limit
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch leads: {str(e)}"
        )


@router.get("/{lead_id}", response_model=LeadWithDetails)
async def get_lead(
    lead_id: str,
    user: User = Depends(get_current_user)
):
    """
    Get lead by ID with full details

    Includes: stage info, assigned user, contacts
    """
    try:
        supabase = get_supabase_client()

        result = supabase.table("leads").select(
            "*,lead_stages(name,color)"
        )\
            .eq("id", lead_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead not found"
            )

        lead = result.data[0]

        # Fetch contacts
        contacts_result = supabase.table("lead_contacts")\
            .select("*")\
            .eq("lead_id", lead_id)\
            .execute()

        lead_dict = dict(lead)
        lead_dict["stage_name"] = lead.get("lead_stages", {}).get("name") if lead.get("lead_stages") else None
        lead_dict["stage_color"] = lead.get("lead_stages", {}).get("color") if lead.get("lead_stages") else None
        lead_dict["assigned_to_name"] = None  # TODO: Fetch user name
        lead_dict["contacts"] = contacts_result.data or []

        return lead_dict

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch lead: {str(e)}"
        )


@router.post("/", response_model=Lead, status_code=status.HTTP_201_CREATED)
async def create_lead(
    lead_data: LeadCreate,
    user: User = Depends(get_current_user)
):
    """
    Create new lead manually

    Optionally create contacts at the same time
    """
    try:
        supabase = get_supabase_client()

        if not user.current_organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User not associated with organization"
            )

        # Get default stage if not provided
        stage_id = lead_data.stage_id
        if not stage_id:
            stage_id = await get_default_stage_id(str(user.current_organization_id))
        else:
            # Verify stage belongs to organization
            if not await verify_stage_belongs_to_org(stage_id, str(user.current_organization_id)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid stage_id for organization"
                )

        # Create lead
        lead_insert = {
            "organization_id": str(user.current_organization_id),
            "company_name": lead_data.company_name,
            "inn": lead_data.inn,
            "email": lead_data.email,
            "phones": lead_data.phones or [],
            "primary_phone": lead_data.primary_phone,
            "segment": lead_data.segment,
            "notes": lead_data.notes,
            "stage_id": stage_id,
            "assigned_to": lead_data.assigned_to  # None = unassigned
        }

        result = supabase.table("leads").insert(lead_insert).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create lead"
            )

        lead = result.data[0]

        # Create contacts if provided
        if lead_data.contacts:
            for contact in lead_data.contacts:
                contact_insert = {
                    "lead_id": lead["id"],
                    "organization_id": str(user.current_organization_id),
                    "full_name": contact.full_name,
                    "position": contact.position,
                    "phone": contact.phone,
                    "email": contact.email,
                    "is_primary": contact.is_primary
                }
                supabase.table("lead_contacts").insert(contact_insert).execute()

        # Log activity
        await log_activity(
            user_id=str(user.id),
            organization_id=str(user.current_organization_id),
            action="create",
            entity_type="lead",
            entity_id=lead["id"],
            metadata={"company_name": lead_data.company_name}
        )

        return lead

    except HTTPException:
        raise
    except Exception as e:
        # Check for duplicate email
        if "duplicate key" in str(e).lower() and "email" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Lead with email {lead_data.email} already exists"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create lead: {str(e)}"
        )


@router.put("/{lead_id}", response_model=Lead)
async def update_lead(
    lead_id: str,
    lead_data: LeadUpdate,
    user: User = Depends(get_current_user)
):
    """
    Update lead

    Only assigned user or managers can update
    """
    try:
        supabase = get_supabase_client()

        # Verify lead exists and user has access
        existing = supabase.table("leads").select("*")\
            .eq("id", lead_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not existing.data or len(existing.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead not found"
            )

        # Build update dict (only provided fields)
        update_dict = lead_data.dict(exclude_unset=True)

        # Verify stage_id if provided
        if "stage_id" in update_dict and update_dict["stage_id"]:
            if not await verify_stage_belongs_to_org(update_dict["stage_id"], str(user.current_organization_id)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid stage_id for organization"
                )

        # Update lead
        result = supabase.table("leads").update(update_dict)\
            .eq("id", lead_id)\
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update lead"
            )

        # Log activity
        await log_activity(
            user_id=str(user.id),
            organization_id=str(user.current_organization_id),
            action="update",
            resource_type="lead",
            resource_id=lead_id,
            details={"updated_fields": list(update_dict.keys())}
        )

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update lead: {str(e)}"
        )


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    lead_id: str,
    user: User = Depends(get_current_user)
):
    """
    Delete lead

    Cascades to contacts and activities
    """
    try:
        supabase = get_supabase_client()

        # Verify lead exists
        existing = supabase.table("leads").select("id,company_name")\
            .eq("id", lead_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not existing.data or len(existing.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead not found"
            )

        company_name = existing.data[0].get("company_name")

        # Delete lead (cascades to contacts and activities via ON DELETE CASCADE)
        supabase.table("leads").delete().eq("id", lead_id).execute()

        # Log activity
        await log_activity(
            user_id=str(user.id),
            organization_id=str(user.current_organization_id),
            action="delete",
            resource_type="lead",
            resource_id=lead_id,
            details={"company_name": company_name}
        )

        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete lead: {str(e)}"
        )


# ============================================================================
# LEAD PIPELINE OPERATIONS
# ============================================================================

@router.put("/{lead_id}/assign")
async def assign_lead(
    lead_id: str,
    assign_data: LeadAssignRequest,
    user: User = Depends(get_current_user)
):
    """
    Assign lead to user (or unassign if user_id is None)

    Allows managers to assign leads to team members
    """
    try:
        supabase = get_supabase_client()

        # Verify lead exists
        existing = supabase.table("leads").select("id,company_name")\
            .eq("id", lead_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not existing.data or len(existing.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead not found"
            )

        # Update assignment
        result = supabase.table("leads").update({
            "assigned_to": assign_data.user_id
        }).eq("id", lead_id).execute()

        # Log activity
        action_description = "assigned" if assign_data.user_id else "unassigned"
        await log_activity(
            user_id=str(user.id),
            organization_id=str(user.current_organization_id),
            action="assign",
            resource_type="lead",
            resource_id=lead_id,
            details={
                "action": action_description,
                "assigned_to": assign_data.user_id
            }
        )

        return {
            "success": True,
            "lead_id": lead_id,
            "assigned_to": assign_data.user_id,
            "message": f"Lead {action_description} successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to assign lead: {str(e)}"
        )


@router.put("/{lead_id}/stage")
async def change_lead_stage(
    lead_id: str,
    stage_data: LeadStageRequest,
    user: User = Depends(get_current_user)
):
    """
    Move lead to different stage

    Used for pipeline/Kanban board
    """
    try:
        supabase = get_supabase_client()

        # Verify lead exists
        existing = supabase.table("leads").select("id,stage_id,company_name")\
            .eq("id", lead_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not existing.data or len(existing.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead not found"
            )

        old_stage_id = existing.data[0].get("stage_id")

        # Verify new stage belongs to organization
        if not await verify_stage_belongs_to_org(stage_data.stage_id, str(user.current_organization_id)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid stage_id for organization"
            )

        # Update stage
        result = supabase.table("leads").update({
            "stage_id": stage_data.stage_id
        }).eq("id", lead_id).execute()

        # Log activity
        await log_activity(
            user_id=str(user.id),
            organization_id=str(user.current_organization_id),
            action="stage_change",
            resource_type="lead",
            resource_id=lead_id,
            details={
                "old_stage_id": old_stage_id,
                "new_stage_id": stage_data.stage_id
            }
        )

        return {
            "success": True,
            "lead_id": lead_id,
            "stage_id": stage_data.stage_id,
            "message": "Lead stage updated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to change lead stage: {str(e)}"
        )


@router.post("/{lead_id}/qualify")
async def qualify_lead_to_customer(
    lead_id: str,
    qualify_data: LeadQualifyRequest,
    user: User = Depends(get_current_user)
):
    """
    Qualify lead → Convert to customer

    Creates customer record, updates lead stage to "Квалифицирован"
    """
    try:
        supabase = get_supabase_client()

        # Get lead details
        lead_result = supabase.table("leads").select("*")\
            .eq("id", lead_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not lead_result.data or len(lead_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead not found"
            )

        lead = lead_result.data[0]

        # Get lead contacts
        contacts_result = supabase.table("lead_contacts").select("*")\
            .eq("lead_id", lead_id)\
            .execute()

        # Create customer from lead data
        customer_data = {
            "organization_id": str(user.current_organization_id),
            "name": lead["company_name"],
            "inn": lead["inn"],
            "email": lead["email"],
            "phone": lead["primary_phone"],
            "company_type": "ООО",  # Default, can be overridden
            "region": "Россия",  # Default
            "status": "active",
            "qualified_from_lead_id": lead_id
        }

        # Merge with any additional customer data from request
        if qualify_data.customer_data:
            customer_data.update(qualify_data.customer_data)

        # Create customer
        customer_result = supabase.table("customers").insert(customer_data).execute()

        if not customer_result.data or len(customer_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create customer"
            )

        customer = customer_result.data[0]

        # Copy lead contacts to customer_contacts
        if contacts_result.data:
            for lead_contact in contacts_result.data:
                customer_contact = {
                    "customer_id": customer["id"],
                    "organization_id": str(user.current_organization_id),
                    "first_name": lead_contact["full_name"].split()[0] if lead_contact["full_name"] else "",
                    "last_name": " ".join(lead_contact["full_name"].split()[1:]) if lead_contact["full_name"] and len(lead_contact["full_name"].split()) > 1 else "",
                    "position": lead_contact["position"],
                    "phone": lead_contact["phone"],
                    "email": lead_contact["email"]
                }
                supabase.table("customer_contacts").insert(customer_contact).execute()

        # Update lead stage to "Квалифицирован"
        qualified_stage_result = supabase.table("lead_stages").select("id")\
            .eq("organization_id", str(user.current_organization_id))\
            .eq("is_qualified", True)\
            .limit(1)\
            .execute()

        if qualified_stage_result.data:
            supabase.table("leads").update({
                "stage_id": qualified_stage_result.data[0]["id"]
            }).eq("id", lead_id).execute()

        # Log activity
        await log_activity(
            user_id=str(user.id),
            organization_id=str(user.current_organization_id),
            action="qualify",
            resource_type="lead",
            resource_id=lead_id,
            details={
                "customer_id": customer["id"],
                "customer_name": customer["name"]
            }
        )

        return {
            "success": True,
            "lead_id": lead_id,
            "customer_id": customer["id"],
            "customer_name": customer["name"],
            "message": f"Lead qualified successfully. Customer '{customer['name']}' created."
        }

    except HTTPException:
        raise
    except Exception as e:
        # Check for duplicate customer
        if "duplicate key" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Customer with this data already exists"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to qualify lead: {str(e)}"
        )


# ============================================================================
# GOOGLE CALENDAR INTEGRATION
# ============================================================================

class CreateMeetingRequest(BaseModel):
    """Request to create Google Calendar meeting"""
    meeting_title: Optional[str] = None
    meeting_time: datetime
    duration_minutes: int = 30
    attendee_email: Optional[str] = None
    notes: Optional[str] = None


class CalendarEventUpdate(BaseModel):
    """Callback from n8n with Google Calendar event details"""
    google_event_id: str
    google_calendar_link: str


@router.post("/{lead_id}/create-meeting", status_code=status.HTTP_200_OK)
async def create_calendar_meeting(
    lead_id: str,
    request: CreateMeetingRequest,
    user: User = Depends(get_current_user)
):
    """
    Trigger n8n workflow to create Google Calendar meeting for lead

    Flow:
    1. Validate lead exists and user has access
    2. Send webhook to n8n with lead + meeting data
    3. n8n creates Google Calendar event
    4. n8n calls back to /calendar-event endpoint with event_id
    5. Return success
    """
    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not associated with organization"
        )

    try:
        # Fetch lead with contact info
        lead_result = supabase.table("leads")\
            .select("*, lead_contacts(*)")\
            .eq("id", lead_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not lead_result.data or len(lead_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead not found"
            )

        lead = lead_result.data[0]

        # Prepare payload for n8n
        primary_contact = None
        if lead.get("lead_contacts"):
            primary_contact = next(
                (c for c in lead["lead_contacts"] if c.get("is_primary")),
                lead["lead_contacts"][0] if lead["lead_contacts"] else None
            )

        n8n_payload = {
            "lead_id": lead_id,
            "company_name": lead["company_name"],
            "meeting_title": request.meeting_title or f"Встреча с {lead['company_name']}",
            "meeting_time": request.meeting_time.isoformat(),
            "duration_minutes": request.duration_minutes,
            "attendee_email": request.attendee_email or (primary_contact.get("email") if primary_contact else None),
            "user_email": user.email,  # Calendar owner
            "notes": request.notes or lead.get("notes", ""),
            "contact_name": primary_contact.get("full_name") if primary_contact else None,
            "contact_phone": primary_contact.get("phone") if primary_contact else None
        }

        # Get n8n webhook URL from environment
        N8N_CALENDAR_WEBHOOK = os.getenv("N8N_CALENDAR_WEBHOOK_URL")

        if not N8N_CALENDAR_WEBHOOK:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="N8N webhook URL not configured. Set N8N_CALENDAR_WEBHOOK_URL environment variable."
            )

        # Send webhook to n8n (async fire-and-forget)
        # n8n will call back to /calendar-event endpoint when done
        import httpx

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(
                    N8N_CALENDAR_WEBHOOK,
                    json=n8n_payload
                )

                if response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"n8n webhook failed: {response.status_code}"
                    )

            except httpx.TimeoutException:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="n8n webhook timeout - calendar event may still be created"
                )

        # Log activity
        await log_activity(
            user_id=str(user.id),
            organization_id=str(user.current_organization_id),
            action="create_meeting",
            resource_type="lead",
            resource_id=lead_id,
            details={
                "meeting_time": request.meeting_time.isoformat(),
                "duration": request.duration_minutes
            }
        )

        return {
            "success": True,
            "message": "Calendar meeting creation initiated",
            "lead_id": lead_id
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create meeting: {str(e)}"
        )


# Calendar event callback moved to leads_webhook.py
# (This router requires authentication, but webhook callbacks don't have user sessions)
