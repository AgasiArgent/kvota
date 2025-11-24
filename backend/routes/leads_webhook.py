"""
Lead Webhook Routes - Make.com Integration
Accepts leads from Make.com email parser and creates CRM records
"""
from typing import Optional
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel
from supabase import create_client, Client
import os

from services.activity_log_service import log_activity


# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(
    prefix="/api/leads",
    tags=["leads_webhook"]
    # No authentication dependency - webhook validates via secret header
)


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class ContactData(BaseModel):
    """Contact person data (ЛПР)"""
    full_name: str
    position: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class LeadWebhookPayload(BaseModel):
    """Payload from Make.com webhook"""
    # External ID from call tracking system
    external_id: Optional[str] = None

    # Company information
    company_name: str
    inn: Optional[str] = None
    email: Optional[str] = None  # Changed from EmailStr to str for legacy data
    phones: Optional[str] = None  # Comma-separated: "88313421843, 88313442001"
    primary_phone: Optional[str] = None
    segment: Optional[str] = None  # Industry/segment
    region: Optional[str] = None  # Регион
    city: Optional[str] = None  # Населенный пункт
    revenue: Optional[int] = None  # Выручка

    # Notes
    notes: Optional[str] = None

    # Contact person (ЛПР) - flat fields from n8n
    contact_full_name: Optional[str] = None
    contact_position: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None

    # Activity/Meeting
    meeting_scheduled_at: Optional[datetime] = None
    result: Optional[str] = None  # Stage name like "Онлайн-встреча"

    # Organization mapping (optional - can be derived from email domain)
    organization_id: Optional[str] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_supabase_client() -> Client:
    """Create Supabase client with service role key"""
    return create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )


async def get_organization_id(payload: LeadWebhookPayload) -> str:
    """
    Get organization ID from payload or default to first organization

    In production, you can:
    - Map email domain to organization
    - Use external_id to lookup organization
    - Require organization_id in payload
    """
    supabase = get_supabase_client()

    # If organization_id provided in payload, use it
    if payload.organization_id:
        # Verify organization exists
        result = supabase.table("organizations").select("id")\
            .eq("id", payload.organization_id)\
            .execute()

        if result.data and len(result.data) > 0:
            return payload.organization_id

    # Otherwise, use Master Bearing organization
    # TODO: Implement proper organization mapping by email domain
    # Hardcode to "ООО Мастер Бэринг" for production
    return "69ff6eda-3fd6-4d24-88b7-a9977c7a08b0"

    # Fallback to first organization
    result = supabase.table("organizations").select("id").limit(1).execute()

    if not result.data or len(result.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No organizations found in database"
        )

    return result.data[0]["id"]


def map_result_to_stage(result: str) -> str:
    """Map email result to stage name"""
    mapping = {
        "Онлайн-встреча": "Звонок назначен",
        "Звонок специалиста (не срочно)": "Звонок специалиста (не срочно)",
        "Звонок специалиста (срочно)": "Звонок назначен",  # NEW - urgent calls go to scheduled stage
        "Звонок специалиста + отправка КП (не срочно)": "Отправить письмо",
        "Отправка КП": "Отправить письмо",
    }
    return mapping.get(result, "Отправить письмо")


async def get_or_create_stage(organization_id: str, stage_name: str) -> dict:
    """
    Find or create lead stage by name

    Args:
        organization_id: Organization UUID
        stage_name: Stage name like "Онлайн-встреча"

    Returns:
        Stage record dict
    """
    supabase = get_supabase_client()

    # Try to find existing stage
    result = supabase.table("lead_stages")\
        .select("*")\
        .eq("organization_id", organization_id)\
        .eq("name", stage_name)\
        .execute()

    if result.data and len(result.data) > 0:
        return result.data[0]

    # Create new stage if not found
    # Get max order_index for this org
    max_order_result = supabase.table("lead_stages")\
        .select("order_index")\
        .eq("organization_id", organization_id)\
        .order("order_index", desc=True)\
        .limit(1)\
        .execute()

    next_order = 1
    if max_order_result.data and len(max_order_result.data) > 0:
        next_order = max_order_result.data[0]["order_index"] + 1

    new_stage = {
        "organization_id": organization_id,
        "name": stage_name,
        "order_index": next_order,
        "color": "#1890ff",
        "is_qualified": False,
        "is_failed": False
    }

    result = supabase.table("lead_stages").insert(new_stage).execute()
    return result.data[0]


async def parse_phones(phones_str: Optional[str]) -> list:
    """
    Parse comma-separated phone string into array

    Args:
        phones_str: "88313421843, 88313442001"

    Returns:
        ["88313421843", "88313442001"]
    """
    if not phones_str:
        return []

    return [phone.strip() for phone in phones_str.split(",") if phone.strip()]


# ============================================================================
# WEBHOOK ENDPOINT
# ============================================================================

@router.post("/webhook")
async def receive_lead_from_webhook(
    payload: LeadWebhookPayload,
    x_webhook_secret: Optional[str] = Header(None, alias="X-Webhook-Secret")
):
    """
    Receive lead data from Make.com webhook

    Security: Validates webhook secret from X-Webhook-Secret header

    Creates:
    - Lead record
    - Contact record (if provided)
    - Activity record (if meeting scheduled)

    Returns:
        success: bool
        lead_id: UUID
        message: str
    """
    # ========================================================================
    # STEP 1: Security - Verify webhook secret
    # ========================================================================

    WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "your-secret-key-change-in-production")

    if x_webhook_secret != WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid webhook secret"
        )

    # ========================================================================
    # STEP 2: Get organization ID
    # ========================================================================

    try:
        organization_id = await get_organization_id(payload)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to determine organization: {str(e)}"
        )

    # ========================================================================
    # STEP 3: Get or create stage
    # ========================================================================

    # Map result to stage name
    result_text = payload.result if payload.result else "Отправка КП"
    stage_name = map_result_to_stage(result_text)

    try:
        stage = await get_or_create_stage(organization_id, stage_name)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get/create stage: {str(e)}"
        )

    # ========================================================================
    # STEP 4: Parse phones
    # ========================================================================

    phones_array = await parse_phones(payload.phones)
    primary_phone = payload.primary_phone or (phones_array[0] if phones_array else None)

    # ========================================================================
    # STEP 5: Create lead
    # ========================================================================

    supabase = get_supabase_client()

    lead_data = {
        "organization_id": organization_id,
        "external_id": payload.external_id,
        "company_name": payload.company_name,
        "inn": payload.inn,
        "email": payload.email,
        "phones": phones_array,
        "primary_phone": primary_phone,
        "segment": payload.segment,
        "region": payload.region,
        "city": payload.city,
        "revenue": payload.revenue,
        "notes": payload.notes,
        "stage_id": stage["id"],
        "meeting_scheduled_at": payload.meeting_scheduled_at.isoformat() if payload.meeting_scheduled_at else None,
        "assigned_to": "97ccad9e-ae96-4be5-ba07-321e07e8ee1e"  # Auto-assign to andrey@masterbearingsales.ru
    }

    try:
        # First, check if lead with this email already exists
        existing_lead = None
        if payload.email:
            existing_result = supabase.table("leads").select("id,company_name")\
                .eq("organization_id", organization_id)\
                .eq("email", payload.email)\
                .execute()

            if existing_result.data and len(existing_result.data) > 0:
                existing_lead = existing_result.data[0]

        if existing_lead:
            # UPDATE existing lead (upsert behavior)
            update_data = {
                "company_name": payload.company_name,
                "inn": payload.inn,
                "phones": phones_array,
                "primary_phone": primary_phone,
                "segment": payload.segment,
                "region": payload.region,
                "city": payload.city,
                "revenue": payload.revenue,
                "notes": payload.notes,
                "stage_id": stage["id"],
                "meeting_scheduled_at": payload.meeting_scheduled_at.isoformat() if payload.meeting_scheduled_at else None,
            }
            # Only update external_id if provided
            if payload.external_id:
                update_data["external_id"] = payload.external_id

            lead_result = supabase.table("leads").update(update_data)\
                .eq("id", existing_lead["id"])\
                .execute()

            if not lead_result.data or len(lead_result.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update lead"
                )

            lead = lead_result.data[0]
            print(f"✅ Updated existing lead {lead['id']} with email {payload.email}")
        else:
            # CREATE new lead
            lead_result = supabase.table("leads").insert(lead_data).execute()

            if not lead_result.data or len(lead_result.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create lead"
                )

            lead = lead_result.data[0]
            print(f"✅ Created new lead {lead['id']} with email {payload.email}")

    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create/update lead: {str(e)}"
        )

    # ========================================================================
    # STEP 6: Create contact (if provided)
    # ========================================================================

    if payload.contact_full_name:
        contact_data = {
            "lead_id": lead["id"],
            "organization_id": organization_id,
            "full_name": payload.contact_full_name,
            "position": payload.contact_position,
            "phone": payload.contact_phone,
            "email": payload.contact_email,
            "is_primary": True
        }

        try:
            supabase.table("lead_contacts").insert(contact_data).execute()
        except Exception as e:
            # Log error but don't fail the whole webhook
            print(f"Warning: Failed to create contact: {str(e)}")

    # ========================================================================
    # STEP 7: Create meeting activity (if scheduled)
    # ========================================================================

    activity_id = None

    if payload.meeting_scheduled_at:
        activity_data = {
            "organization_id": organization_id,
            "lead_id": lead["id"],
            "customer_id": None,
            "type": "meeting",
            "title": f"Встреча с {payload.company_name}",
            "notes": payload.notes,
            "result": payload.result,
            "scheduled_at": payload.meeting_scheduled_at.isoformat(),
            "duration_minutes": 15,
            "completed": False,
            "google_event_id": None,
            "assigned_to": "97ccad9e-ae96-4be5-ba07-321e07e8ee1e",  # Auto-assign to andrey@masterbearingsales.ru
            "created_by": None  # Webhook has no user context
        }

        try:
            activity_result = supabase.table("activities").insert(activity_data).execute()
            if activity_result.data and len(activity_result.data) > 0:
                activity_id = activity_result.data[0]["id"]
        except Exception as e:
            # Log error but don't fail the whole webhook
            print(f"Warning: Failed to create activity: {str(e)}")

    # ========================================================================
    # STEP 7.5: Trigger n8n to create Google Calendar event (if meeting scheduled)
    # ========================================================================

    if payload.meeting_scheduled_at:
        try:
            import httpx

            N8N_CALENDAR_WEBHOOK = os.getenv("N8N_CALENDAR_WEBHOOK_URL")

            if N8N_CALENDAR_WEBHOOK:
                # Prepare payload for n8n Google Calendar workflow
                n8n_payload = {
                    "lead_id": lead["id"],
                    "company_name": payload.company_name,
                    "meeting_title": f"Встреча с {payload.company_name}",
                    "meeting_time": payload.meeting_scheduled_at.isoformat(),
                    "duration_minutes": 30,
                    "attendee_email": payload.contact_email,
                    "user_email": "andrey@masterbearingsales.ru",  # Calendar owner
                    "notes": payload.notes or "",
                    "contact_name": payload.contact_full_name,
                    "contact_phone": payload.contact_phone
                }

                # Send to n8n asynchronously (don't wait for response)
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(N8N_CALENDAR_WEBHOOK, json=n8n_payload)

                print(f"✅ Triggered n8n calendar workflow for lead {lead['id']}")
            else:
                print("⚠️  N8N_CALENDAR_WEBHOOK_URL not configured - skipping calendar creation")

        except Exception as e:
            # Log error but don't fail the whole webhook
            print(f"Warning: Failed to trigger n8n calendar workflow: {str(e)}")

    # ========================================================================
    # STEP 8: Log activity (audit trail)
    # ========================================================================

    try:
        # Note: log_activity requires user_id, but webhook has no user
        # Store with system user or skip for webhook-created leads
        # For now, we skip activity logging for webhook imports
        pass
    except Exception as e:
        # Log error but don't fail
        print(f"Warning: Failed to log activity: {str(e)}")

    # ========================================================================
    # STEP 9: Return success response
    # ========================================================================

    return {
        "success": True,
        "lead_id": lead["id"],
        "contact_created": payload.contact_full_name is not None,
        "activity_created": activity_id is not None,
        "activity_id": activity_id,
        "stage": stage["name"],
        "message": f"Lead '{payload.company_name}' created successfully"
    }


# ============================================================================
# HEALTH CHECK ENDPOINT
# ============================================================================

@router.get("/webhook/health")
async def webhook_health_check():
    """Health check endpoint for webhook"""
    return {
        "status": "healthy",
        "endpoint": "/api/leads/webhook",
        "method": "POST",
        "authentication": "X-Webhook-Secret header required"
    }


# ============================================================================
# GOOGLE CALENDAR CALLBACK ENDPOINT
# ============================================================================

class CalendarEventUpdate(BaseModel):
    """Callback from n8n with Google Calendar event details"""
    google_event_id: str
    google_calendar_link: str


@router.put("/{lead_id}/calendar-event", status_code=status.HTTP_200_OK)
async def update_calendar_event_id(
    lead_id: str,
    event_data: CalendarEventUpdate,
    x_webhook_secret: Optional[str] = Header(None, alias="X-Webhook-Secret")
):
    """
    Callback from n8n to store Google Calendar event ID

    Called by n8n after successfully creating calendar event.
    Stores the event_id and meet link for future reference.

    Security: Validates webhook secret from X-Webhook-Secret header
    No user authentication required (webhook callback)
    """
    supabase = get_supabase_client()

    # Verify webhook secret
    WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "your-secret-key-change-in-production")

    if x_webhook_secret != WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid webhook secret"
        )

    try:
        # Update lead with Google Calendar event details
        result = supabase.table("leads")\
            .update({
                "google_event_id": event_data.google_event_id,
                "google_calendar_link": event_data.google_calendar_link
            })\
            .eq("id", lead_id)\
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead not found"
            )

        return {
            "success": True,
            "lead_id": lead_id,
            "google_event_id": event_data.google_event_id,
            "message": "Calendar event linked successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update calendar event: {str(e)}"
        )
