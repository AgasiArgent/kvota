# CRM Manual Testing Sequence

**Date:** 2025-11-13
**Purpose:** Step-by-step testing guide for CRM module
**Time:** 15-20 minutes

---

## Prerequisites

**1. Servers Running:**
```bash
# Backend (port 8001)
cd /home/novi/workspace/tech/projects/kvota/dev/backend
source venv/bin/activate
uvicorn main:app --reload --port 8001

# Frontend (port 3001)
cd /home/novi/workspace/tech/projects/kvota/dev/frontend
npm run dev -- --port 3001
```

**2. Browser:**
- Chrome at http://localhost:3001
- Logged in as: andrey@masterbearingsales.ru

**3. Database:**
- Migration 031 applied
- Default stages created

---

## Test Sequence (15 steps)

### Part 1: Navigation & UI (2 min)

**Step 1: Verify CRM Menu**
- [ ] Look at left sidebar menu
- [ ] Find "CRM" menu item (icon: UserOutlined)
- [ ] Expand CRM menu
- [ ] See: "Лиды" and "Воронка"

**Expected:**
```
CRM (icon)
├─ Лиды
└─ Воронка
```

**Step 2: Open Leads List**
- [ ] Click "CRM → Лиды"
- [ ] URL changes to `/leads`
- [ ] Page loads without errors
- [ ] See: Statistics cards + Filters + Table
- [ ] Check console: No errors (red text)

**Expected:**
- 4 statistics cards (Всего, Новые, Квалифицированы, Не назначены)
- Filter bar (search, stage dropdown, assigned dropdown, segment input)
- Empty table with message "Нет данных" (if no leads yet)

---

### Part 2: Create Lead (3 min)

**Step 3: Click "Создать лид" Button**
- [ ] Click blue "Создать лид" button (top right)
- [ ] URL changes to `/leads/create`
- [ ] Form loads with empty fields
- [ ] See form sections: Company Info + Contacts (ЛПР)

**Step 4: Fill Company Information**
- [ ] Company name: `ООО Тестовая компания`
- [ ] INN: `1234567890`
- [ ] Email: `test-crm@example.com`
- [ ] Primary phone: `89991234567`
- [ ] Additional phones: `88123456789, 89997654321`
- [ ] Segment: `Производство`
- [ ] Notes: `Тестовый лид для проверки CRM`
- [ ] Stage: Leave as "Новый" (default)

**Step 5: Add Contact (ЛПР)**
- [ ] First contact should be auto-added
- [ ] Fill Full name: `Иван Тестов`
- [ ] Position: `Генеральный директор`
- [ ] Phone: `89991234567`
- [ ] Email: `ivan@test.com`

**Step 6: Add Second Contact**
- [ ] Click "Добавить контакт" button
- [ ] New contact card appears
- [ ] Fill Full name: `Мария Петрова`
- [ ] Position: `Финансовый директор`
- [ ] Phone: `89992222222`

**Step 7: Submit Form**
- [ ] Click "Создать лид" button (bottom)
- [ ] See loading spinner on button
- [ ] Success message appears: "Лид ... успешно создан"
- [ ] Redirects to lead detail page (`/leads/{id}`)

**Step 8: Verify Lead Created**
- [ ] See company name in title: "ООО Тестовая компания"
- [ ] See stage tag: "Новый" (blue)
- [ ] Tab "Детали" is active
- [ ] See company info (INN, email, phones, segment, notes)
- [ ] See 2 contacts in list (Иван, Мария)
- [ ] Tab shows "Активности (0)"

**Check Console:** No errors

---

### Part 3: Lead List & Filters (2 min)

**Step 9: Return to Leads List**
- [ ] Click "Назад" button OR click "CRM → Лиды" in menu
- [ ] URL: `/leads`
- [ ] Table shows 1 lead (the one we just created)
- [ ] Statistics updated: "Всего лидов: 1", "Новые: 1"

**Step 10: Test Search**
- [ ] Type "Тестовая" in search box
- [ ] Press Enter or click search icon
- [ ] Table updates to show matching lead
- [ ] Clear search
- [ ] Table shows all leads again

**Step 11: Test Stage Filter**
- [ ] Click "Этап" dropdown
- [ ] See all stages with colored tags
- [ ] Select "Новый"
- [ ] Table filters to show only "Новый" leads
- [ ] Clear filter (X icon)

**Check Console:** No errors

---

### Part 4: Pipeline/Kanban (2 min)

**Step 12: Switch to Pipeline View**
- [ ] Click "Воронка" button (top right)
- [ ] URL changes to `/leads/pipeline`
- [ ] See columns for each stage (6 columns horizontally)
- [ ] Column "Новый" has 1 lead card
- [ ] Other columns are empty

**Step 13: View Lead Card**
- [ ] See card with company name: "ООО Тестовая компания"
- [ ] See segment tag: "Производство"
- [ ] See primary contact: "Иван Тестов • Генеральный директор"
- [ ] See email and phone icons with info
- [ ] See dropdown: "Переместить в..."

**Step 14: Move Lead to Next Stage**
- [ ] Click dropdown on lead card
- [ ] Select "Звонок назначен"
- [ ] Success message: "Лид перемещен"
- [ ] Card disappears from "Новый" column
- [ ] Card appears in "Звонок назначен" column
- [ ] Column counts update

**Check Console:** No errors

---

### Part 5: Qualify Lead → Customer (3 min)

**Step 15: Open Lead Detail**
- [ ] Click on lead card in pipeline
- [ ] OR click "Таблица" button → click company name
- [ ] URL: `/leads/{id}`
- [ ] See lead details

**Step 16: Verify Current Stage**
- [ ] Stage tag shows current stage (e.g., "Звонок назначен")
- [ ] Move to "Квалифицирован" if needed:
  - Click "Редактировать" → change stage → save
  - OR use dropdown in pipeline

**Step 17: Qualify Lead**
- [ ] On lead detail page, find "Квалифицировать" button (green, top right)
- [ ] Click "Квалифицировать"
- [ ] Confirmation dialog appears:
  ```
  Квалифицировать лид?
  Создать клиента из лида "ООО Тестовая компания"?
  ```
- [ ] Click "Да"
- [ ] Success message: "Лид квалифицирован. Создан клиент ..."
- [ ] Redirects to customer detail page (`/customers/{id}`)

**Step 18: Verify Customer Created**
- [ ] URL is now `/customers/{id}` (different ID than lead)
- [ ] Customer name: "ООО Тестовая компания"
- [ ] INN: `1234567890`
- [ ] Email: `test-crm@example.com`
- [ ] Phone: `89991234567`

**Step 19: Verify Contacts Copied**
- [ ] Scroll down to "Контакты" section
- [ ] See 2 contacts:
  - Иван Тестов (Генеральный директор)
  - Мария Петрова (Финансовый директор)
- [ ] Contacts have same data as from lead

**Step 20: Verify Lead Updated**
- [ ] Go back to `/leads`
- [ ] Find the qualified lead in table
- [ ] Stage should be "Квалифицирован" (green tag)
- [ ] Lead still exists (not deleted)

**Check Console:** No errors

---

### Part 6: Create Quote from Customer (2 min)

**Step 21: Create Quote**
- [ ] From customer detail page, click "Создать КП" button
- [ ] OR go to `/quotes/create`
- [ ] Select customer: "ООО Тестовая компания"
- [ ] Fill quote data (minimal: 1 product)
- [ ] Save quote
- [ ] Quote created successfully

**Expected:** Full end-to-end flow works:
```
Lead → Qualified → Customer → Quote
```

---

### Part 7: Webhook Testing (5 min) - OPTIONAL

**Step 22: Test Webhook Endpoint**

Open new terminal:

```bash
curl -X POST http://localhost:8001/api/leads/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: test-webhook-secret-123" \
  -d '{
    "external_id": "WEBHOOK001",
    "company_name": "ООО Webhook Test",
    "inn": "9999999999",
    "email": "webhook@example.com",
    "phones": "89995555555",
    "primary_phone": "89995555555",
    "segment": "IT",
    "notes": "Created via webhook",
    "contact": {
      "full_name": "Webhook Contact",
      "position": "Manager"
    },
    "result": "Новый"
  }'
```

**Step 23: Verify Webhook Lead**
- [ ] Refresh leads list (`/leads`)
- [ ] See new lead: "ООО Webhook Test"
- [ ] Open lead detail
- [ ] Verify contact "Webhook Contact" exists
- [ ] External ID: "WEBHOOK001"

**Step 24: Test Duplicate Email**
- [ ] Run same curl command again
- [ ] Should return `409 Conflict`
- [ ] Error message: "Lead with email ... already exists"
- [ ] No duplicate lead created

---

### Part 8: Activities Testing (3 min) - OPTIONAL

**Step 25: Add Activity to Lead**
- [ ] Open any lead detail page
- [ ] Switch to "Активности" tab
- [ ] Click "Добавить активность"
- [ ] Modal opens
- [ ] Fill:
  - Type: "Встреча"
  - Title: "Обсуждение КП"
  - Notes: "Нужно подготовить презентацию"
  - Duration: 30 minutes
- [ ] Click "Добавить"
- [ ] Activity appears in timeline

**Step 26: Complete Activity**
- [ ] Find activity in timeline
- [ ] Click "Завершить" button
- [ ] Activity marked as completed (green dot)
- [ ] "Завершить" button disappears

---

## Checklist Summary

**Must Test (Critical):**
- [x] CRM menu appears in navigation
- [x] Can create lead with contacts
- [x] Lead appears in list
- [x] Can move lead through pipeline
- [x] Can qualify lead → creates customer
- [x] Contacts copied to customer
- [x] Can create quote from qualified customer

**Should Test (Important):**
- [ ] Filters work (search, stage, assigned)
- [ ] Statistics update correctly
- [ ] Webhook creates lead
- [ ] Duplicate email protection works

**Nice to Test (Optional):**
- [ ] Can add/edit/delete contacts
- [ ] Can create activities
- [ ] Activities timeline works
- [ ] Can complete activities

---

## Console Errors to Watch For

**Common errors:**
1. `Cannot read property 'map' of undefined` → Data not loaded yet
2. `404 Not Found` → Backend not running or wrong URL
3. `401 Unauthorized` → Not logged in or token expired
4. `Network request failed` → Backend crashed or port mismatch

**If you see errors:**
1. Check browser console (F12)
2. Check backend logs (`tail -f /tmp/crm_backend.log`)
3. Verify ports: frontend on 3001, backend on 8001
4. Verify logged in (check top right corner for user email)

---

## Expected Results

**After all tests:**
- ✅ 1-2 leads in database
- ✅ 1 customer created from qualified lead
- ✅ Lead → Customer → Quote flow works
- ✅ No console errors
- ✅ All features working

**Database Verification:**
```sql
-- Check leads created
SELECT id, company_name, stage_id, assigned_to FROM leads;

-- Check customers with lead tracking
SELECT id, name, qualified_from_lead_id FROM customers
WHERE qualified_from_lead_id IS NOT NULL;

-- Check contacts copied
SELECT * FROM customer_contacts WHERE customer_id IN (
  SELECT id FROM customers WHERE qualified_from_lead_id IS NOT NULL
);

-- Check activities
SELECT id, type, title, lead_id, completed FROM activities;
```

---

## Quick Test Script (Automated)

**Run all basic tests at once:**

```bash
#!/bin/bash
# Save as test_crm.sh

BASE_URL="http://localhost:8001"
TOKEN="your-auth-token-here"

echo "🧪 Testing CRM Backend..."

# Test 1: Health check
echo "1. Webhook health..."
curl -s "$BASE_URL/api/leads/webhook/health" | jq '.'

# Test 2: List stages
echo "2. List stages..."
curl -s "$BASE_URL/api/lead-stages" \
  -H "Authorization: Bearer $TOKEN" | jq '. | length'

# Test 3: List leads
echo "3. List leads..."
curl -s "$BASE_URL/api/leads?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq '.total'

# Test 4: Create lead via webhook
echo "4. Create lead via webhook..."
curl -s -X POST "$BASE_URL/api/leads/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: test-webhook-secret-123" \
  -d '{
    "company_name": "Auto Test Lead",
    "email": "auto-test@example.com",
    "segment": "Auto Testing"
  }' | jq '.success'

echo "✅ All tests completed!"
```

---

## Troubleshooting

### Servers Won't Start

**Problem:** uvicorn/next not found

**Solution:**
```bash
# Use main dev worktree (has dependencies installed)
cd /home/novi/workspace/tech/projects/kvota/dev

# Backend
cd backend && source venv/bin/activate
uvicorn main:app --reload --port 8001

# Frontend (new terminal)
cd frontend
npm run dev -- --port 3001
```

---

### Page Shows 404

**Problem:** Route not found

**Solutions:**
1. Clear Next.js cache: `rm -rf frontend/.next`
2. Restart frontend server
3. Hard refresh browser (Ctrl+Shift+R)

---

### API Calls Fail

**Problem:** 404 or 500 errors

**Check:**
1. Backend running? `curl http://localhost:8001/api/leads/webhook/health`
2. Logged in? Check auth token in browser DevTools → Application → Cookies
3. Ports correct? Frontend 3001, Backend 8001

---

### No CRM Menu

**Problem:** Navigation doesn't show CRM

**Solutions:**
1. Hard refresh (Ctrl+Shift+R)
2. Clear browser cache
3. Check MainLayout.tsx has CRM menu (line 88-102)
4. Restart frontend

---

## Success Criteria

**All tests pass if:**
- ✅ Can create lead manually
- ✅ Lead appears in list with correct data
- ✅ Can see lead in pipeline
- ✅ Can move lead between stages
- ✅ Can qualify lead → customer created
- ✅ Customer has same data + contacts
- ✅ Can create quote from customer
- ✅ Zero console errors

---

## Time Estimates

**Quick test (essentials only):**
- Steps 1-20: 10 minutes
- Result: Verify core flow works

**Full test (with webhook):**
- Steps 1-24: 15 minutes
- Result: Complete validation

**Comprehensive (with activities):**
- Steps 1-26: 20 minutes
- Result: All features tested

---

**Ready to test? Follow steps 1-20 for core functionality validation! 🧪**

---

**Last Updated:** 2025-11-13
**Version:** 1.0
