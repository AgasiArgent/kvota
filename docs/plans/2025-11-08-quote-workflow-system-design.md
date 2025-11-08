# Quote Workflow System - Design Document

**Date:** 2025-11-08
**Status:** Approved
**Effort:** 12-15 hours
**Priority:** HIGH

---

## Problem Statement

Quotes currently lack collaborative creation workflow. All quote variables must be filled by a single person, but in practice:
- Sales team initiates quotes (products, quantities)
- Procurement team negotiates supplier prices and terms
- Logistics team calculates shipping costs
- Customs team determines tariffs and clearance fees
- Sales team finalizes markup and client terms
- Financial management approves before sending

This creates bottlenecks and requires one person to gather data from multiple departments.

**User impact:** Inefficient quote creation, delayed responses to customers, no audit trail for who contributed what.

---

## Solution Overview

Implement role-based workflow state machine with:
- 7 workflow states
- 5 specialized roles (sales, procurement, logistics, customs, financial)
- Parallel processing (logistics + customs work simultaneously)
- Configurable approval thresholds per organization
- Multi-senior approval for high-value quotes
- Full audit trail of all transitions

**Two modes:**
1. **Simple mode:** Single person creates entire quote (current behavior)
2. **Multi-role mode:** Collaborative workflow with role handoffs

---

## Workflow States

### State Machine Diagram

```
SIMPLE MODE:
draft → awaiting_financial_approval → awaiting_senior_approval → approved/rejected

MULTI-ROLE MODE:
draft → awaiting_procurement → awaiting_logistics_customs → awaiting_sales_review →
awaiting_financial_approval → awaiting_senior_approval → approved/rejected
```

### State Definitions

| State | Assignee Role | Required Actions | Can Send Back To |
|-------|---------------|------------------|------------------|
| draft | sales_manager | Upload products, submit to procurement | - |
| awaiting_procurement | procurement_manager | Fill prices, weights, supplier terms | draft |
| awaiting_logistics_customs | logistics_manager + customs_manager | Both complete their sections | awaiting_procurement |
| awaiting_sales_review | sales_manager | Add markup, client payment terms | awaiting_logistics_customs |
| awaiting_financial_approval | financial_manager | Approve or reject | awaiting_sales_review |
| awaiting_senior_approval | ceo/cfo/top_sales_manager | Approve or reject (multiple if >threshold) | awaiting_financial_approval |
| approved | - | Quote ready to send | - |
| rejected | - | Workflow terminated | - |

### Parallel Processing

**State:** `awaiting_logistics_customs`

Two flags track completion:
- `logistics_complete` - Logistics manager filled costs
- `customs_complete` - Customs manager filled tariffs/codes

**Auto-transition:** When BOTH flags become true, system automatically transitions to `awaiting_sales_review`.

---

## Database Schema

### Table: quote_workflow_transitions

Audit log of all workflow actions.

```sql
CREATE TABLE quote_workflow_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Transition details
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  action TEXT NOT NULL,

  -- Who and when
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  role_at_transition TEXT NOT NULL,

  -- Optional context
  comments TEXT,
  reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_transitions_quote ON quote_workflow_transitions(quote_id);
CREATE INDEX idx_workflow_transitions_org ON quote_workflow_transitions(organization_id);
CREATE INDEX idx_workflow_transitions_state ON quote_workflow_transitions(to_state, organization_id);
```

### Table: organization_workflow_settings

Per-organization configuration.

```sql
CREATE TABLE organization_workflow_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id),

  -- Mode
  workflow_mode TEXT NOT NULL DEFAULT 'simple',

  -- Approval thresholds (USD)
  financial_approval_threshold_usd DECIMAL(15,2) DEFAULT 0.00,
  senior_approval_threshold_usd DECIMAL(15,2) DEFAULT 100000.00,
  multi_senior_threshold_usd DECIMAL(15,2) DEFAULT 500000.00,
  board_approval_threshold_usd DECIMAL(15,2) DEFAULT 1000000.00,

  -- Required approval counts
  senior_approvals_required INT DEFAULT 1,
  multi_senior_approvals_required INT DEFAULT 2,
  board_approvals_required INT DEFAULT 3,

  -- Feature toggles
  enable_parallel_logistics_customs BOOLEAN DEFAULT true,
  allow_send_back BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Update: quotes table

```sql
ALTER TABLE quotes
  ADD COLUMN workflow_state TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN logistics_complete BOOLEAN DEFAULT false,
  ADD COLUMN customs_complete BOOLEAN DEFAULT false,
  ADD COLUMN current_assignee_role TEXT,
  ADD COLUMN assigned_at TIMESTAMPTZ;

CREATE INDEX idx_quotes_workflow_state ON quotes(workflow_state, organization_id);
CREATE INDEX idx_quotes_assignee ON quotes(current_assignee_role, organization_id);
```

### Update: roles table

Add new roles:

```sql
INSERT INTO roles (name, slug, permissions) VALUES
('Sales Manager', 'sales_manager', '["quotes:create", "quotes:read", "quotes:update"]'),
('Procurement Manager', 'procurement_manager', '["quotes:read", "quotes:update_procurement"]'),
('Logistics Manager', 'logistics_manager', '["quotes:read", "quotes:update_logistics"]'),
('Customs Manager', 'customs_manager', '["quotes:read", "quotes:update_customs"]'),
('Financial Manager', 'financial_manager', '["quotes:read", "quotes:approve_financial"]'),
('Top Sales Manager', 'top_sales_manager', '["quotes:read", "quotes:approve_senior"]'),
('CFO', 'cfo', '["quotes:read", "quotes:approve_senior", "quotes:approve_all"]'),
('CEO', 'ceo', '["quotes:read", "quotes:approve_senior", "quotes:approve_all"]');
```

---

## API Endpoints

### 1. Transition Workflow State

**POST `/api/quotes/{quote_id}/transition`**

Moves quote to next state.

**Request:**
```json
{
  "action": "submit_procurement",
  "comments": "Все цены согласованы с поставщиками",
  "reason": "Optional: для send_back или reject"
}
```

**Response:**
```json
{
  "quote_id": "uuid",
  "old_state": "awaiting_procurement",
  "new_state": "awaiting_logistics_customs",
  "transition_id": "uuid",
  "next_assignee_role": "logistics_manager",
  "message": "Quote forwarded to Logistics & Customs"
}
```

**Actions:**
- `submit_procurement` - Forward from sales to procurement
- `submit_procurement` (step 2) - Forward from procurement to logistics/customs
- `complete_logistics` - Mark logistics section done
- `complete_customs` - Mark customs section done
- `submit_approval` - Forward from sales review to financial
- `approve` - Approve (financial or senior)
- `reject` - Reject with reason
- `send_back` - Return to previous step

### 2. Get Workflow Status

**GET `/api/quotes/{quote_id}/workflow`**

**Response:**
```json
{
  "current_state": "awaiting_logistics_customs",
  "current_assignee_role": "logistics_manager",
  "can_user_act": true,
  "available_actions": ["complete_logistics", "send_back"],
  "logistics_complete": false,
  "customs_complete": false,
  "transitions": [/* history */],
  "senior_approvals_received": 0,
  "senior_approvals_required": 2
}
```

### 3. Get My Tasks

**GET `/api/quotes/my-tasks`**

Returns quotes assigned to user's role.

**Response:**
```json
{
  "tasks": [
    {
      "quote_id": "uuid",
      "quote_number": "КП25-0034",
      "customer_name": "ООО Рога и Копыта",
      "total_amount": 150000.00,
      "workflow_state": "awaiting_procurement",
      "assigned_at": "2025-11-08T10:00:00Z",
      "age_hours": 2
    }
  ],
  "count": 5
}
```

### 4. Get/Update Workflow Settings

**GET `/api/organizations/{org_id}/workflow-settings`**

**PUT `/api/organizations/{org_id}/workflow-settings`** (admin only)

---

## Role Permission Matrix

| Action | Allowed Roles | State Requirement | Field Validation |
|--------|---------------|-------------------|------------------|
| submit_procurement (step 1) | sales_manager | draft | Products uploaded |
| submit_procurement (step 2) | procurement_manager | awaiting_procurement | Prices, weights, supplier terms filled |
| complete_logistics | logistics_manager | awaiting_logistics_customs | Logistics costs filled |
| complete_customs | customs_manager | awaiting_logistics_customs | Tariffs, codes filled |
| submit_approval | sales_manager | awaiting_sales_review | Markup, client terms filled, BOTH logistics+customs complete |
| approve (financial) | financial_manager | awaiting_financial_approval | Calculations complete |
| approve (senior) | ceo, cfo, top_sales_manager | awaiting_senior_approval | - |
| reject | financial_manager, ceo, cfo | awaiting_financial_approval OR awaiting_senior_approval | Reason required |
| send_back | Any workflow role | Any non-terminal state | Reason required |

---

## Approval Threshold Logic

**Get required senior approvals:**

```python
def get_required_senior_approvals(total_usd: Decimal, settings) -> int:
    """
    Return number of senior approvals required based on amount.

    Thresholds cascade:
    - < $100k: 0 approvals (skip senior step)
    - $100k - $500k: 1 approval
    - $500k - $1M: 2 approvals
    - >= $1M: 3 approvals (board)
    """
    if total_usd >= settings.board_approval_threshold_usd:
        return settings.board_approvals_required  # Default: 3
    elif total_usd >= settings.multi_senior_threshold_usd:
        return settings.multi_senior_approvals_required  # Default: 2
    elif total_usd >= settings.senior_approval_threshold_usd:
        return settings.senior_approvals_required  # Default: 1
    else:
        return 0  # No senior approval needed
```

**Transition logic after financial approval:**

```python
if action == 'approve' and current_state == 'awaiting_financial_approval':
    required_approvals = get_required_senior_approvals(quote.total_amount_usd, settings)

    if required_approvals > 0:
        next_state = 'awaiting_senior_approval'
        quote.senior_approvals_required = required_approvals
        quote.senior_approvals_received = 0
    else:
        next_state = 'approved'  # Skip senior step
```

**During senior approval:**

```python
if action == 'approve' and current_state == 'awaiting_senior_approval':
    current_count = count_senior_approvals(quote_id)
    new_count = current_count + 1

    if new_count >= quote.senior_approvals_required:
        next_state = 'approved'  # Done!
    else:
        next_state = 'awaiting_senior_approval'  # Stay, need more
        quote.senior_approvals_received = new_count
```

---

## Required Fields by State

### awaiting_procurement → awaiting_logistics_customs

**Products must have:**
- base_price_vat
- weight_in_kg
- supplier_country (per product or quote default)

**Quote variables must have:**
- advance_to_supplier
- delivery_time

### awaiting_logistics_customs → awaiting_sales_review

**Logistics section (logistics_complete = true):**
- logistics_supplier_hub
- logistics_hub_customs
- logistics_customs_client

**Customs section (customs_complete = true):**
- customs_code (all products)
- import_tariff (all products)
- brokerage_customs

**Both** must be complete for auto-transition.

### awaiting_sales_review → awaiting_financial_approval

**Quote variables must have:**
- markup
- dm_fee_type
- dm_fee_value
- advance_from_client

**Quote must have:**
- Calculation results (quote calculated)

### awaiting_financial_approval → approved/awaiting_senior

**No additional fields required** - decision only.

---

## Frontend UI Flow

### Page 1: My Tasks (`/quotes/my-tasks`)

**By role:**

**Sales Manager:**
- Tab 1: "Новые КП" - Quotes in `draft` (need to submit)
- Tab 2: "На проверке" - Quotes in `awaiting_sales_review` (need markup)

**Procurement Manager:**
- "Ожидают закупки" - Quotes in `awaiting_procurement`

**Logistics Manager:**
- "Ожидают логистику" - Quotes in `awaiting_logistics_customs` WHERE logistics_complete = false

**Customs Manager:**
- "Ожидают таможню" - Quotes in `awaiting_logistics_customs` WHERE customs_complete = false

**Financial Manager:**
- "На утверждении" - Quotes in `awaiting_financial_approval`

**CEO/CFO:**
- "Требуют подписи" - Quotes in `awaiting_senior_approval`

### Page 2: Quote Detail with Workflow (`/quotes/[id]`)

**Top section: Workflow Status Card**

Shows:
- Current state badge
- Progress steps (visual timeline)
- Assigned role
- Parallel task indicators (if in logistics/customs state)
- Multi-approval progress (if in senior approval)
- Action buttons (if user can act)

**Middle section: Quote Form (role-specific fields)**

Form sections enabled/disabled based on workflow state:
- Products table: Always editable in multi-role mode
- Procurement fields: Only when state = awaiting_procurement
- Logistics fields: Only when state = awaiting_logistics_customs
- Customs fields: Only when state = awaiting_logistics_customs
- Sales markup: Only when state = awaiting_sales_review

**Bottom section: Workflow History**

Timeline showing all transitions with user, role, timestamp, comments.

### Page 3: Workflow Settings (`/settings/workflow`)

**Admin only.**

Configure:
- Workflow mode (simple vs multi-role)
- Approval thresholds ($100k, $500k, $1M)
- Required approval counts (1, 2, 3)
- Feature toggles (parallel tasks, send back)

---

## Implementation Phases

### Phase 1: Database (2 hours)

- [ ] Create migration `023_quote_workflow_system.sql`
- [ ] Create `quote_workflow_transitions` table
- [ ] Create `organization_workflow_settings` table
- [ ] Add workflow columns to `quotes` table
- [ ] Add new roles to `roles` table
- [ ] Create RLS policies
- [ ] Test RLS with multiple organizations

### Phase 2: Backend API (3-4 hours)

- [ ] Create `routes/workflow.py` with 5 endpoints
- [ ] Implement state machine validation logic
- [ ] Implement threshold calculation logic
- [ ] Implement field validation per state
- [ ] Add permission checks per action
- [ ] Handle parallel task auto-transition
- [ ] Write 20+ unit tests
- [ ] Write 10 integration tests

### Phase 3: Frontend Components (3-4 hours)

- [ ] Create `WorkflowStatusCard` component
- [ ] Create `WorkflowActionButton` component
- [ ] Create `WorkflowHistory` component (timeline)
- [ ] Create `WorkflowStateBadge` component
- [ ] Create `ParallelTasksIndicator` component
- [ ] Create `MultiApprovalProgress` component
- [ ] Create `WorkflowSettingsPanel` component (admin)
- [ ] Add Russian localization for all states/actions

### Phase 4: Integration (2 hours)

- [ ] Add workflow section to quote detail page
- [ ] Create `/quotes/my-tasks` page with role-based tabs
- [ ] Add workflow settings to admin panel
- [ ] Update quote creation flow (initialize workflow_state)
- [ ] Add React Query for workflow status caching
- [ ] Handle optimistic updates

### Phase 5: Email Notifications (1-2 hours)

- [ ] Email template: "Quote assigned to you"
- [ ] Email template: "Quote approved"
- [ ] Email template: "Quote rejected"
- [ ] Email template: "Quote sent back for revision"
- [ ] Trigger emails on state transitions
- [ ] Add email logging

### Phase 6: Testing (1-2 hours)

- [ ] E2E test: Simple mode workflow
- [ ] E2E test: Multi-role mode (all 6 steps)
- [ ] E2E test: Parallel logistics + customs
- [ ] E2E test: Multi-senior approval (2 approvals)
- [ ] E2E test: Send back flow
- [ ] Security test: RLS isolation
- [ ] Performance test: Transition <100ms

---

## State Transition Rules

### Allowed Transitions (Multi-Role Mode)

```python
ALLOWED_TRANSITIONS = {
    'draft': {
        'submit_procurement': {
            'next_state': 'awaiting_procurement',
            'required_role': ['sales_manager'],
            'validation': 'products_uploaded'
        }
    },
    'awaiting_procurement': {
        'submit_procurement': {
            'next_state': 'awaiting_logistics_customs',
            'required_role': ['procurement_manager'],
            'validation': 'procurement_fields_filled'
        },
        'send_back': {
            'next_state': 'draft',
            'required_role': ['procurement_manager'],
            'validation': 'reason_required'
        }
    },
    'awaiting_logistics_customs': {
        'complete_logistics': {
            'next_state': 'awaiting_logistics_customs',  # Stay in state
            'required_role': ['logistics_manager'],
            'validation': 'logistics_fields_filled',
            'side_effect': 'set_logistics_complete_flag'
        },
        'complete_customs': {
            'next_state': 'awaiting_logistics_customs',  # Stay in state
            'required_role': ['customs_manager'],
            'validation': 'customs_fields_filled',
            'side_effect': 'set_customs_complete_flag'
        },
        'send_back': {
            'next_state': 'awaiting_procurement',
            'required_role': ['logistics_manager', 'customs_manager'],
            'validation': 'reason_required'
        }
    },
    'awaiting_sales_review': {
        'submit_approval': {
            'next_state': 'awaiting_financial_approval',
            'required_role': ['sales_manager'],
            'validation': 'sales_fields_filled'
        },
        'send_back': {
            'next_state': 'awaiting_logistics_customs',
            'required_role': ['sales_manager'],
            'validation': 'reason_required'
        }
    },
    'awaiting_financial_approval': {
        'approve': {
            'next_state': 'conditional_on_threshold',  # approved OR awaiting_senior
            'required_role': ['financial_manager'],
            'validation': None
        },
        'reject': {
            'next_state': 'rejected',
            'required_role': ['financial_manager'],
            'validation': 'reason_required'
        },
        'send_back': {
            'next_state': 'awaiting_sales_review',
            'required_role': ['financial_manager'],
            'validation': 'reason_required'
        }
    },
    'awaiting_senior_approval': {
        'approve': {
            'next_state': 'conditional_on_approval_count',  # approved OR stay
            'required_role': ['ceo', 'cfo', 'top_sales_manager'],
            'validation': None
        },
        'reject': {
            'next_state': 'rejected',
            'required_role': ['ceo', 'cfo', 'top_sales_manager'],
            'validation': 'reason_required'
        },
        'send_back': {
            'next_state': 'awaiting_financial_approval',
            'required_role': ['ceo', 'cfo'],
            'validation': 'reason_required'
        }
    }
}
```

### Auto-Transition Logic

**Trigger:** After `complete_logistics` or `complete_customs`

```python
async def check_parallel_tasks_complete(quote_id: UUID):
    """Auto-transition if both logistics and customs complete"""
    quote = await get_quote(quote_id)

    if quote.logistics_complete and quote.customs_complete:
        # Both done - auto-transition
        await transition_quote(
            quote_id=quote_id,
            from_state='awaiting_logistics_customs',
            to_state='awaiting_sales_review',
            action='auto_transition',
            performed_by='system',
            role='system'
        )

        # Send email to sales manager
        await notify_role(quote_id, 'sales_manager', 'quote_ready_for_review')
```

---

## Field Validation Rules

### Procurement Step

```python
def validate_procurement_fields(quote) -> List[str]:
    errors = []

    # All products must have prices and weights
    for product in quote.products:
        if not product.base_price_vat:
            errors.append(f"{product.product_name}: Отсутствует цена")
        if not product.weight_in_kg:
            errors.append(f"{product.product_name}: Отсутствует вес")

    # Quote variables
    required = ['supplier_country', 'advance_to_supplier', 'delivery_time']
    for field in required:
        if not quote.variables.get(field):
            errors.append(f"Отсутствует: {FIELD_LABELS[field]}")

    return errors
```

### Logistics Step

```python
def validate_logistics_fields(quote) -> List[str]:
    errors = []

    required = [
        'logistics_supplier_hub',
        'logistics_hub_customs',
        'logistics_customs_client'
    ]

    for field in required:
        if not quote.variables.get(field):
            errors.append(f"Отсутствует: {FIELD_LABELS[field]}")

    return errors
```

### Customs Step

```python
def validate_customs_fields(quote) -> List[str]:
    errors = []

    # All products must have customs codes and tariffs
    for product in quote.products:
        if not product.customs_code:
            errors.append(f"{product.product_name}: Отсутствует код ТН ВЭД")
        if product.import_tariff is None:
            errors.append(f"{product.product_name}: Отсутствует пошлина")

    # Quote variables
    if not quote.variables.get('brokerage_customs'):
        errors.append("Отсутствует: Брокерские РФ")

    return errors
```

### Sales Review Step

```python
def validate_sales_fields(quote) -> List[str]:
    errors = []

    # Must have both parallel tasks complete
    if not quote.logistics_complete:
        errors.append("Логистика не завершена")
    if not quote.customs_complete:
        errors.append("Таможня не завершена")

    # Sales variables
    required = ['markup', 'dm_fee_type', 'dm_fee_value', 'advance_from_client']
    for field in required:
        if not quote.variables.get(field):
            errors.append(f"Отсутствует: {FIELD_LABELS[field]}")

    # Must have calculations
    if not has_calculation_results(quote_id):
        errors.append("КП не рассчитан - нажмите 'Рассчитать'")

    return errors
```

---

## UI Components Specification

### WorkflowStatusCard

**Props:**
- `quote` - Quote object with workflow_state
- `workflow` - Workflow status from API
- `onAction` - Callback for action buttons

**Displays:**
- State badge with color
- Progress steps (Ant Design Steps component)
- Current assignee
- Parallel tasks (if applicable)
- Multi-approval progress (if applicable)
- Action buttons (if user can act)

**Height:** ~200px compact, ~400px with parallel tasks

### WorkflowActionButton

**Props:**
- `action` - Action type (submit, approve, reject, send_back)
- `onConfirm` - Callback after modal confirmation
- `loading` - Boolean

**Behavior:**
- Shows modal for confirmation
- Includes comment/reason field
- Validates before submitting
- Shows loading spinner
- Optimistic UI update

### WorkflowHistory

**Props:**
- `transitions` - Array of transition objects
- `pagination` - Optional, default 10 per page

**Displays:**
- Ant Design Timeline
- Each transition: user, role, action, timestamp, comments
- Color-coded by action type
- Collapsible comments section

---

## Migration Strategy

### Migrate Existing Quotes

**For quotes in current system:**
- All existing quotes: `workflow_state = 'approved'` (grandfathered)
- New quotes created after deployment: Start in `draft`

**Migration script:**

```sql
-- Grandfather existing quotes as approved
UPDATE quotes
SET workflow_state = 'approved',
    assigned_at = created_at
WHERE workflow_state IS NULL;

-- Initialize workflow settings for existing orgs
INSERT INTO organization_workflow_settings (organization_id)
SELECT id FROM organizations
ON CONFLICT DO NOTHING;
```

### Backward Compatibility

**Old approval page (`/quotes/approval`):**
- Archive or redirect to `/quotes/my-tasks`
- Old `quote_approvals` table: Keep for historical data, no new writes

---

## Success Criteria

- [ ] Multi-role workflow: 6 steps complete end-to-end
- [ ] Simple mode: Works same as current (skip steps 2-4)
- [ ] Parallel tasks: Logistics + customs work simultaneously
- [ ] Multi-senior approval: 2+ approvals for high-value quotes
- [ ] Send back: Any role can return quote to previous step
- [ ] Task lists: Each role sees only their assigned quotes
- [ ] Validation: Cannot advance without required fields
- [ ] Thresholds: Configurable per organization
- [ ] Performance: Transition <100ms
- [ ] RLS: Organization isolation maintained

---

## Risks & Mitigation

**Risk 1:** Complex state machine hard to debug
**Mitigation:** Comprehensive transition logging, visual state debugger in admin panel

**Risk 2:** Deadlocks (quote stuck in state)
**Mitigation:** Admin "force transition" endpoint, timeout alerts after 7 days

**Risk 3:** Users confused by workflow mode
**Mitigation:** Onboarding wizard, tooltips, help documentation

**Risk 4:** Performance degradation with many transitions
**Mitigation:** Indexes on workflow_state and role, pagination on history

---

## Rollback Plan

If workflow causes issues:

1. Set all orgs to `workflow_mode = 'simple'`
2. Update existing quotes to `workflow_state = 'draft'` or `'approved'`
3. Disable multi-role features in UI (feature flag)
4. Investigate issues in lower environment
5. Fix and re-deploy

No data loss - all quote data preserved.

---

**Author:** Claude
**Reviewed:** Andrey
**Approved:** 2025-11-08
