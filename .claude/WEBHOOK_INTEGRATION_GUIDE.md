# Webhook Integration Guide - Make.com → CRM

**Created:** 2025-11-13
**Purpose:** Guide for integrating Make.com email parser with CRM webhook endpoint

---

## Overview

This guide explains how to set up automatic lead import from Yandex.Mail using Make.com.

**Workflow:**
```
Yandex.Mail (IMAP) → Make.com (Email parser) → Your CRM (Webhook)
```

**Time to set up:** 15-20 minutes

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Backend Setup](#backend-setup)
3. [Make.com Scenario Setup](#makecom-scenario-setup)
4. [Testing](#testing)
5. [Troubleshooting](#troubleshooting)

---

## Prerequisites

**What you need:**
- Yandex.Mail account with IMAP access
- Make.com account (free plan works)
- CRM backend running and accessible via public URL
- Webhook secret key

---

## Backend Setup

### Step 1: Generate Webhook Secret

Generate a secure random secret:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy the output (example: `Kx7dR9mP2wQ5tY8zN3cL1vB6fH4jS0gA`)

### Step 2: Add to Environment Variables

Add to your `backend/.env` file:

```bash
WEBHOOK_SECRET=Kx7dR9mP2wQ5tY8zN3cL1vB6fH4jS0gA
```

### Step 3: Restart Backend

```bash
cd backend
uvicorn main:app --reload
```

### Step 4: Verify Endpoint is Running

Test health check:

```bash
curl http://localhost:8000/api/leads/webhook/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "endpoint": "/api/leads/webhook",
  "method": "POST",
  "authentication": "X-Webhook-Secret header required"
}
```

---

## Make.com Scenario Setup

### Module 1: Email (IMAP Connection)

**1. Create new scenario in Make.com**

**2. Add "Email" module → "Watch emails"**

**3. Configure IMAP connection:**
- **IMAP Server:** `imap.yandex.ru`
- **Port:** `993`
- **SSL:** Yes
- **Email:** `your-email@yandex.ru`
- **Password:** Create App Password in Yandex Mail settings
  - Go to: Yandex Mail → Settings → Security → App passwords
  - Generate new password
  - Use this password (NOT your main Yandex password)

**4. Set watch criteria:**
- **Folder:** INBOX
- **Criteria:** All emails
- **Max results:** 1 (process one email at a time)

**5. Test module:**
- Send test email to your Yandex mailbox
- Click "Run once" in Make.com
- Verify email was received

---

### Module 2: Text Parser (Extract Fields)

**1. Add "Text parser" module → "Match pattern"**

**2. Configure pattern:**
- **Text:** Select `Text content` from Module 1 (Email body)
- **Pattern:** Use this regex pattern:

```regex
ID:\s*(?<external_id>\d+).*?
Наименование организации:\s*(?<company_name>[^\n]+).*?
ИНН:\s*(?<inn>\d+).*?
Электронная почта:\s*(?<email>[^\s\n]+).*?
Телефон статуса:\s*(?<primary_phone>[\d\s]+).*?
Телефоны:\s*(?<phones>[^\n]+).*?
Сегмент:\s*(?<segment>[^\n]+).*?
Комментарий:\s*(?<notes>.*?)Ф\.И\.О\.:.*?
Ф\.И\.О\.:\s*(?<contact_name>[^\n]+).*?
Должность:\s*(?<contact_position>[^\n]+).*?
Телефон:\s*(?<contact_phone>[^\n]+).*?
Результат:\s*(?<result>[^\n]+).*?
Дата и время встречи:\s*(?<meeting_time>[^\n]+)
```

**3. Enable flags:**
- ✅ Global match
- ✅ Case insensitive
- ✅ Multiline
- ✅ Single line (dot matches newline)

**4. Test module:**
- Run once with test email
- Verify all fields extracted correctly

---

### Module 3: HTTP (Send to Webhook)

**1. Add "HTTP" module → "Make a request"**

**2. Configure request:**

**URL:**
```
https://your-domain.com/api/leads/webhook
```
(Replace `your-domain.com` with your actual domain)

**Method:** `POST`

**Headers:**
```
Content-Type: application/json
X-Webhook-Secret: Kx7dR9mP2wQ5tY8zN3cL1vB6fH4jS0gA
```
(Use your actual webhook secret from Step 1)

**Body Type:** Raw

**Content type:** JSON (application/json)

**Request content:** (click "JSON" tab and paste:)

```json
{
  "external_id": "{{2.external_id}}",
  "company_name": "{{2.company_name}}",
  "inn": "{{2.inn}}",
  "email": "{{2.email}}",
  "phones": "{{2.phones}}",
  "primary_phone": "{{trim(2.primary_phone)}}",
  "segment": "{{2.segment}}",
  "notes": "{{2.notes}}",
  "contact": {
    "full_name": "{{2.contact_name}}",
    "position": "{{2.contact_position}}",
    "phone": "{{trim(2.contact_phone)}}"
  },
  "meeting_scheduled_at": "{{parseDate(2.meeting_time; \"DD MM YYYY после HH mm\"; \"UTC\")}}",
  "result": "{{2.result}}"
}
```

**3. Test module:**
- Run scenario
- Check response from webhook

**Expected success response:**
```json
{
  "success": true,
  "lead_id": "550e8400-e29b-41d4-a716-446655440000",
  "contact_created": true,
  "activity_created": true,
  "activity_id": "...",
  "stage": "Онлайн-встреча",
  "message": "Lead 'ООО ПП Дивеевское' created successfully"
}
```

---

### Module 4: Error Handler (Optional but Recommended)

**1. Add error handler to HTTP module:**
- Right-click HTTP module → Add error handler
- Choose "Ignore" or "Send email notification"

**2. Configure fallback:**
- On error, send notification to yourself
- Log error details

---

### Final Steps

**1. Save scenario:**
- Give it a name: "Yandex Mail → CRM Lead Import"

**2. Enable scheduling:**
- Click "Scheduling" button
- Set interval: Every 5 minutes (or as needed)

**3. Activate scenario:**
- Toggle "ON"
- Scenario will now run automatically

---

## Testing

### Test 1: Send Test Email

**1. Send email with this format to your Yandex mailbox:**

```
Название проекта: Test Project
ID: 12345
Дата статуса: 13.11.2025 15:00
Телефон статуса: 88313442001
Статус: Успешно завершен
Наименование организации: ООО Тест
ИНН: 1234567890
Электронная почта: test@example.com
Телефоны: 88313421843, 88313442001
Сегмент: Тестовый сегмент
Комментарий: Тестовый комментарий

Ф.И.О.: Иван Иванов
Должность: Директор
Телефон: 89991234567
Результат: Онлайн-встреча
Дата и время встречи: 14 11 2025 после 14 00
```

**2. Wait for Make.com to process (5 minutes max)**

**3. Check CRM database:**

```sql
SELECT * FROM leads WHERE company_name = 'ООО Тест';
SELECT * FROM lead_contacts WHERE lead_id = '[lead_id from above]';
SELECT * FROM activities WHERE lead_id = '[lead_id from above]';
```

**4. Verify:**
- ✅ Lead created with correct data
- ✅ Contact created with "Иван Иванов"
- ✅ Activity created for meeting on 14.11.2025
- ✅ Lead assigned to stage "Онлайн-встреча"

---

### Test 2: Duplicate Email Handling

**1. Send same email again**

**2. Check Make.com execution:**
- Should receive error: `409 Conflict`
- Error message: "Lead with email test@example.com already exists"

**3. Verify:**
- ✅ No duplicate lead created
- ✅ Original lead unchanged

---

### Test 3: Manual Webhook Call (cURL)

**For debugging, call webhook directly:**

```bash
curl -X POST http://localhost:8000/api/leads/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_WEBHOOK_SECRET" \
  -d '{
    "external_id": "99999",
    "company_name": "ООО Тестовая компания",
    "inn": "9876543210",
    "email": "curl-test@example.com",
    "phones": "89991234567",
    "primary_phone": "89991234567",
    "segment": "IT",
    "notes": "Test via cURL",
    "contact": {
      "full_name": "Тест Тестов",
      "position": "CTO",
      "phone": "89991234567"
    },
    "meeting_scheduled_at": "2025-11-15T14:00:00Z",
    "result": "Звонок назначен"
  }'
```

**Expected response:** Success with lead_id

---

## Troubleshooting

### Error: "Invalid webhook secret"

**Problem:** `403 Forbidden` response

**Solutions:**
1. Check `WEBHOOK_SECRET` in backend `.env` file
2. Verify `X-Webhook-Secret` header in Make.com HTTP module
3. Ensure no extra spaces in secret key
4. Restart backend after changing `.env`

---

### Error: "No organizations found"

**Problem:** `500 Internal Server Error` - "No organizations found in database"

**Solutions:**
1. Check database has at least one organization:
   ```sql
   SELECT COUNT(*) FROM organizations;
   ```
2. If zero, create organization via frontend signup
3. Or specify `organization_id` in webhook payload

---

### Error: "Failed to create lead"

**Problem:** `500 Internal Server Error` with database error

**Possible causes:**
1. **Duplicate email:** Email already exists in organization
   - Solution: Use different email or delete existing lead
2. **Invalid stage_id:** Stage not found
   - Solution: Check lead_stages table has default stages
3. **Missing required fields:** company_name is null
   - Solution: Verify Text Parser extracted company_name

**Check logs:**
```bash
# Backend logs (in terminal where uvicorn runs)
tail -f backend/logs/app.log
```

---

### Email Not Received by Make.com

**Problem:** Scenario not triggering

**Solutions:**
1. Check IMAP credentials:
   - Login to Yandex Mail manually
   - Verify App Password is correct (not main password)
2. Check Make.com scenario status:
   - Is scenario "ON"?
   - Check execution history for errors
3. Test IMAP connection:
   ```bash
   telnet imap.yandex.ru 993
   ```

---

### Regex Not Extracting Fields

**Problem:** Module 2 (Text Parser) returns empty

**Solutions:**
1. Check email format matches regex
2. Enable all regex flags (Global, Case insensitive, Multiline, Single line)
3. Test regex with online tool: https://regex101.com/
4. Verify email body encoding (should be UTF-8)

---

## Advanced Configuration

### Custom Organization Mapping

**By email domain:**

Modify `get_organization_id()` in `backend/routes/leads_webhook.py`:

```python
async def get_organization_id(payload: LeadWebhookPayload) -> str:
    """Map email domain to organization"""
    supabase = get_supabase_client()

    if payload.email:
        # Extract domain
        domain = payload.email.split("@")[1]

        # Map domain to organization
        DOMAIN_TO_ORG = {
            "example.com": "org-uuid-1",
            "test.com": "org-uuid-2"
        }

        if domain in DOMAIN_TO_ORG:
            return DOMAIN_TO_ORG[domain]

    # Fallback to first organization
    result = supabase.table("organizations").select("id").limit(1).execute()
    return result.data[0]["id"]
```

---

### Rate Limiting

Webhook has global rate limit: **50 requests/minute**

For higher volume:
1. Increase limit in `backend/main.py`:
   ```python
   limiter = Limiter(
       key_func=get_remote_address,
       default_limits=["100/minute"]  # Increase to 100
   )
   ```

2. Or disable for webhook endpoint:
   ```python
   @router.post("/webhook")
   @limiter.exempt  # Disable rate limiting
   async def receive_lead_from_webhook(...):
   ```

---

## Monitoring

### Webhook Success Rate

**Query database:**
```sql
-- Total leads imported via webhook today
SELECT COUNT(*)
FROM leads
WHERE external_id IS NOT NULL
AND created_at >= CURRENT_DATE;

-- Leads by stage
SELECT ls.name, COUNT(*)
FROM leads l
JOIN lead_stages ls ON l.stage_id = ls.id
WHERE l.external_id IS NOT NULL
GROUP BY ls.name;
```

### Make.com Execution History

**Check in Make.com:**
1. Go to scenario
2. Click "History" tab
3. See all executions with success/error status
4. Click execution to see details

---

## Security Best Practices

1. **Use strong webhook secret** (32+ random characters)
2. **Enable HTTPS** in production (required!)
3. **Rotate webhook secret** periodically (every 90 days)
4. **Monitor webhook logs** for suspicious activity
5. **Validate all input** (already implemented in endpoint)
6. **Rate limiting** enabled by default

---

## Next Steps

After webhook is working:

1. **Add Google Calendar integration** (Task #7)
   - Auto-create calendar events for meetings
   - Sync with manager's calendar

2. **Build frontend CRM pages** (Tasks #8-11)
   - Leads pipeline (Kanban)
   - Lead detail pages
   - Manual lead creation form

3. **Implement lead assignment**
   - Auto-assign to manager based on segment
   - Or leave unassigned for manual grab

---

## Support

**Issues? Contact:**
- Backend errors: Check `backend/logs/app.log`
- Make.com issues: Check scenario execution history
- Database issues: Check Supabase logs

**Documentation:**
- FastAPI docs: http://localhost:8000/api/docs
- Make.com help: https://www.make.com/en/help
- Supabase docs: https://supabase.com/docs

---

**Last Updated:** 2025-11-13
**Version:** 1.0
