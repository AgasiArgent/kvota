# Manual Testing Guide: Quote Workflow System

**Feature:** Multi-role collaborative quote creation workflow
**Created:** 2025-11-08
**Status:** Ready for testing
**Related:** docs/plans/2025-11-08-quote-workflow-system-design.md

---

## Prerequisites

**Migration Applied:**
- ✅ Migration 023 executed in Supabase
- ✅ Tables: `quote_workflow_transitions`, `organization_workflow_settings`
- ✅ Columns added to `quotes` table
- ✅ 8 new roles created for each organization

**Code Deployed:**
- ✅ Backend API endpoints running on :8000
- ✅ Frontend components compiled and running on :3000

**Test Users Required:**
You'll need users assigned to different roles:
- Sales Manager (role_id for 'sales_manager')
- Procurement Manager (role_id for 'procurement_manager')
- Logistics Manager (role_id for 'logistics_manager')
- Customs Manager (role_id for 'customs_manager')
- Financial Manager (role_id for 'financial_manager')
- CEO or CFO (role_id for 'ceo' or 'cfo')

---

## Test Suite 1: Simple Mode (Default)

### Test 1.1: Verify Default Settings

**Steps:**
1. Query organization_workflow_settings via Supabase SQL editor:
   ```sql
   SELECT * FROM organization_workflow_settings
   WHERE organization_id = '[your-org-id]';
   ```

**Expected:**
- Row exists for your organization
- `workflow_mode` = 'simple'
- `senior_approval_threshold_usd` = 100000.00
- All other defaults set

**Pass/Fail:** _________

---

### Test 1.2: Create Quote in Simple Mode

**Steps:**
1. Go to `/quotes/create`
2. Upload products file
3. Fill in all quote variables (as current user can do everything)
4. Click "Рассчитать" (Calculate)
5. Navigate to quote detail page `/quotes/[id]`

**Expected:**
- Quote created successfully
- Workflow status card shows at top of page
- Current state badge shows "Черновик" (draft)
- Progress bar shows step 1 of 4

**Pass/Fail:** _________

---

### Test 1.3: Submit for Approval (Simple Mode)

**Steps:**
1. On quote detail page, look for action button
2. Should see "Отправить на утверждение" (Submit for Approval)
3. Click button
4. Add comment (optional)
5. Confirm

**Expected:**
- Quote transitions to `awaiting_financial_approval`
- Status badge changes to orange "Финансовое утверждение"
- Progress bar advances to step 2

**Pass/Fail:** _________

---

### Test 1.4: Approve as Financial Manager (Under $100k)

**Scenario:** Quote total < $100,000 USD

**Steps:**
1. Switch to user with `financial_manager` role
2. Go to quote detail `/quotes/[id]`
3. Should see "Утвердить" and "Отклонить" buttons
4. Click "Утвердить"
5. Add comment (optional)
6. Confirm

**Expected:**
- Quote transitions to `approved` (skips senior approval)
- Status badge changes to green "Утверждено"
- Progress bar shows complete (step 4 of 4)
- No action buttons visible

**Pass/Fail:** _________

---

### Test 1.5: Approve with Senior Threshold (Over $100k)

**Scenario:** Quote total ≥ $100,000 USD

**Steps:**
1. Create quote with total_amount ≥ $100,000
2. Submit for approval (as sales manager)
3. Approve as financial manager
4. Check new state

**Expected:**
- After financial approval: state = `awaiting_senior_approval`
- Status badge shows "Подпись руководства"
- Alert shows "Требуется 1 утверждений" with progress 0/1

**Pass/Fail:** _________

---

### Test 1.6: Senior Approval (Complete Workflow)

**Steps:**
1. Continue from Test 1.5 (quote in awaiting_senior_approval)
2. Switch to user with `ceo` or `cfo` role
3. Go to quote detail
4. Should see "Утвердить" and "Отклонить" buttons
5. Click "Утвердить"
6. Confirm

**Expected:**
- Quote transitions to `approved`
- Status badge shows green "Утверждено"
- Progress complete
- Workflow history shows 3 transitions: submit → financial approve → senior approve

**Pass/Fail:** _________

---

## Test Suite 2: Multi-Role Mode

### Test 2.1: Switch to Multi-Role Mode

**Steps:**
1. Update organization settings via SQL:
   ```sql
   UPDATE organization_workflow_settings
   SET workflow_mode = 'multi_role'
   WHERE organization_id = '[your-org-id]';
   ```
2. Verify update:
   ```sql
   SELECT workflow_mode FROM organization_workflow_settings
   WHERE organization_id = '[your-org-id]';
   ```

**Expected:**
- `workflow_mode` = 'multi_role'

**Pass/Fail:** _________

---

### Test 2.2: Create Quote - Sales Manager (Step 1)

**Role:** Sales Manager

**Steps:**
1. Login as user with `sales_manager` role
2. Go to `/quotes/create`
3. Upload products file (just products, SKU, quantities)
4. Leave prices/weights EMPTY (procurement will add)
5. Click "Создать КП" (Create Quote)

**Expected:**
- Quote created in `draft` state
- Workflow card shows 7 steps (multi-role mode)
- Current step: 1 (Черновик)
- Action button: "Отправить в закупки"

**Pass/Fail:** _________

---

### Test 2.3: Submit to Procurement (Step 1 → 2)

**Role:** Sales Manager

**Steps:**
1. On quote detail page (state = draft)
2. Click "Отправить в закупки"
3. Add comment: "Клиент просит срочно"
4. Confirm

**Expected:**
- Quote transitions to `awaiting_procurement`
- Status badge: "Ожидает закупки"
- Progress bar: Step 2 of 7
- Assigned to: Procurement Manager
- Workflow history shows 1 transition with your comment

**Pass/Fail:** _________

---

### Test 2.4: Add Procurement Data (Step 2 → 3)

**Role:** Procurement Manager

**Steps:**
1. Login as user with `procurement_manager` role
2. Go to `/quotes/my-tasks` endpoint (or query directly)
3. Navigate to quote from Test 2.3
4. Edit quote: Add base_price_vat, weight_in_kg for all products
5. Fill in supplier_country, advance_to_supplier, delivery_time
6. Click "Подтвердить закупки" (Confirm Procurement)
7. Confirm

**Expected:**
- Quote transitions to `awaiting_logistics_customs`
- Status badge: "Логистика и таможня"
- Progress bar: Step 3 of 7
- Shows 2 parallel task cards: Логистика (pending), Таможня (pending)

**Pass/Fail:** _________

---

### Test 2.5: Complete Logistics (Step 3a - Parallel)

**Role:** Logistics Manager

**Steps:**
1. Login as user with `logistics_manager` role
2. Navigate to quote (state = awaiting_logistics_customs)
3. Fill in logistics costs: logistics_supplier_hub, logistics_hub_customs, logistics_customs_client
4. Click "Завершить логистику" (Complete Logistics)
5. Confirm

**Expected:**
- Quote STAYS in `awaiting_logistics_customs` (waiting for customs)
- Logistics card shows green checkmark (complete)
- Customs card still shows clock icon (pending)
- Workflow history shows logistics completion

**Pass/Fail:** _________

---

### Test 2.6: Complete Customs (Step 3b - Auto-Transition)

**Role:** Customs Manager

**Steps:**
1. Login as user with `customs_manager` role
2. Navigate to same quote (state = awaiting_logistics_customs)
3. Fill in customs data: customs_code, import_tariff for all products, brokerage_customs
4. Click "Завершить таможню" (Complete Customs)
5. Confirm

**Expected:**
- **Auto-transition** to `awaiting_sales_review`
- Status badge: "Проверка продаж"
- Progress bar: Step 4 of 7
- Both logistics and customs cards show green checkmarks
- Assigned back to Sales Manager
- Workflow history shows: customs completion + auto-transition (2 entries)

**Pass/Fail:** _________

---

### Test 2.7: Sales Review and Submit for Approval (Step 4 → 5)

**Role:** Sales Manager (returns)

**Steps:**
1. Login as sales manager
2. Navigate to quote (state = awaiting_sales_review)
3. Review calculated COGS
4. Add markup, dm_fee_type, dm_fee_value, advance_from_client
5. Click "Рассчитать" to recalculate with markup
6. Click "Отправить на утверждение"
7. Confirm

**Expected:**
- Quote transitions to `awaiting_financial_approval`
- Status badge: "Финансовое утверждение"
- Progress bar: Step 5 of 7
- Assigned to Financial Manager

**Pass/Fail:** _________

---

### Test 2.8: Financial Approval (Step 5 → 6 or Done)

**Role:** Financial Manager

**Scenario A: Quote < $100k**

**Steps:**
1. Login as financial manager
2. Navigate to quote with total < $100k
3. Click "Утвердить"
4. Confirm

**Expected:**
- Quote transitions to `approved` (skips senior)
- Status badge: green "Утверждено"
- Progress bar: Step 7 of 7 (complete)

**Pass/Fail:** _________

**Scenario B: Quote ≥ $100k**

**Steps:**
1. Login as financial manager
2. Navigate to quote with total ≥ $100k
3. Click "Утвердить"
4. Confirm

**Expected:**
- Quote transitions to `awaiting_senior_approval`
- Status badge: "Подпись руководства"
- Progress bar: Step 6 of 7
- Alert shows "Требуется 1 утверждений" with progress 0/1

**Pass/Fail:** _________

---

### Test 2.9: Senior Approval (Step 6 → Done)

**Role:** CEO or CFO

**Steps:**
1. Login as CEO/CFO
2. Navigate to quote in `awaiting_senior_approval`
3. Click "Утвердить"
4. Add comment: "Approved by CEO"
5. Confirm

**Expected:**
- Quote transitions to `approved`
- Status badge: green "Утверждено"
- Progress bar: Complete (7/7)
- Workflow history shows full chain: 7+ transitions

**Pass/Fail:** _________

---

## Test Suite 3: Multi-Senior Approval

### Test 3.1: Configure Multi-Senior Threshold

**Steps:**
1. Update settings for $500k threshold:
   ```sql
   UPDATE organization_workflow_settings
   SET multi_senior_threshold_usd = 500000.00,
       multi_senior_approvals_required = 2
   WHERE organization_id = '[your-org-id]';
   ```

**Expected:**
- Settings updated successfully

**Pass/Fail:** _________

---

### Test 3.2: High-Value Quote Requires 2 Approvals

**Scenario:** Quote ≥ $500,000 USD

**Steps:**
1. Create quote with total ≥ $500k
2. Submit through workflow to financial approval
3. Financial manager approves
4. Check state

**Expected:**
- State = `awaiting_senior_approval`
- Alert shows "Требуется 2 утверждений"
- Progress: 0/2

**Pass/Fail:** _________

---

### Test 3.3: First Senior Approval

**Role:** CEO

**Steps:**
1. Login as CEO
2. Navigate to quote from Test 3.2
3. Click "Утвердить"
4. Confirm

**Expected:**
- State STAYS in `awaiting_senior_approval` (need 1 more)
- Progress updates: 1/2
- Workflow history shows CEO approval
- Other senior managers can still approve

**Pass/Fail:** _________

---

### Test 3.4: Second Senior Approval (Complete)

**Role:** CFO (different from first approver)

**Steps:**
1. Login as CFO
2. Navigate to same quote
3. Click "Утвердить"
4. Confirm

**Expected:**
- Quote transitions to `approved`
- Progress shows 2/2
- Status badge: green "Утверждено"
- Workflow history shows both CEO and CFO approvals

**Pass/Fail:** _________

---

## Test Suite 4: Send Back Functionality

### Test 4.1: Send Back from Procurement

**Role:** Procurement Manager

**Steps:**
1. Quote in `awaiting_procurement` state
2. Procurement manager views quote
3. Notices missing product information
4. Clicks "Вернуть на доработку" (Send Back)
5. Enter reason: "Не хватает данных о весе"
6. Confirm

**Expected:**
- Quote transitions back to `draft`
- Status badge: "Черновик"
- Progress bar: Step 1
- Assigned back to Sales Manager
- Workflow history shows send_back with reason

**Pass/Fail:** _________

---

### Test 4.2: Send Back from Financial

**Role:** Financial Manager

**Steps:**
1. Quote in `awaiting_financial_approval`
2. Financial manager finds pricing error
3. Clicks "Вернуть на доработку"
4. Reason: "Наценка слишком низкая"
5. Confirm

**Expected:**
- Quote transitions to `awaiting_sales_review`
- Assigned to Sales Manager
- History shows send_back with reason

**Pass/Fail:** _________

---

## Test Suite 5: Role-Based Task Lists

### Test 5.1: My Tasks - Sales Manager

**Role:** Sales Manager

**Steps:**
1. Login as sales manager
2. Call endpoint: `GET /api/quotes/my-tasks`
3. Or create UI page at `/quotes/my-tasks` to display results

**Expected:**
- Returns quotes where:
  - `current_assignee_role` = 'sales_manager'
  - `workflow_state` IN ('awaiting_sales_review') OR quotes created by this user in 'draft'
- Shows quote_number, customer_name, total_amount, age_hours

**Pass/Fail:** _________

---

### Test 5.2: My Tasks - Parallel Roles

**Roles:** Logistics Manager AND Customs Manager

**Setup:**
- Create quote in `awaiting_logistics_customs` state

**Steps:**
1. Login as logistics manager → Call /my-tasks
2. Login as customs manager → Call /my-tasks

**Expected:**
- **Both** managers see the same quote in their task list
- Shows parallel assignment (both can work simultaneously)

**Pass/Fail:** _________

---

## Test Suite 6: Workflow History & Audit Trail

### Test 6.1: View Full Transition History

**Steps:**
1. Complete a quote through full multi-role workflow (all 6 steps)
2. Navigate to quote detail page
3. Scroll to workflow history section

**Expected:**
- Timeline shows 7+ transitions:
  1. submit_procurement (sales → procurement)
  2. submit_procurement (procurement → logistics/customs)
  3. complete_logistics
  4. complete_customs
  5. auto_transition (system)
  6. submit_approval (sales review → financial)
  7. approve (financial → approved OR senior)
  8. approve (senior → approved, if applicable)
- Each shows: user name, role, timestamp, comments
- Timestamps in chronological order

**Pass/Fail:** _________

---

### Test 6.2: Verify Audit Trail Data

**Steps:**
1. Query transitions directly:
   ```sql
   SELECT from_state, to_state, action, role_at_transition, comments, performed_at
   FROM quote_workflow_transitions
   WHERE quote_id = '[quote-id]'
   ORDER BY performed_at ASC;
   ```

**Expected:**
- All transitions logged
- `role_at_transition` captured correctly
- Comments and reasons preserved
- Organization_id matches quote's org

**Pass/Fail:** _________

---

## Test Suite 7: Rejection Flow

### Test 7.1: Reject at Financial Approval

**Role:** Financial Manager

**Steps:**
1. Quote in `awaiting_financial_approval`
2. Click "Отклонить" (Reject)
3. Enter reason: "Цена не согласована с клиентом"
4. Confirm

**Expected:**
- Quote transitions to `rejected`
- Status badge: red "Отклонено"
- Progress bar shows error state
- Reason captured in workflow history
- No further actions available

**Pass/Fail:** _________

---

### Test 7.2: Rejected Quote Cannot Be Modified

**Steps:**
1. Try to edit rejected quote
2. Try to transition state

**Expected:**
- Quote is read-only or shows warning
- No action buttons visible
- Workflow is terminal (no exit from rejected state)

**Pass/Fail:** _________

---

## Test Suite 8: Permission Validation

### Test 8.1: Wrong Role Cannot Transition

**Scenario:** Procurement Manager tries to approve quote

**Steps:**
1. Login as procurement manager
2. Navigate to quote in `awaiting_financial_approval`
3. Check if approve button is visible

**Expected:**
- No approve/reject buttons visible
- Status card shows assigned to "Financial Manager" (not you)
- `can_user_act` = false in API response

**Pass/Fail:** _________

---

### Test 8.2: Cross-Organization Isolation

**Scenario:** RLS prevents accessing other org's workflows

**Steps:**
1. Login as user in Organization A
2. Get quote ID from Organization B (via SQL)
3. Try to access: `GET /api/quotes/[org-b-quote-id]/workflow`

**Expected:**
- 404 Not Found (RLS blocks access)
- Cannot see other organization's workflow data

**Pass/Fail:** _________

---

## Test Suite 9: Edge Cases

### Test 9.1: Auto-Transition with Only Logistics Complete

**Steps:**
1. Quote in `awaiting_logistics_customs`
2. Logistics manager completes (customs NOT complete)
3. Check state

**Expected:**
- State STAYS in `awaiting_logistics_customs`
- Logistics card: green checkmark
- Customs card: clock icon (still pending)
- No auto-transition yet

**Pass/Fail:** _________

---

### Test 9.2: Auto-Transition When Both Complete

**Steps:**
1. Continue from Test 9.1
2. Customs manager completes customs
3. Check state

**Expected:**
- **Auto-transition** to `awaiting_sales_review`
- Both cards show green checkmarks
- Workflow history shows 2 entries: complete_customs + auto_transition

**Pass/Fail:** _________

---

### Test 9.3: Board Approval (3 Signatures for $1M+)

**Setup:**
```sql
UPDATE organization_workflow_settings
SET board_approval_threshold_usd = 1000000.00,
    board_approvals_required = 3
WHERE organization_id = '[your-org-id]';
```

**Steps:**
1. Create quote with total ≥ $1,000,000
2. Get to `awaiting_senior_approval` state
3. First senior approves (CEO)
4. Second senior approves (CFO)
5. Third senior approves (Top Sales Manager)

**Expected:**
- After 1st approval: Progress 1/3, state stays
- After 2nd approval: Progress 2/3, state stays
- After 3rd approval: Progress 3/3, state → `approved`

**Pass/Fail:** _________

---

## Performance Testing

### Test P.1: Transition Response Time

**Steps:**
1. Use browser DevTools Network tab
2. Click any workflow action button
3. Measure POST /transition response time

**Expected:**
- Response time < 100ms
- No database timeout errors

**Pass/Fail:** _________ (Time: _____ ms)

---

### Test P.2: Workflow Status Query

**Steps:**
1. Measure GET /workflow response time
2. For quote with 10+ transitions

**Expected:**
- Response time < 200ms
- All transitions returned

**Pass/Fail:** _________ (Time: _____ ms)

---

### Test P.3: My Tasks Query

**Steps:**
1. User with 20+ assigned tasks
2. Call GET /my-tasks
3. Measure response time

**Expected:**
- Response time < 300ms
- Correct count returned

**Pass/Fail:** _________ (Time: _____ ms)

---

## Integration Testing

### Test I.1: Workflow + Calculation Engine

**Steps:**
1. Create quote in multi-role mode
2. Procurement fills prices
3. Logistics/customs fill costs
4. Sales adds markup and clicks "Рассчитать"
5. Check if calculation runs
6. Check if quote_calculation_summaries populated

**Expected:**
- Calculation succeeds
- Summaries table has row for quote
- Can proceed to approval with calculated totals

**Pass/Fail:** _________

---

### Test I.2: Workflow + Analytics

**Steps:**
1. Create and approve multiple quotes via workflow
2. Go to `/analytics`
3. Filter by workflow_state
4. Aggregate by workflow_state

**Expected:**
- Can filter quotes by workflow_state
- Counts match (e.g., 5 in awaiting_procurement, 10 approved)
- Analytics respects workflow states

**Pass/Fail:** _________

---

## Known Issues / Technical Debt

**From Implementation:**
1. Workflow settings UI not created (admin must use SQL to configure)
2. `/quotes/my-tasks` page not created (endpoint exists, UI pending)
3. Email notifications not implemented (marked as Phase 5 future work)
4. No "force transition" admin override for stuck quotes
5. Workflow mode toggle in UI not created (must use SQL)

**To Add Later:**
- Workflow settings admin panel
- My Tasks page with filters
- Email notifications on state changes
- Workflow analytics dashboard
- Mobile-responsive workflow cards

---

## Rollback Procedure

If workflow causes issues:

1. **Disable multi-role mode:**
   ```sql
   UPDATE organization_workflow_settings
   SET workflow_mode = 'simple'
   WHERE organization_id = '[your-org-id]';
   ```

2. **Reset quotes to draft or approved:**
   ```sql
   UPDATE quotes
   SET workflow_state = 'draft'
   WHERE workflow_state NOT IN ('approved', 'rejected');
   ```

3. **Clear workflow history (if needed):**
   ```sql
   DELETE FROM quote_workflow_transitions
   WHERE organization_id = '[your-org-id]';
   ```

---

**Testing Started:** 2025-11-08
**Tester:** ___________
**Total Test Cases:** 27
**Passed:** ___ / 27
**Failed:** ___ / 27
**Blocked:** ___ / 27
