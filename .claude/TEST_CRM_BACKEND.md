# CRM Backend Testing Guide

**Created:** 2025-11-13
**Purpose:** Test all CRM backend APIs (webhook, leads, contacts)

---

## Prerequisites

**1. Start Backend**

```bash
cd /home/novi/workspace/tech/projects/kvota/q1-crm/backend

# Activate venv (if exists) or use system python
source venv/bin/activate  # or skip if using system python

# Start server
uvicorn main:app --reload --port 8001
```

**2. Get Authentication Token**

Login to get JWT token:

```bash
# Replace with your test user credentials
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "andrey@masterbearingsales.ru",
    "password": "password"
  }'
```

Save the `access_token` from response.

**3. Export Token**

```bash
export TOKEN="your-access-token-here"
```

---

## Test 1: Webhook Endpoint (No Auth Required)

### Health Check

```bash
curl http://localhost:8001/api/leads/webhook/health
```

**Expected:**
```json
{
  "status": "healthy",
  "endpoint": "/api/leads/webhook",
  "method": "POST",
  "authentication": "X-Webhook-Secret header required"
}
```

### Create Lead via Webhook

```bash
curl -X POST http://localhost:8001/api/leads/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: test-webhook-secret-123" \
  -d '{
    "external_id": "TEST001",
    "company_name": "ООО Тестовая компания",
    "inn": "1234567890",
    "email": "test-webhook@example.com",
    "phones": "89991234567, 89997654321",
    "primary_phone": "89991234567",
    "segment": "IT",
    "notes": "Тестовый лид из webhook",
    "contact": {
      "full_name": "Иван Тестов",
      "position": "Директор",
      "phone": "89991234567",
      "email": "ivan@example.com"
    },
    "meeting_scheduled_at": "2025-11-15T14:00:00Z",
    "result": "Онлайн-встреча"
  }'
```

**Expected:**
```json
{
  "success": true,
  "lead_id": "uuid",
  "contact_created": true,
  "activity_created": true,
  "stage": "Онлайн-встреча",
  "message": "Lead 'ООО Тестовая компания' created successfully"
}
```

**Save lead_id for next tests!**

### Test Duplicate Email (Should Fail)

```bash
# Run same request again
curl -X POST http://localhost:8001/api/leads/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: test-webhook-secret-123" \
  -d '{
    "company_name": "ООО Другая компания",
    "email": "test-webhook@example.com"
  }'
```

**Expected:** `409 Conflict` with error message about duplicate email

---

## Test 2: Leads API (Requires Auth)

### List Leads

```bash
curl http://localhost:8001/api/leads?page=1&limit=10 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:**
```json
{
  "data": [...],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

### Get Lead by ID

```bash
# Replace LEAD_ID with actual UUID from previous test
export LEAD_ID="uuid-from-webhook-test"

curl http://localhost:8001/api/leads/$LEAD_ID \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** Full lead object with stage, contacts, assigned user

### Create Lead Manually

```bash
curl -X POST http://localhost:8001/api/leads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "company_name": "ООО Ручной ввод",
    "inn": "9876543210",
    "email": "manual@example.com",
    "phones": ["89995555555"],
    "primary_phone": "89995555555",
    "segment": "Производство",
    "notes": "Создан вручную через API",
    "contacts": [
      {
        "full_name": "Петр Петров",
        "position": "Менеджер",
        "phone": "89995555555",
        "email": "petr@example.com",
        "is_primary": true
      }
    ]
  }'
```

**Expected:** Created lead with `201` status

**Save new lead_id:**
```bash
export LEAD_ID_2="uuid-from-create-response"
```

### Update Lead

```bash
curl -X PUT http://localhost:8001/api/leads/$LEAD_ID_2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "notes": "Обновленные заметки",
    "segment": "IT и Производство"
  }'
```

**Expected:** Updated lead object

### Assign Lead to User

```bash
# Get your user ID first
curl http://localhost:8001/api/users/me \
  -H "Authorization: Bearer $TOKEN"

export USER_ID="your-user-uuid"

# Assign lead
curl -X PUT http://localhost:8001/api/leads/$LEAD_ID_2/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "user_id": "'$USER_ID'"
  }'
```

**Expected:**
```json
{
  "success": true,
  "lead_id": "...",
  "assigned_to": "user-uuid",
  "message": "Lead assigned successfully"
}
```

### Change Lead Stage

```bash
# Get stage ID first
curl http://localhost:8001/api/lead-stages \
  -H "Authorization: Bearer $TOKEN"

export STAGE_ID="uuid-of-переговоры-stage"

# Change stage
curl -X PUT http://localhost:8001/api/leads/$LEAD_ID_2/stage \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "stage_id": "'$STAGE_ID'"
  }'
```

**Expected:** Success message

### Qualify Lead → Customer

```bash
curl -X POST http://localhost:8001/api/leads/$LEAD_ID_2/qualify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customer_data": {
      "company_type": "ООО",
      "region": "Москва"
    }
  }'
```

**Expected:**
```json
{
  "success": true,
  "lead_id": "...",
  "customer_id": "newly-created-customer-uuid",
  "customer_name": "ООО Ручной ввод",
  "message": "Lead qualified successfully. Customer '...' created."
}
```

**Verify customer was created:**
```bash
export CUSTOMER_ID="customer-uuid-from-response"

curl http://localhost:8001/api/customers/$CUSTOMER_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Search Leads

```bash
# Search by company name
curl "http://localhost:8001/api/leads?search=Тестовая" \
  -H "Authorization: Bearer $TOKEN"

# Filter by stage
curl "http://localhost:8001/api/leads?stage_id=$STAGE_ID" \
  -H "Authorization: Bearer $TOKEN"

# Filter unassigned leads
curl "http://localhost:8001/api/leads?assigned_to=unassigned" \
  -H "Authorization: Bearer $TOKEN"
```

### Delete Lead

```bash
curl -X DELETE http://localhost:8001/api/leads/$LEAD_ID \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** `204 No Content`

**Verify deletion:**
```bash
curl http://localhost:8001/api/leads/$LEAD_ID \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** `404 Not Found`

---

## Test 3: Lead Contacts API

### List Contacts for Lead

```bash
curl http://localhost:8001/api/lead-contacts/lead/$LEAD_ID_2 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** Array of contacts (should have 1 from creation)

### Get Contact by ID

```bash
# Get contact ID from list response
export CONTACT_ID="contact-uuid"

curl http://localhost:8001/api/lead-contacts/$CONTACT_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Create Additional Contact

```bash
curl -X POST http://localhost:8001/api/lead-contacts/lead/$LEAD_ID_2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "full_name": "Анна Смирнова",
    "position": "Главный бухгалтер",
    "phone": "89993333333",
    "email": "anna@example.com",
    "is_primary": false
  }'
```

**Expected:** Created contact with `201` status

**Save contact ID:**
```bash
export CONTACT_ID_2="new-contact-uuid"
```

### Update Contact

```bash
curl -X PUT http://localhost:8001/api/lead-contacts/$CONTACT_ID_2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "position": "Финансовый директор",
    "phone": "89994444444"
  }'
```

**Expected:** Updated contact object

### Set as Primary Contact

```bash
curl -X PATCH http://localhost:8001/api/lead-contacts/$CONTACT_ID_2/set-primary \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:**
```json
{
  "success": true,
  "contact_id": "...",
  "message": "Contact set as primary successfully"
}
```

**Verify:** List contacts again - Анна should be is_primary=true, Петр should be is_primary=false

### Delete Contact

```bash
curl -X DELETE http://localhost:8001/api/lead-contacts/$CONTACT_ID \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** `204 No Content`

---

## Test 4: Security & RLS Testing

### Test Unauthorized Access (No Token)

```bash
curl http://localhost:8001/api/leads
```

**Expected:** `401 Unauthorized` or `403 Forbidden`

### Test Invalid Webhook Secret

```bash
curl -X POST http://localhost:8001/api/leads/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: wrong-secret" \
  -d '{
    "company_name": "Test"
  }'
```

**Expected:** `403 Forbidden` - "Invalid webhook secret"

### Test Cross-Organization Access (if you have multiple orgs)

```bash
# Try to access lead from different organization
# Should return 404 Not Found due to RLS
```

---

## Test Results Checklist

**Webhook API:**
- [ ] Health check works
- [ ] Can create lead with contact and activity
- [ ] Duplicate email returns 409 Conflict
- [ ] Invalid webhook secret returns 403

**Leads API:**
- [ ] Can list leads with pagination
- [ ] Can get lead by ID with details
- [ ] Can create lead manually with contacts
- [ ] Can update lead fields
- [ ] Can assign/unassign lead
- [ ] Can change lead stage
- [ ] Can qualify lead → customer (creates customer + copies contacts)
- [ ] Can search leads (by name, email, INN)
- [ ] Can filter leads (by stage, assigned user, segment)
- [ ] Can delete lead (cascades to contacts/activities)

**Lead Contacts API:**
- [ ] Can list contacts for lead
- [ ] Can get contact by ID
- [ ] Can create contact
- [ ] Can update contact
- [ ] Can set primary contact (unsets others automatically)
- [ ] Can delete contact

**Security:**
- [ ] Unauthorized requests return 401/403
- [ ] Invalid webhook secret rejected
- [ ] RLS prevents cross-organization access
- [ ] Activity logging works for all actions

---

## Database Verification

After tests, verify data in database:

```sql
-- Check leads created
SELECT id, company_name, email, stage_id, assigned_to
FROM leads
ORDER BY created_at DESC
LIMIT 5;

-- Check contacts
SELECT lc.id, lc.full_name, lc.position, lc.is_primary, l.company_name
FROM lead_contacts lc
JOIN leads l ON lc.lead_id = l.id
ORDER BY lc.created_at DESC;

-- Check activities (meetings)
SELECT id, type, title, scheduled_at, completed, lead_id
FROM activities
WHERE lead_id IS NOT NULL
ORDER BY created_at DESC;

-- Check qualified customers
SELECT c.id, c.name, c.qualified_from_lead_id, l.company_name as original_lead
FROM customers c
LEFT JOIN leads l ON c.qualified_from_lead_id = l.id
WHERE c.qualified_from_lead_id IS NOT NULL;

-- Check activity logs
SELECT action, resource_type, resource_id, details
FROM activity_logs
WHERE resource_type IN ('lead', 'lead_contact')
ORDER BY created_at DESC
LIMIT 10;
```

---

## Troubleshooting

### Error: "User not associated with organization"

**Fix:** Login with user that belongs to an organization

### Error: "No lead stages found"

**Fix:** Run migration 031 fix script to create default stages

### Error: "Lead not found or access denied"

**Fix:** Check RLS policies, verify user has access to lead

### Backend Crashes on Start

**Check logs:**
```bash
tail -f /tmp/backend_crm.log
```

Common issues:
- Missing `.env` variables
- Database connection failed
- Import errors in new routes

---

## Performance Testing

**Load test webhook:**
```bash
for i in {1..10}; do
  curl -X POST http://localhost:8001/api/leads/webhook \
    -H "Content-Type: application/json" \
    -H "X-Webhook-Secret: test-webhook-secret-123" \
    -d "{
      \"company_name\": \"Company $i\",
      \"email\": \"test$i@example.com\"
    }" &
done
wait
```

**Expected:** All 10 leads created successfully (check database)

---

## Next Steps

After all tests pass:
1. ✅ Backend APIs are production-ready
2. ✅ Continue with Task #6 - Activities API
3. ✅ Then build frontend pages

---

**Last Updated:** 2025-11-13
**Status:** Ready for testing
