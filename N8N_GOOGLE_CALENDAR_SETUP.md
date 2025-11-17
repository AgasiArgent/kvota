# n8n Google Calendar Integration Setup

**Purpose:** Automatically create Google Calendar meetings when leads are imported or manually created
**Created:** 2025-11-17
**Tech Stack:** n8n + Google Calendar API + FastAPI backend

---

## Overview

**Architecture:**
```
Lead Webhook/Manual Button → Backend API → n8n Webhook → Google Calendar API
                                                ↓
                                      Callback to Backend
                                   (stores event_id & meet link)
```

**Two Trigger Methods:**
1. **Automatic:** When webhook imports lead with `meeting_scheduled_at`
2. **Manual:** User clicks "Создать встречу" button in pipeline card

---

## Prerequisites

1. **Google Workspace Account:** andrey@masterbearingsales.ru
2. **n8n Server:** Your self-hosted n8n instance
3. **Environment Variables:**
   - `N8N_CALENDAR_WEBHOOK_URL` - n8n webhook trigger URL
   - `WEBHOOK_SECRET` - Shared secret for n8n ↔ backend communication

---

## n8n Workflow Setup

### Workflow Nodes (5 nodes)

#### 1. Webhook Trigger Node

**Type:** Webhook
**Name:** Lead Meeting Webhook
**Settings:**
- HTTP Method: POST
- Path: `/webhook/lead-calendar` (or custom path)
- Authentication: None (validated by backend)
- Response Mode: Respond immediately

**Expected Payload:**
```json
{
  "lead_id": "uuid",
  "company_name": "ООО Пример",
  "meeting_title": "Встреча с ООО Пример",
  "meeting_time": "2025-11-20T14:00:00Z",
  "duration_minutes": 30,
  "attendee_email": "contact@example.com",
  "user_email": "andrey@masterbearingsales.ru",
  "notes": "Additional notes",
  "contact_name": "Иван Иванов",
  "contact_phone": "+79991234567"
}
```

**Copy the webhook URL** - you'll need it for `N8N_CALENDAR_WEBHOOK_URL` environment variable.

---

#### 2. Google Calendar Node

**Type:** Google Calendar
**Name:** Create Calendar Event
**Operation:** Create Event

**Authentication:**
- Click "Create New Credential"
- Select "OAuth2"
- Sign in with: andrey@masterbearingsales.ru
- Grant calendar permissions

**Event Settings:**
- **Calendar:** Primary calendar (or select specific calendar)
- **Summary:** `{{ $json.meeting_title }}`
- **Start Time:** `{{ $json.meeting_time }}`
- **End Time:** `{{ DateTime.fromISO($json.meeting_time).plus({ minutes: $json.duration_minutes }).toISO() }}`
- **Description:**
  ```
  Компания: {{ $json.company_name }}
  Контакт: {{ $json.contact_name }}
  Телефон: {{ $json.contact_phone }}

  {{ $json.notes }}

  Lead ID: {{ $json.lead_id }}
  ```
- **Attendees:** `{{ $json.attendee_email }}` (if not empty)
- **Conference Data:** Enable "Add video conferencing" (Google Meet)

**Output:** Google Calendar event with `id`, `htmlLink`, and `hangoutLink`

---

#### 3. Set Variables Node

**Type:** Set
**Name:** Extract Event Data

**Values to Set:**
```javascript
{
  "lead_id": "{{ $('Webhook Trigger').item.json.lead_id }}",
  "google_event_id": "{{ $json.id }}",
  "google_calendar_link": "{{ $json.hangoutLink }}"  // meet.google.com link
}
```

---

#### 4. HTTP Request Node (Callback to Backend)

**Type:** HTTP Request
**Name:** Update Lead with Event ID

**Request Settings:**
- **Method:** PUT
- **URL:** `https://kvota-production.up.railway.app/api/leads/{{ $json.lead_id }}/calendar-event`
- **Authentication:** None (uses webhook secret)
- **Headers:**
  ```json
  {
    "Content-Type": "application/json",
    "X-Webhook-Secret": "YOUR_WEBHOOK_SECRET"
  }
  ```
- **Body (JSON):**
  ```json
  {
    "google_event_id": "={{ $json.google_event_id }}",
    "google_calendar_link": "={{ $json.google_calendar_link }}"
  }
  ```

**Response:** Backend confirms event_id saved

---

#### 5. Respond to Webhook Node (Optional)

**Type:** Respond to Webhook
**Name:** Send Success Response

**Response Body:**
```json
{
  "success": true,
  "event_id": "={{ $json.google_event_id }}",
  "meet_link": "={{ $json.google_calendar_link }}",
  "message": "Calendar event created successfully"
}
```

---

## Environment Variables Setup

### Backend (Railway)

Add to Railway environment variables:

```bash
# n8n webhook URL (copy from n8n Webhook Trigger node)
N8N_CALENDAR_WEBHOOK_URL=https://your-n8n-server.com/webhook/lead-calendar

# Shared secret for n8n callbacks
WEBHOOK_SECRET=your-secure-random-secret-key-here
```

**Generate secure secret:**
```bash
openssl rand -base64 32
```

---

## Testing the Integration

### 1. Test Manual Meeting Creation

**Via Frontend:**
1. Go to `/leads/pipeline`
2. Find lead with scheduled meeting (orange clock icon)
3. Click "Создать встречу" button
4. Check:
   - ✅ Success message appears
   - ✅ n8n workflow executes
   - ✅ Event appears in Google Calendar
   - ✅ "Google Meet" link appears in card
   - ✅ Button disappears (meeting already created)

**Via API:**
```bash
curl -X POST https://kvota-production.up.railway.app/api/leads/{lead_id}/create-meeting \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_time": "2025-11-20T14:00:00Z",
    "duration_minutes": 30,
    "notes": "Test meeting"
  }'
```

---

### 2. Test Automatic Creation (Webhook)

**Send test webhook:**
```bash
curl -X POST https://kvota-production.up.railway.app/api/leads/webhook \
  -H "X-Webhook-Secret: YOUR_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Test Company",
    "email": "test@example.com",
    "segment": "Manufacturing",
    "contact_full_name": "Test Contact",
    "contact_email": "contact@example.com",
    "meeting_scheduled_at": "2025-11-20T15:00:00Z",
    "notes": "Test lead with meeting"
  }'
```

**Expected flow:**
1. Lead created in database
2. n8n webhook triggered automatically
3. Google Calendar event created
4. n8n calls back to store event_id
5. "Google Meet" link appears in pipeline card

---

### 3. Verify in n8n

**n8n Executions View:**
- Check "Lead Meeting Webhook" workflow executions
- Verify all nodes executed successfully
- Check payload data in each step
- Verify callback to backend succeeded

---

## Database Schema

**Migration:** `032_add_google_calendar_integration.sql`

**New Columns:**
```sql
ALTER TABLE leads
ADD COLUMN google_event_id TEXT,
ADD COLUMN google_calendar_link TEXT;
```

**Apply Migration:**
```sql
-- Run in Supabase SQL Editor
\i backend/migrations/032_add_google_calendar_integration.sql
```

---

## API Endpoints

### 1. Create Meeting (Manual)

**POST** `/api/leads/{lead_id}/create-meeting`

**Auth:** Bearer token (JWT from Supabase)

**Request:**
```json
{
  "meeting_title": "Встреча с ООО Пример",
  "meeting_time": "2025-11-20T14:00:00Z",
  "duration_minutes": 30,
  "attendee_email": "contact@example.com",
  "notes": "Обсудить КП"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Calendar meeting creation initiated",
  "lead_id": "uuid"
}
```

---

### 2. Update Event ID (n8n Callback)

**PUT** `/api/leads/{lead_id}/calendar-event`

**Auth:** X-Webhook-Secret header

**Request:**
```json
{
  "google_event_id": "abc123xyz",
  "google_calendar_link": "https://meet.google.com/abc-defg-hij"
}
```

**Response:**
```json
{
  "success": true,
  "lead_id": "uuid",
  "google_event_id": "abc123xyz",
  "message": "Calendar event linked successfully"
}
```

---

## UI Features

### Pipeline Card

**Displays:**
1. **Meeting Time** (if `meeting_scheduled_at` exists)
   - Orange clock icon + formatted date/time
   - Example: "🕐 17.11, 14:00"

2. **Google Meet Link** (if `google_calendar_link` exists)
   - Blue link icon + "Google Meet"
   - Opens in new tab
   - Example: "🔗 Google Meet"

3. **Create Meeting Button** (if meeting scheduled but no event)
   - Calendar icon + "Создать встречу"
   - Triggers n8n workflow
   - Disappears after event created

**Behavior:**
- Clicking card opens lead details (except for link/button)
- Link and button have `e.stopPropagation()` to prevent card click

---

## Troubleshooting

### Problem: n8n webhook not triggering

**Check:**
1. `N8N_CALENDAR_WEBHOOK_URL` environment variable set in Railway
2. n8n workflow is active (not paused)
3. Check Railway logs for: `✅ Triggered n8n calendar workflow`
4. Check n8n logs for incoming webhook

---

### Problem: Calendar event created but not showing in card

**Check:**
1. n8n callback succeeded (check n8n HTTP Request node execution)
2. Backend received callback (check Railway logs for "Calendar event linked")
3. Database has `google_event_id` and `google_calendar_link`:
   ```sql
   SELECT id, company_name, google_event_id, google_calendar_link
   FROM leads
   WHERE meeting_scheduled_at IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 10;
   ```
4. Frontend refetched leads after event creation (may need manual refresh)

---

### Problem: "N8N webhook URL not configured" error

**Solution:**
Add to Railway environment variables:
```
N8N_CALENDAR_WEBHOOK_URL=https://your-n8n.com/webhook/lead-calendar
```

Redeploy Railway backend after adding variable.

---

## Security Considerations

1. **Webhook Secret Validation:**
   - Backend validates `X-Webhook-Secret` header on n8n callback
   - Prevents unauthorized updates to calendar event IDs

2. **JWT Authentication:**
   - Manual meeting creation requires valid user session
   - Organization isolation enforced (users can only create meetings for their org's leads)

3. **Google OAuth:**
   - Handled entirely in n8n (not exposed to frontend)
   - Refresh tokens stored securely in n8n

---

## Future Enhancements

**Possible improvements:**
1. **Update/Delete Events:**
   - If meeting time changes, update Google Calendar event
   - If lead deleted, delete calendar event

2. **Two-Way Sync:**
   - If event updated in Google Calendar, sync back to CRM
   - Use Google Calendar webhooks/push notifications

3. **Multiple Calendars:**
   - Support different calendars for different users
   - Use `assigned_to` user's calendar instead of hardcoded email

4. **Meeting Reminders:**
   - Send email/SMS reminders before meeting
   - Add reminder nodes to n8n workflow

5. **Calendar Availability:**
   - Check calendar availability before scheduling
   - Suggest alternative times if busy

---

## Files Changed

**Backend:**
- `backend/migrations/032_add_google_calendar_integration.sql` (NEW)
- `backend/routes/leads.py` (+200 lines - 2 endpoints)
- `backend/routes/leads_webhook.py` (+35 lines - auto-trigger)

**Frontend:**
- `frontend/src/lib/api/calendar-service.ts` (NEW)
- `frontend/src/lib/api/lead-service.ts` (+3 fields to interface)
- `frontend/src/app/leads/pipeline/page.tsx` (+40 lines - UI)

**Configuration:**
- Railway env vars: `N8N_CALENDAR_WEBHOOK_URL`, `WEBHOOK_SECRET`
- n8n workflow: 5 nodes (webhook, calendar, set, http, respond)

---

## Quick Reference

**Environment Variables:**
```bash
# Backend (Railway)
N8N_CALENDAR_WEBHOOK_URL=https://n8n.example.com/webhook/lead-calendar
WEBHOOK_SECRET=<32-char-random-secret>

# n8n (HTTP Request node headers)
X-Webhook-Secret=<same-as-backend-secret>
```

**API Endpoints:**
- `POST /api/leads/{id}/create-meeting` - Manual creation (auth required)
- `PUT /api/leads/{id}/calendar-event` - n8n callback (webhook secret required)

**Database Columns:**
- `leads.google_event_id` - Google Calendar event ID
- `leads.google_calendar_link` - Google Meet link

**UI Behavior:**
- Show meeting time if `meeting_scheduled_at` exists
- Show "Create Meeting" button if meeting scheduled but no `google_event_id`
- Show "Google Meet" link if `google_calendar_link` exists

---

**Last Updated:** 2025-11-17
**Status:** Implementation complete - needs n8n workflow configuration
