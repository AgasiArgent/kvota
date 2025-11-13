# Quote Workflow System - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement collaborative multi-role quote workflow with 5 specialized roles, parallel processing, and configurable approval thresholds.

**Architecture:** State machine with 7 states, role-based transitions, audit trail in `quote_workflow_transitions` table. Supports both simple mode (single person) and multi-role mode (6-step collaborative process).

**Tech Stack:** FastAPI + PostgreSQL + RLS, Next.js 15 + Ant Design, React Query

**Design Reference:** `docs/plans/2025-11-08-quote-workflow-system-design.md`

---

## Phase 1: Database Schema (2 hours, 10 tasks)

### Task 1.1: Create quote_workflow_transitions table

**Files:**
- Create: `backend/migrations/023_quote_workflow_system.sql`

**Step 1: Write migration SQL**

```sql
-- Migration: Quote Workflow System
-- Date: 2025-11-08
-- Purpose: Multi-role collaborative quote creation workflow
-- See: docs/plans/2025-11-08-quote-workflow-system-design.md

-- Helper function for RLS (if not exists)
CREATE OR REPLACE FUNCTION current_organization_id()
RETURNS UUID AS $$
  SELECT (current_setting('app.current_organization_id', true))::uuid;
$$ LANGUAGE SQL STABLE;

-- Create workflow transitions table (audit log)
CREATE TABLE quote_workflow_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Transition details
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'submit_procurement', 'approve', 'reject', 'send_back'

  -- Who and when
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  role_at_transition TEXT NOT NULL,

  -- Optional context
  comments TEXT,
  reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workflow_transitions_quote ON quote_workflow_transitions(quote_id);
CREATE INDEX idx_workflow_transitions_org ON quote_workflow_transitions(organization_id);
CREATE INDEX idx_workflow_transitions_state ON quote_workflow_transitions(to_state, organization_id);
CREATE INDEX idx_workflow_transitions_performed_at ON quote_workflow_transitions(performed_at DESC);

-- Enable RLS
ALTER TABLE quote_workflow_transitions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY workflow_transitions_select ON quote_workflow_transitions
  FOR SELECT USING (
    quote_id IN (
      SELECT id FROM quotes WHERE organization_id = current_organization_id()
    )
  );

CREATE POLICY workflow_transitions_insert ON quote_workflow_transitions
  FOR INSERT WITH CHECK (
    quote_id IN (
      SELECT id FROM quotes WHERE organization_id = current_organization_id()
    )
  );

-- Comments
COMMENT ON TABLE quote_workflow_transitions IS 'Audit log of all quote workflow state transitions';
COMMENT ON COLUMN quote_workflow_transitions.role_at_transition IS 'Role snapshot at time of action for audit trail';
```

**Step 2: Apply migration**

Run via Supabase SQL editor or:
```bash
# Not automated yet - apply manually via Supabase dashboard
```

**Step 3: Verify table created**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'quote_workflow_transitions';
```

Expected: 11 columns listed

**Step 4: Commit**

```bash
git add backend/migrations/023_quote_workflow_system.sql
git commit -m "migration: create quote_workflow_transitions table"
```

---

### Task 1.2: Create organization_workflow_settings table

**Files:**
- Modify: `backend/migrations/023_quote_workflow_system.sql` (append)

**Step 1: Add settings table SQL**

```sql
-- Create organization workflow settings table
CREATE TABLE organization_workflow_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,

  -- Workflow mode
  workflow_mode TEXT NOT NULL DEFAULT 'simple',
  CHECK (workflow_mode IN ('simple', 'multi_role')),

  -- Approval thresholds (USD)
  financial_approval_threshold_usd DECIMAL(15,2) DEFAULT 0.00,
  senior_approval_threshold_usd DECIMAL(15,2) DEFAULT 100000.00,
  multi_senior_threshold_usd DECIMAL(15,2) DEFAULT 500000.00,
  board_approval_threshold_usd DECIMAL(15,2) DEFAULT 1000000.00,

  -- Required approval counts
  senior_approvals_required INT DEFAULT 1 CHECK (senior_approvals_required BETWEEN 1 AND 5),
  multi_senior_approvals_required INT DEFAULT 2 CHECK (multi_senior_approvals_required BETWEEN 1 AND 5),
  board_approvals_required INT DEFAULT 3 CHECK (board_approvals_required BETWEEN 1 AND 5),

  -- Feature toggles
  enable_parallel_logistics_customs BOOLEAN DEFAULT true,
  allow_send_back BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_workflow_settings_org ON organization_workflow_settings(organization_id);

-- RLS
ALTER TABLE organization_workflow_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_settings_select ON organization_workflow_settings
  FOR SELECT USING (organization_id = current_organization_id());

CREATE POLICY workflow_settings_update ON organization_workflow_settings
  FOR UPDATE USING (organization_id = current_organization_id());

CREATE POLICY workflow_settings_insert ON organization_workflow_settings
  FOR INSERT WITH CHECK (organization_id = current_organization_id());

-- Initialize settings for existing organizations
INSERT INTO organization_workflow_settings (organization_id)
SELECT id FROM organizations
ON CONFLICT DO NOTHING;

-- Trigger for auto-update updated_at
CREATE TRIGGER update_workflow_settings_updated_at
  BEFORE UPDATE ON organization_workflow_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Step 2: Apply migration**

Re-run updated migration file via Supabase.

**Step 3: Verify settings initialized**

```sql
SELECT organization_id, workflow_mode, senior_approval_threshold_usd
FROM organization_workflow_settings;
```

Expected: One row per organization with default values

**Step 4: Commit**

```bash
git add backend/migrations/023_quote_workflow_system.sql
git commit -m "migration: add organization workflow settings table"
```

---

### Task 1.3: Add workflow columns to quotes table

**Files:**
- Modify: `backend/migrations/023_quote_workflow_system.sql` (append)

**Step 1: Add ALTER TABLE statements**

```sql
-- Add workflow columns to quotes table
ALTER TABLE quotes
  ADD COLUMN workflow_state TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN logistics_complete BOOLEAN DEFAULT false,
  ADD COLUMN customs_complete BOOLEAN DEFAULT false,
  ADD COLUMN current_assignee_role TEXT,
  ADD COLUMN assigned_at TIMESTAMPTZ,
  ADD COLUMN senior_approvals_required INT DEFAULT 0,
  ADD COLUMN senior_approvals_received INT DEFAULT 0;

-- Add constraint for workflow_state
ALTER TABLE quotes
  ADD CONSTRAINT check_workflow_state CHECK (
    workflow_state IN (
      'draft', 'awaiting_procurement', 'awaiting_logistics_customs',
      'awaiting_sales_review', 'awaiting_financial_approval',
      'awaiting_senior_approval', 'approved', 'rejected'
    )
  );

-- Indexes for filtering
CREATE INDEX idx_quotes_workflow_state ON quotes(workflow_state, organization_id);
CREATE INDEX idx_quotes_assignee_role ON quotes(current_assignee_role, organization_id)
  WHERE current_assignee_role IS NOT NULL;

-- Grandfather existing quotes as approved
UPDATE quotes
SET workflow_state = 'approved',
    assigned_at = created_at
WHERE workflow_state = 'draft' AND created_at < NOW() - INTERVAL '1 day';

-- Comments
COMMENT ON COLUMN quotes.workflow_state IS 'Current workflow state for multi-role collaboration';
COMMENT ON COLUMN quotes.logistics_complete IS 'Flag for parallel logistics completion';
COMMENT ON COLUMN quotes.customs_complete IS 'Flag for parallel customs completion';
```

**Step 2: Apply migration**

Re-run via Supabase.

**Step 3: Verify columns added**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'quotes' AND column_name LIKE '%workflow%';
```

Expected: workflow_state, logistics_complete, customs_complete, current_assignee_role, assigned_at

**Step 4: Commit**

```bash
git add backend/migrations/023_quote_workflow_system.sql
git commit -m "migration: add workflow columns to quotes table"
```

---

### Task 1.4: Add new roles to roles table

**Files:**
- Modify: `backend/migrations/023_quote_workflow_system.sql` (append)

**Step 1: Add INSERT statements for new roles**

```sql
-- Add workflow-specific roles
INSERT INTO roles (name, slug, description, permissions) VALUES
('Sales Manager', 'sales_manager', 'Creates quotes and sets client terms',
 '["quotes:create", "quotes:read", "quotes:update", "quotes:submit_procurement", "quotes:submit_approval"]'),

('Procurement Manager', 'procurement_manager', 'Negotiates supplier prices and terms',
 '["quotes:read", "quotes:update_procurement"]'),

('Logistics Manager', 'logistics_manager', 'Calculates shipping and logistics costs',
 '["quotes:read", "quotes:update_logistics", "quotes:complete_logistics"]'),

('Customs Manager', 'customs_manager', 'Determines tariffs and clearance fees',
 '["quotes:read", "quotes:update_customs", "quotes:complete_customs"]'),

('Financial Manager', 'financial_manager', 'Approves quotes financially',
 '["quotes:read", "quotes:approve_financial"]'),

('Top Sales Manager', 'top_sales_manager', 'Senior approval for high-value quotes',
 '["quotes:read", "quotes:approve_senior", "quotes:update"]'),

('CFO', 'cfo', 'Chief Financial Officer - senior approvals',
 '["quotes:read", "quotes:approve_senior", "quotes:approve_all", "settings:update"]'),

('CEO', 'ceo', 'Chief Executive Officer - final approvals',
 '["quotes:read", "quotes:approve_senior", "quotes:approve_all", "settings:update"]')

ON CONFLICT (slug) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  description = EXCLUDED.description;
```

**Step 2: Apply migration**

Re-run via Supabase.

**Step 3: Verify roles created**

```sql
SELECT slug, name FROM roles WHERE slug LIKE '%manager%' OR slug IN ('cfo', 'ceo');
```

Expected: 8 roles listed

**Step 4: Commit**

```bash
git add backend/migrations/023_quote_workflow_system.sql
git commit -m "migration: add workflow roles"
```

---

### Task 1.5: Test RLS policies

**Files:**
- None (SQL testing only)

**Step 1: Get test organization IDs**

```sql
SELECT id, name FROM organizations LIMIT 2;
```

Save org1_id and org2_id.

**Step 2: Test workflow_settings isolation**

```sql
-- Set context to org1
SELECT set_config('app.current_organization_id', '[org1_id]', false);

-- Should see org1 settings
SELECT * FROM organization_workflow_settings;

-- Set context to org2
SELECT set_config('app.current_organization_id', '[org2_id]', false);

-- Should see org2 settings (different data)
SELECT * FROM organization_workflow_settings;
```

Expected: Each org sees only their settings

**Step 3: Test transitions isolation**

```sql
-- Create test quote for org1
SELECT set_config('app.current_organization_id', '[org1_id]', false);
SELECT id FROM quotes WHERE organization_id = '[org1_id]' LIMIT 1;
-- Save quote_id_org1

-- Try to access from org2 context (should fail)
SELECT set_config('app.current_organization_id', '[org2_id]', false);
SELECT * FROM quote_workflow_transitions WHERE quote_id = '[quote_id_org1]';
```

Expected: 0 rows (RLS blocks cross-org access)

**Step 4: Document test results**

Create file with test results for reference.

---

## Phase 2: Backend API (3-4 hours, 15 tasks)

### Task 2.1: Create Pydantic models for workflow

**Files:**
- Create: `backend/workflow_models.py`

**Step 1: Write test for WorkflowStatus model**

Create: `backend/tests/test_workflow_models.py`

```python
from workflow_models import WorkflowStatus, WorkflowTransition, WorkflowAction

def test_workflow_status_validation():
    """Test WorkflowStatus model validates correctly"""
    status = WorkflowStatus(
        current_state="awaiting_procurement",
        current_assignee_role="procurement_manager",
        can_user_act=True,
        available_actions=["submit_procurement", "send_back"],
        transitions=[]
    )

    assert status.current_state == "awaiting_procurement"
    assert "submit_procurement" in status.available_actions
```

**Step 2: Run test to verify it fails**

```bash
cd backend
pytest tests/test_workflow_models.py::test_workflow_status_validation -v
```

Expected: FAIL (module not found)

**Step 3: Create workflow_models.py**

Create: `backend/workflow_models.py`

```python
"""
Workflow System - Pydantic Models
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime
from decimal import Decimal

WorkflowState = Literal[
    'draft',
    'awaiting_procurement',
    'awaiting_logistics_customs',
    'awaiting_sales_review',
    'awaiting_financial_approval',
    'awaiting_senior_approval',
    'approved',
    'rejected'
]

WorkflowMode = Literal['simple', 'multi_role']

WorkflowActionType = Literal[
    'submit_procurement',
    'complete_logistics',
    'complete_customs',
    'submit_approval',
    'approve',
    'reject',
    'send_back',
    'auto_transition'
]

class WorkflowTransition(BaseModel):
    """Single workflow transition record"""
    id: str
    quote_id: str
    from_state: WorkflowState
    to_state: WorkflowState
    action: WorkflowActionType
    performed_by: str
    performed_by_name: Optional[str] = None
    role_at_transition: str
    performed_at: datetime
    comments: Optional[str] = None
    reason: Optional[str] = None

class WorkflowStatus(BaseModel):
    """Current workflow status for a quote"""
    current_state: WorkflowState
    current_assignee_role: Optional[str] = None
    assigned_at: Optional[datetime] = None

    # User capabilities
    can_user_act: bool
    available_actions: List[WorkflowActionType]

    # Parallel tasks
    logistics_complete: bool = False
    customs_complete: bool = False

    # Multi-senior approval
    senior_approvals_required: int = 0
    senior_approvals_received: int = 0

    # History
    transitions: List[WorkflowTransition]

class WorkflowTransitionRequest(BaseModel):
    """Request to transition workflow state"""
    action: WorkflowActionType
    comments: Optional[str] = Field(None, max_length=500)
    reason: Optional[str] = Field(None, max_length=500)

class WorkflowTransitionResponse(BaseModel):
    """Response after successful transition"""
    quote_id: str
    old_state: WorkflowState
    new_state: WorkflowState
    transition_id: str
    next_assignee_role: Optional[str] = None
    message: str

class WorkflowSettings(BaseModel):
    """Organization workflow configuration"""
    organization_id: str
    workflow_mode: WorkflowMode

    # Thresholds
    financial_approval_threshold_usd: Decimal
    senior_approval_threshold_usd: Decimal
    multi_senior_threshold_usd: Decimal
    board_approval_threshold_usd: Decimal

    # Approval counts
    senior_approvals_required: int
    multi_senior_approvals_required: int
    board_approvals_required: int

    # Features
    enable_parallel_logistics_customs: bool
    allow_send_back: bool

class WorkflowSettingsUpdate(BaseModel):
    """Update workflow settings (admin only)"""
    workflow_mode: Optional[WorkflowMode] = None
    senior_approval_threshold_usd: Optional[Decimal] = None
    multi_senior_threshold_usd: Optional[Decimal] = None
    board_approval_threshold_usd: Optional[Decimal] = None
    senior_approvals_required: Optional[int] = Field(None, ge=1, le=5)
    multi_senior_approvals_required: Optional[int] = Field(None, ge=1, le=5)
    board_approvals_required: Optional[int] = Field(None, ge=1, le=5)

class MyTask(BaseModel):
    """Quote in user's task list"""
    quote_id: str
    quote_number: str
    customer_name: str
    total_amount: Decimal
    workflow_state: WorkflowState
    assigned_at: datetime
    age_hours: int
```

**Step 4: Run test to verify it passes**

```bash
pytest tests/test_workflow_models.py::test_workflow_status_validation -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend/workflow_models.py backend/tests/test_workflow_models.py
git commit -m "feat(workflow): add Pydantic models for workflow system"
```

---

### Task 2.2: Create workflow validation logic

**Files:**
- Create: `backend/workflow_validator.py`
- Create: `backend/tests/test_workflow_validator.py`

**Step 1: Write test for state transition validation**

Create: `backend/tests/test_workflow_validator.py`

```python
import pytest
from workflow_validator import WorkflowValidator, TransitionError
from workflow_models import WorkflowSettings, WorkflowMode
from decimal import Decimal

@pytest.fixture
def default_settings():
    return WorkflowSettings(
        organization_id="test-org",
        workflow_mode="multi_role",
        financial_approval_threshold_usd=Decimal("0"),
        senior_approval_threshold_usd=Decimal("100000"),
        multi_senior_threshold_usd=Decimal("500000"),
        board_approval_threshold_usd=Decimal("1000000"),
        senior_approvals_required=1,
        multi_senior_approvals_required=2,
        board_approvals_required=3,
        enable_parallel_logistics_customs=True,
        allow_send_back=True
    )

def test_valid_transition_draft_to_procurement(default_settings):
    """Test valid transition from draft to awaiting_procurement"""
    validator = WorkflowValidator(default_settings)

    is_valid, next_state, error = validator.validate_transition(
        from_state="draft",
        action="submit_procurement",
        user_role="sales_manager"
    )

    assert is_valid is True
    assert next_state == "awaiting_procurement"
    assert error is None

def test_invalid_role_for_transition(default_settings):
    """Test transition rejected for wrong role"""
    validator = WorkflowValidator(default_settings)

    is_valid, next_state, error = validator.validate_transition(
        from_state="draft",
        action="submit_procurement",
        user_role="procurement_manager"  # Wrong role!
    )

    assert is_valid is False
    assert error is not None
    assert "role" in error.lower()

def test_threshold_triggers_senior_approval(default_settings):
    """Test quote > $100k requires senior approval"""
    validator = WorkflowValidator(default_settings)

    required = validator.get_required_senior_approvals(Decimal("150000"))

    assert required == 1  # 1 senior approval

def test_multi_senior_threshold(default_settings):
    """Test quote > $500k requires 2 senior approvals"""
    validator = WorkflowValidator(default_settings)

    required = validator.get_required_senior_approvals(Decimal("600000"))

    assert required == 2  # 2 senior approvals
```

**Step 2: Run tests to verify they fail**

```bash
pytest tests/test_workflow_validator.py -v
```

Expected: FAIL (module not found)

**Step 3: Implement WorkflowValidator**

Create: `backend/workflow_validator.py`

```python
"""
Workflow Validation Logic
"""

from typing import Tuple, Optional, List
from decimal import Decimal
from workflow_models import WorkflowState, WorkflowMode, WorkflowActionType, WorkflowSettings

class TransitionError(Exception):
    """Workflow transition validation error"""
    pass

class WorkflowValidator:
    """Validates workflow state transitions and permissions"""

    # Allowed transitions by workflow mode
    TRANSITIONS = {
        'multi_role': {
            'draft': {
                'submit_procurement': ('awaiting_procurement', ['sales_manager'])
            },
            'awaiting_procurement': {
                'submit_procurement': ('awaiting_logistics_customs', ['procurement_manager']),
                'send_back': ('draft', ['procurement_manager'])
            },
            'awaiting_logistics_customs': {
                'complete_logistics': ('awaiting_logistics_customs', ['logistics_manager']),
                'complete_customs': ('awaiting_logistics_customs', ['customs_manager']),
                'send_back': ('awaiting_procurement', ['logistics_manager', 'customs_manager'])
            },
            'awaiting_sales_review': {
                'submit_approval': ('awaiting_financial_approval', ['sales_manager']),
                'send_back': ('awaiting_logistics_customs', ['sales_manager'])
            },
            'awaiting_financial_approval': {
                'approve': ('conditional', ['financial_manager']),  # Check threshold
                'reject': ('rejected', ['financial_manager']),
                'send_back': ('awaiting_sales_review', ['financial_manager'])
            },
            'awaiting_senior_approval': {
                'approve': ('conditional', ['ceo', 'cfo', 'top_sales_manager']),  # Check count
                'reject': ('rejected', ['ceo', 'cfo', 'top_sales_manager']),
                'send_back': ('awaiting_financial_approval', ['ceo', 'cfo'])
            }
        },
        'simple': {
            'draft': {
                'submit_approval': ('awaiting_financial_approval', ['sales_manager', 'manager', 'admin', 'owner'])
            },
            'awaiting_financial_approval': {
                'approve': ('conditional', ['financial_manager', 'admin', 'owner']),
                'reject': ('rejected', ['financial_manager', 'admin', 'owner'])
            },
            'awaiting_senior_approval': {
                'approve': ('conditional', ['ceo', 'cfo', 'top_sales_manager', 'owner']),
                'reject': ('rejected', ['ceo', 'cfo', 'top_sales_manager', 'owner'])
            }
        }
    }

    def __init__(self, settings: WorkflowSettings):
        self.settings = settings
        self.mode = settings.workflow_mode

    def validate_transition(
        self,
        from_state: WorkflowState,
        action: WorkflowActionType,
        user_role: str
    ) -> Tuple[bool, Optional[WorkflowState], Optional[str]]:
        """
        Validate if transition is allowed.

        Returns: (is_valid, next_state, error_message)
        """
        # Get workflow for current mode
        workflow = self.TRANSITIONS.get(self.mode)
        if not workflow:
            return (False, None, f"Invalid workflow mode: {self.mode}")

        # Check if current state exists
        if from_state not in workflow:
            return (False, None, f"Invalid state: {from_state}")

        # Check if action is allowed from this state
        if action not in workflow[from_state]:
            return (False, None, f"Action '{action}' not allowed from state '{from_state}'")

        # Get transition rule
        next_state, allowed_roles = workflow[from_state][action]

        # Check user has required role
        if user_role not in allowed_roles:
            return (False, None, f"Role '{user_role}' cannot perform '{action}'")

        return (True, next_state, None)

    def get_required_senior_approvals(self, total_usd: Decimal) -> int:
        """
        Calculate how many senior approvals are required based on amount.

        Thresholds cascade:
        - < $100k: 0 approvals
        - $100k - $500k: 1 approval
        - $500k - $1M: 2 approvals
        - >= $1M: 3 approvals
        """
        if total_usd >= self.settings.board_approval_threshold_usd:
            return self.settings.board_approvals_required

        if total_usd >= self.settings.multi_senior_threshold_usd:
            return self.settings.multi_senior_approvals_required

        if total_usd >= self.settings.senior_approval_threshold_usd:
            return self.settings.senior_approvals_required

        return 0  # No senior approval needed

    def calculate_next_state_after_approval(
        self,
        current_state: WorkflowState,
        total_usd: Decimal,
        current_senior_approvals: int = 0
    ) -> WorkflowState:
        """
        Calculate next state after approve action.

        Handles threshold checks and multi-approval counting.
        """
        if current_state == 'awaiting_financial_approval':
            # Check if senior approval needed
            required_approvals = self.get_required_senior_approvals(total_usd)

            if required_approvals > 0:
                return 'awaiting_senior_approval'
            else:
                return 'approved'

        elif current_state == 'awaiting_senior_approval':
            # Check if enough approvals received
            required_approvals = self.get_required_senior_approvals(total_usd)

            if current_senior_approvals + 1 >= required_approvals:
                return 'approved'
            else:
                return 'awaiting_senior_approval'  # Stay, need more

        return 'approved'  # Default
```

**Step 4: Run tests to verify they pass**

```bash
pytest tests/test_workflow_validator.py -v
```

Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add backend/workflow_validator.py backend/workflow_models.py backend/tests/test_workflow_validator.py backend/tests/test_workflow_models.py
git commit -m "feat(workflow): add validation logic and models"
```

---

### Task 2.3: Create POST /api/quotes/{id}/transition endpoint

**Files:**
- Create: `backend/routes/workflow.py`
- Create: `backend/tests/routes/test_workflow.py`

**Step 1: Write test for transition endpoint**

Create: `backend/tests/routes/test_workflow.py`

```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_transition_quote_from_draft_to_procurement(auth_headers, test_quote_id):
    """Test transitioning quote from draft to awaiting_procurement"""
    response = client.post(
        f"/api/quotes/{test_quote_id}/transition",
        headers=auth_headers,
        json={
            "action": "submit_procurement",
            "comments": "Готово к закупкам"
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["old_state"] == "draft"
    assert data["new_state"] == "awaiting_procurement"
    assert data["next_assignee_role"] == "procurement_manager"

def test_transition_invalid_role_rejected(auth_headers, test_quote_id):
    """Test transition rejected for wrong role"""
    # User with procurement_manager role tries to submit from draft
    response = client.post(
        f"/api/quotes/{test_quote_id}/transition",
        headers=auth_headers_procurement,  # Wrong role
        json={"action": "submit_procurement"}
    )

    assert response.status_code == 403
    assert "role" in response.json()["detail"].lower()
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/routes/test_workflow.py::test_transition_quote_from_draft_to_procurement -v
```

Expected: FAIL (endpoint not found)

**Step 3: Create workflow router**

Create: `backend/routes/workflow.py`

```python
"""
Quote Workflow API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from uuid import UUID
from decimal import Decimal
import logging

from auth import get_current_user, User, check_admin_permissions
from workflow_models import (
    WorkflowStatus, WorkflowTransitionRequest, WorkflowTransitionResponse,
    WorkflowSettings, WorkflowSettingsUpdate, MyTask, WorkflowTransition
)
from workflow_validator import WorkflowValidator
from supabase import create_client, Client
import os

router = APIRouter(prefix="/api/quotes", tags=["workflow"])
logger = logging.getLogger(__name__)

supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

# ============================================================================
# ENDPOINT 1: Transition Workflow State
# ============================================================================

@router.post("/{quote_id}/transition", response_model=WorkflowTransitionResponse)
async def transition_quote_workflow(
    quote_id: UUID,
    request: WorkflowTransitionRequest,
    user: User = Depends(get_current_user)
):
    """
    Transition quote to next workflow state.

    Validates:
    - User has required role for this transition
    - Current state allows this action
    - Required fields are filled
    """
    # Get quote
    quote_result = supabase.table("quotes")\
        .select("*")\
        .eq("id", str(quote_id))\
        .eq("organization_id", str(user.current_organization_id))\
        .single()\
        .execute()

    if not quote_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found"
        )

    quote = quote_result.data

    # Get workflow settings
    settings_result = supabase.table("organization_workflow_settings")\
        .select("*")\
        .eq("organization_id", str(user.current_organization_id))\
        .single()\
        .execute()

    settings = WorkflowSettings(**settings_result.data)

    # Validate transition
    validator = WorkflowValidator(settings)
    is_valid, next_state, error = validator.validate_transition(
        from_state=quote["workflow_state"],
        action=request.action,
        user_role=user.role
    )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error
        )

    # Handle conditional states (threshold checks)
    if next_state == 'conditional':
        if quote["workflow_state"] == 'awaiting_financial_approval':
            # Check threshold after financial approval
            total_usd = Decimal(str(quote.get("total_amount", 0)))  # Assume USD for now
            required = validator.get_required_senior_approvals(total_usd)

            if required > 0:
                next_state = 'awaiting_senior_approval'
                # Update quote with approval requirements
                supabase.table("quotes").update({
                    "senior_approvals_required": required,
                    "senior_approvals_received": 0
                }).eq("id", str(quote_id)).execute()
            else:
                next_state = 'approved'

        elif quote["workflow_state"] == 'awaiting_senior_approval':
            # Count existing approvals
            current_approvals = quote.get("senior_approvals_received", 0)
            required = quote.get("senior_approvals_required", 1)

            if current_approvals + 1 >= required:
                next_state = 'approved'
            else:
                next_state = 'awaiting_senior_approval'
                # Increment approval count
                supabase.table("quotes").update({
                    "senior_approvals_received": current_approvals + 1
                }).eq("id", str(quote_id)).execute()

    # Handle parallel task flags
    if request.action == 'complete_logistics':
        supabase.table("quotes").update({
            "logistics_complete": True
        }).eq("id", str(quote_id)).execute()

        # Check if both complete
        if quote.get("customs_complete"):
            next_state = 'awaiting_sales_review'
            request.action = 'auto_transition'

    elif request.action == 'complete_customs':
        supabase.table("quotes").update({
            "customs_complete": True
        }).eq("id", str(quote_id)).execute()

        # Check if both complete
        if quote.get("logistics_complete"):
            next_state = 'awaiting_sales_review'
            request.action = 'auto_transition'

    # Update quote state
    next_assignee = get_next_assignee_role(next_state, settings.workflow_mode)

    supabase.table("quotes").update({
        "workflow_state": next_state,
        "current_assignee_role": next_assignee,
        "assigned_at": "now()"
    }).eq("id", str(quote_id)).execute()

    # Log transition
    transition_data = {
        "quote_id": str(quote_id),
        "organization_id": str(user.current_organization_id),
        "from_state": quote["workflow_state"],
        "to_state": next_state,
        "action": request.action,
        "performed_by": str(user.id),
        "role_at_transition": user.role,
        "comments": request.comments,
        "reason": request.reason
    }

    transition_result = supabase.table("quote_workflow_transitions")\
        .insert(transition_data)\
        .execute()

    return WorkflowTransitionResponse(
        quote_id=str(quote_id),
        old_state=quote["workflow_state"],
        new_state=next_state,
        transition_id=transition_result.data[0]["id"],
        next_assignee_role=next_assignee,
        message=get_transition_message(request.action, next_state)
    )

def get_next_assignee_role(state: str, mode: str) -> Optional[str]:
    """Get role that should be assigned for given state"""
    if mode == 'multi_role':
        assignments = {
            'awaiting_procurement': 'procurement_manager',
            'awaiting_logistics_customs': 'logistics_manager',  # Both logistics and customs
            'awaiting_sales_review': 'sales_manager',
            'awaiting_financial_approval': 'financial_manager',
            'awaiting_senior_approval': 'ceo',
        }
    else:  # simple mode
        assignments = {
            'awaiting_financial_approval': 'financial_manager',
            'awaiting_senior_approval': 'ceo',
        }

    return assignments.get(state)

def get_transition_message(action: str, next_state: str) -> str:
    """Generate user-friendly message for transition"""
    messages = {
        ('submit_procurement', 'awaiting_procurement'): "КП отправлен в закупки",
        ('submit_procurement', 'awaiting_logistics_customs'): "КП отправлен в логистику и таможню",
        ('complete_logistics', 'awaiting_logistics_customs'): "Логистика завершена",
        ('complete_customs', 'awaiting_logistics_customs'): "Таможня завершена",
        ('auto_transition', 'awaiting_sales_review'): "Логистика и таможня завершены - КП возвращен менеджеру",
        ('submit_approval', 'awaiting_financial_approval'): "КП отправлен на финансовое утверждение",
        ('approve', 'awaiting_senior_approval'): "Утверждено - требуется подпись руководства",
        ('approve', 'approved'): "КП утвержден",
        ('reject', 'rejected'): "КП отклонен",
        ('send_back', '*'): "КП возвращен на доработку"
    }

    key = (action, next_state)
    if key in messages:
        return messages[key]

    # Send back messages
    if action == 'send_back':
        return messages[('send_back', '*')]

    return f"Статус обновлен: {next_state}"
```

**Step 4: Register router in main.py**

Modify: `backend/main.py`

```python
# Add import
from routes import workflow

# Add router
app.include_router(workflow.router)
```

**Step 5: Run tests**

```bash
pytest tests/routes/test_workflow.py -v
```

Expected: PASS

**Step 6: Commit**

```bash
git add backend/routes/workflow.py backend/tests/routes/test_workflow.py backend/main.py
git commit -m "feat(workflow): add transition endpoint with validation"
```

---

### Task 2.4: Create GET /api/quotes/{id}/workflow endpoint

**Files:**
- Modify: `backend/routes/workflow.py` (add endpoint)
- Modify: `backend/tests/routes/test_workflow.py` (add test)

**Step 1: Write test**

Add to `backend/tests/routes/test_workflow.py`:

```python
def test_get_workflow_status(auth_headers, test_quote_id):
    """Test getting workflow status for quote"""
    response = client.get(
        f"/api/quotes/{test_quote_id}/workflow",
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "current_state" in data
    assert "can_user_act" in data
    assert "available_actions" in data
    assert "transitions" in data
```

**Step 2: Run test (should fail)**

```bash
pytest tests/routes/test_workflow.py::test_get_workflow_status -v
```

Expected: FAIL (endpoint not found)

**Step 3: Implement endpoint**

Add to `backend/routes/workflow.py`:

```python
@router.get("/{quote_id}/workflow", response_model=WorkflowStatus)
async def get_quote_workflow_status(
    quote_id: UUID,
    user: User = Depends(get_current_user)
):
    """
    Get current workflow status and history for quote.

    Returns:
    - Current state and assignee
    - Actions user can take
    - Full transition history
    - Senior approval progress
    """
    # Get quote
    quote_result = supabase.table("quotes")\
        .select("*")\
        .eq("id", str(quote_id))\
        .eq("organization_id", str(user.current_organization_id))\
        .single()\
        .execute()

    if not quote_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found"
        )

    quote = quote_result.data

    # Get workflow settings
    settings_result = supabase.table("organization_workflow_settings")\
        .select("*")\
        .eq("organization_id", str(user.current_organization_id))\
        .single()\
        .execute()

    settings = WorkflowSettings(**settings_result.data)

    # Get transition history
    history_result = supabase.table("quote_workflow_transitions")\
        .select("*, users:performed_by(full_name)")\
        .eq("quote_id", str(quote_id))\
        .order("performed_at", desc=False)\
        .execute()

    transitions = []
    for t in history_result.data:
        transitions.append(WorkflowTransition(
            id=t["id"],
            quote_id=t["quote_id"],
            from_state=t["from_state"],
            to_state=t["to_state"],
            action=t["action"],
            performed_by=t["performed_by"],
            performed_by_name=t.get("users", {}).get("full_name"),
            role_at_transition=t["role_at_transition"],
            performed_at=t["performed_at"],
            comments=t.get("comments"),
            reason=t.get("reason")
        ))

    # Check if user can act
    validator = WorkflowValidator(settings)
    current_state = quote["workflow_state"]

    # Get all possible actions from this state
    workflow = validator.TRANSITIONS[settings.workflow_mode]
    possible_actions = list(workflow.get(current_state, {}).keys())

    # Filter to actions user can perform
    available_actions = []
    for action in possible_actions:
        is_valid, _, _ = validator.validate_transition(current_state, action, user.role)
        if is_valid:
            available_actions.append(action)

    can_user_act = len(available_actions) > 0

    return WorkflowStatus(
        current_state=current_state,
        current_assignee_role=quote.get("current_assignee_role"),
        assigned_at=quote.get("assigned_at"),
        can_user_act=can_user_act,
        available_actions=available_actions,
        logistics_complete=quote.get("logistics_complete", False),
        customs_complete=quote.get("customs_complete", False),
        senior_approvals_required=quote.get("senior_approvals_required", 0),
        senior_approvals_received=quote.get("senior_approvals_received", 0),
        transitions=transitions
    )
```

**Step 4: Run test**

```bash
pytest tests/routes/test_workflow.py::test_get_workflow_status -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend/routes/workflow.py backend/tests/routes/test_workflow.py
git commit -m "feat(workflow): add workflow status endpoint"
```

---

### Task 2.5: Create GET /api/quotes/my-tasks endpoint

**Files:**
- Modify: `backend/routes/workflow.py` (add endpoint)
- Modify: `backend/tests/routes/test_workflow.py` (add test)

**Step 1: Write test**

```python
def test_get_my_tasks_sales_manager(auth_headers_sales):
    """Test sales manager sees their assigned quotes"""
    response = client.get(
        "/api/quotes/my-tasks",
        headers=auth_headers_sales
    )

    assert response.status_code == 200
    data = response.json()
    assert "tasks" in data
    assert "count" in data

    # Should only see quotes assigned to sales_manager role
    for task in data["tasks"]:
        assert task["workflow_state"] in ["draft", "awaiting_sales_review"]
```

**Step 2: Run test (should fail)**

```bash
pytest tests/routes/test_workflow.py::test_get_my_tasks_sales_manager -v
```

Expected: FAIL

**Step 3: Implement endpoint**

Add to `backend/routes/workflow.py`:

```python
@router.get("/my-tasks")
async def get_my_workflow_tasks(user: User = Depends(get_current_user)):
    """
    Get all quotes currently assigned to user's role.

    Returns quotes where:
    - current_assignee_role matches user's role
    - workflow_state is not terminal (approved/rejected/draft)
    """
    from datetime import datetime

    # Map user role to assignee roles they can handle
    role_mapping = {
        'sales_manager': ['sales_manager'],
        'procurement_manager': ['procurement_manager'],
        'logistics_manager': ['logistics_manager'],
        'customs_manager': ['customs_manager'],
        'financial_manager': ['financial_manager'],
        'top_sales_manager': ['ceo', 'top_sales_manager'],  # Can handle senior approvals
        'cfo': ['ceo', 'cfo', 'top_sales_manager'],
        'ceo': ['ceo', 'cfo', 'top_sales_manager'],
        'admin': ['ceo', 'financial_manager'],  # Admin can handle approvals
        'owner': ['ceo', 'financial_manager']   # Owner can handle approvals
    }

    assignee_roles = role_mapping.get(user.role, [user.role])

    # Get quotes assigned to user's role
    quotes_result = supabase.table("quotes")\
        .select("id, quote_number, customer_id, total_amount, workflow_state, assigned_at, customers(name)")\
        .eq("organization_id", str(user.current_organization_id))\
        .in_("current_assignee_role", assignee_roles)\
        .neq("workflow_state", "approved")\
        .neq("workflow_state", "rejected")\
        .order("assigned_at", desc=True)\
        .execute()

    tasks = []
    for quote in quotes_result.data:
        # Calculate age in hours
        assigned_at = datetime.fromisoformat(quote["assigned_at"].replace('Z', '+00:00'))
        age_hours = int((datetime.now(assigned_at.tzinfo) - assigned_at).total_seconds() / 3600)

        tasks.append(MyTask(
            quote_id=quote["id"],
            quote_number=quote["quote_number"],
            customer_name=quote.get("customers", {}).get("name", "Unknown"),
            total_amount=Decimal(str(quote["total_amount"])),
            workflow_state=quote["workflow_state"],
            assigned_at=assigned_at,
            age_hours=age_hours
        ))

    return {
        "tasks": tasks,
        "count": len(tasks)
    }
```

**Step 4: Run test**

```bash
pytest tests/routes/test_workflow.py::test_get_my_tasks_sales_manager -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend/routes/workflow.py backend/tests/routes/test_workflow.py
git commit -m "feat(workflow): add my-tasks endpoint for role-based task lists"
```

---

## Phase 3: Frontend Components (3-4 hours, 12 tasks)

### Task 3.1: Create WorkflowStateBadge component

**Files:**
- Create: `frontend/src/components/workflow/WorkflowStateBadge.tsx`
- Create: `frontend/src/components/workflow/index.ts`

**Step 1: Create component**

```tsx
'use client';

import { Tag } from 'antd';
import {
  FileTextOutlined,
  ShoppingCartOutlined,
  CarOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';

type WorkflowState =
  | 'draft'
  | 'awaiting_procurement'
  | 'awaiting_logistics_customs'
  | 'awaiting_sales_review'
  | 'awaiting_financial_approval'
  | 'awaiting_senior_approval'
  | 'approved'
  | 'rejected';

interface WorkflowStateBadgeProps {
  state: WorkflowState;
  size?: 'small' | 'default' | 'large';
}

const STATE_CONFIG = {
  draft: {
    label: 'Черновик',
    color: 'default',
    icon: <FileTextOutlined />,
  },
  awaiting_procurement: {
    label: 'Ожидает закупки',
    color: 'blue',
    icon: <ShoppingCartOutlined />,
  },
  awaiting_logistics_customs: {
    label: 'Логистика и таможня',
    color: 'cyan',
    icon: <CarOutlined />,
  },
  awaiting_sales_review: {
    label: 'Проверка продаж',
    color: 'blue',
    icon: <FileTextOutlined />,
  },
  awaiting_financial_approval: {
    label: 'Финансовое утверждение',
    color: 'orange',
    icon: <DollarOutlined />,
  },
  awaiting_senior_approval: {
    label: 'Подпись руководства',
    color: 'gold',
    icon: <DollarOutlined />,
  },
  approved: {
    label: 'Утверждено',
    color: 'success',
    icon: <CheckCircleOutlined />,
  },
  rejected: {
    label: 'Отклонено',
    color: 'error',
    icon: <CloseCircleOutlined />,
  },
};

export default function WorkflowStateBadge({ state, size = 'default' }: WorkflowStateBadgeProps) {
  const config = STATE_CONFIG[state];

  return (
    <Tag color={config.color} icon={config.icon} style={{ fontSize: size === 'small' ? 12 : 14 }}>
      {config.label}
    </Tag>
  );
}
```

**Step 2: Create barrel export**

Create: `frontend/src/components/workflow/index.ts`

```typescript
export { default as WorkflowStateBadge } from './WorkflowStateBadge';
```

**Step 3: Test manually in browser**

Add to any page temporarily:
```tsx
import { WorkflowStateBadge } from '@/components/workflow';

<WorkflowStateBadge state="awaiting_procurement" />
```

Expected: Blue badge showing "Ожидает закупки"

**Step 4: Commit**

```bash
git add frontend/src/components/workflow/
git commit -m "feat(workflow): add WorkflowStateBadge component"
```

---

### Task 3.2: Create workflow API service

**Files:**
- Create: `frontend/src/lib/api/workflow-service.ts`

**Step 1: Create TypeScript interfaces and service**

```typescript
/**
 * Workflow API Service
 */

import { createClient } from '@/lib/supabase/client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function getAuthHeaders() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

// Types (matching backend models)
export type WorkflowState =
  | 'draft'
  | 'awaiting_procurement'
  | 'awaiting_logistics_customs'
  | 'awaiting_sales_review'
  | 'awaiting_financial_approval'
  | 'awaiting_senior_approval'
  | 'approved'
  | 'rejected';

export type WorkflowAction =
  | 'submit_procurement'
  | 'complete_logistics'
  | 'complete_customs'
  | 'submit_approval'
  | 'approve'
  | 'reject'
  | 'send_back';

export interface WorkflowTransition {
  id: string;
  quote_id: string;
  from_state: WorkflowState;
  to_state: WorkflowState;
  action: WorkflowAction;
  performed_by: string;
  performed_by_name?: string;
  role_at_transition: string;
  performed_at: string;
  comments?: string;
  reason?: string;
}

export interface WorkflowStatus {
  current_state: WorkflowState;
  current_assignee_role?: string;
  assigned_at?: string;
  can_user_act: boolean;
  available_actions: WorkflowAction[];
  logistics_complete: boolean;
  customs_complete: boolean;
  senior_approvals_required: number;
  senior_approvals_received: number;
  transitions: WorkflowTransition[];
}

export interface WorkflowTransitionRequest {
  action: WorkflowAction;
  comments?: string;
  reason?: string;
}

export interface WorkflowTransitionResponse {
  quote_id: string;
  old_state: WorkflowState;
  new_state: WorkflowState;
  transition_id: string;
  next_assignee_role?: string;
  message: string;
}

export interface MyTask {
  quote_id: string;
  quote_number: string;
  customer_name: string;
  total_amount: number;
  workflow_state: WorkflowState;
  assigned_at: string;
  age_hours: number;
}

// API Functions

export async function transitionWorkflow(
  quoteId: string,
  request: WorkflowTransitionRequest
): Promise<WorkflowTransitionResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/quotes/${quoteId}/transition`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to transition workflow');
  }

  return response.json();
}

export async function getWorkflowStatus(quoteId: string): Promise<WorkflowStatus> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/quotes/${quoteId}/workflow`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get workflow status');
  }

  return response.json();
}

export async function getMyTasks(): Promise<{ tasks: MyTask[]; count: number }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/quotes/my-tasks`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get tasks');
  }

  return response.json();
}
```

**Step 2: Commit**

```bash
git add frontend/src/lib/api/workflow-service.ts
git commit -m "feat(workflow): add workflow API service"
```

---

### Task 3.3: Create WorkflowStatusCard component

**Files:**
- Create: `frontend/src/components/workflow/WorkflowStatusCard.tsx`

**Step 1: Create component**

```tsx
'use client';

import { Card, Steps, Row, Col, Space, Typography, Alert, Progress } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import WorkflowStateBadge from './WorkflowStateBadge';
import type { WorkflowStatus } from '@/lib/api/workflow-service';

const { Text, Title } = Typography;

interface WorkflowStatusCardProps {
  workflow: WorkflowStatus;
  workflowMode: 'simple' | 'multi_role';
}

const MULTI_ROLE_STEPS = [
  { title: 'Черновик', description: 'Создание КП' },
  { title: 'Закупки', description: 'Цены и условия' },
  { title: 'Логистика/Таможня', description: 'Расходы' },
  { title: 'Продажи', description: 'Наценка' },
  { title: 'Финансы', description: 'Утверждение' },
  { title: 'Руководство', description: 'Подпись' },
  { title: 'Готово', description: 'Утверждено' },
];

const SIMPLE_STEPS = [
  { title: 'Черновик', description: 'Создание КП' },
  { title: 'Финансы', description: 'Утверждение' },
  { title: 'Руководство', description: 'Подпись' },
  { title: 'Готово', description: 'Утверждено' },
];

function getCurrentStepIndex(state: string, mode: string): number {
  if (mode === 'multi_role') {
    const stateToStep = {
      draft: 0,
      awaiting_procurement: 1,
      awaiting_logistics_customs: 2,
      awaiting_sales_review: 3,
      awaiting_financial_approval: 4,
      awaiting_senior_approval: 5,
      approved: 6,
      rejected: 6,
    };
    return stateToStep[state] || 0;
  } else {
    const stateToStep = {
      draft: 0,
      awaiting_financial_approval: 1,
      awaiting_senior_approval: 2,
      approved: 3,
      rejected: 3,
    };
    return stateToStep[state] || 0;
  }
}

function getRoleLabel(role?: string): string {
  const labels = {
    sales_manager: 'Менеджер по продажам',
    procurement_manager: 'Менеджер по закупкам',
    logistics_manager: 'Менеджер по логистике',
    customs_manager: 'Таможенный менеджер',
    financial_manager: 'Финансовый менеджер',
    ceo: 'Генеральный директор',
    cfo: 'Финансовый директор',
    top_sales_manager: 'Руководитель продаж',
  };
  return labels[role || ''] || role || 'Не назначено';
}

export default function WorkflowStatusCard({ workflow, workflowMode }: WorkflowStatusCardProps) {
  const steps = workflowMode === 'multi_role' ? MULTI_ROLE_STEPS : SIMPLE_STEPS;
  const currentStep = getCurrentStepIndex(workflow.current_state, workflowMode);
  const stepStatus = workflow.current_state === 'rejected' ? 'error' : 'process';

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Current status */}
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <WorkflowStateBadge state={workflow.current_state} />
              {workflow.current_assignee_role && (
                <Text type="secondary">
                  Назначено: <Text strong>{getRoleLabel(workflow.current_assignee_role)}</Text>
                </Text>
              )}
            </Space>
          </Col>
        </Row>

        {/* Progress steps */}
        <Steps current={currentStep} status={stepStatus} items={steps} size="small" />

        {/* Parallel tasks indicator */}
        {workflow.current_state === 'awaiting_logistics_customs' && workflowMode === 'multi_role' && (
          <Row gutter={16}>
            <Col span={12}>
              <Card
                size="small"
                style={{
                  backgroundColor: workflow.logistics_complete ? '#f6ffed' : '#fff',
                  borderColor: workflow.logistics_complete ? '#52c41a' : '#d9d9d9',
                }}
              >
                <Space>
                  {workflow.logistics_complete ? (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  ) : (
                    <ClockCircleOutlined style={{ color: '#faad14' }} />
                  )}
                  <Text>Логистика</Text>
                </Space>
              </Card>
            </Col>
            <Col span={12}>
              <Card
                size="small"
                style={{
                  backgroundColor: workflow.customs_complete ? '#f6ffed' : '#fff',
                  borderColor: workflow.customs_complete ? '#52c41a' : '#d9d9d9',
                }}
              >
                <Space>
                  {workflow.customs_complete ? (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  ) : (
                    <ClockCircleOutlined style={{ color: '#faad14' }} />
                  )}
                  <Text>Таможня</Text>
                </Space>
              </Card>
            </Col>
          </Row>
        )}

        {/* Multi-senior approval progress */}
        {workflow.current_state === 'awaiting_senior_approval' &&
          workflow.senior_approvals_required > 1 && (
            <Alert
              message={`Требуется ${workflow.senior_approvals_required} утверждений`}
              description={
                <Progress
                  percent={
                    (workflow.senior_approvals_received / workflow.senior_approvals_required) * 100
                  }
                  format={() =>
                    `${workflow.senior_approvals_received} из ${workflow.senior_approvals_required}`
                  }
                />
              }
              type="info"
              showIcon
            />
          )}
      </Space>
    </Card>
  );
}
```

**Step 2: Add to barrel export**

Modify: `frontend/src/components/workflow/index.ts`

```typescript
export { default as WorkflowStateBadge } from './WorkflowStateBadge';
export { default as WorkflowStatusCard } from './WorkflowStatusCard';
```

**Step 3: Test in browser**

Add to quote detail page temporarily and verify rendering.

**Step 4: Commit**

```bash
git add frontend/src/components/workflow/
git commit -m "feat(workflow): add WorkflowStatusCard component"
```

---

## Phase 4: Integration (2 hours, 8 tasks)

### Task 4.1: Add workflow section to quote detail page

**Files:**
- Modify: `frontend/src/app/quotes/[id]/page.tsx`

**Step 1: Import workflow components and service**

Add imports at top:

```typescript
import { WorkflowStatusCard, WorkflowStateBadge } from '@/components/workflow';
import { getWorkflowStatus, type WorkflowStatus } from '@/lib/api/workflow-service';
```

**Step 2: Add workflow state**

Add after existing state declarations:

```typescript
const [workflow, setWorkflow] = useState<WorkflowStatus | null>(null);
const [workflowLoading, setWorkflowLoading] = useState(true);
```

**Step 3: Fetch workflow status**

Add useEffect:

```typescript
useEffect(() => {
  if (quote?.id) {
    loadWorkflowStatus();
  }
}, [quote?.id]);

async function loadWorkflowStatus() {
  try {
    setWorkflowLoading(true);
    const status = await getWorkflowStatus(quote.id);
    setWorkflow(status);
  } catch (error) {
    console.error('Failed to load workflow:', error);
  } finally {
    setWorkflowLoading(false);
  }
}
```

**Step 4: Add workflow card to layout**

Add after quote header, before quote details:

```tsx
{/* Workflow Section */}
{!workflowLoading && workflow && (
  <Row gutter={[16, 16]}>
    <Col span={24}>
      <WorkflowStatusCard
        workflow={workflow}
        workflowMode={workflowSettings?.workflow_mode || 'simple'}
      />
    </Col>
  </Row>
)}
```

**Step 5: Test in browser**

Navigate to `/quotes/[id]` and verify workflow card shows.

**Step 6: Commit**

```bash
git add frontend/src/app/quotes/[id]/page.tsx
git commit -m "feat(workflow): integrate workflow status into quote detail page"
```

---

## Phase 5: Testing (1-2 hours, 6 tasks)

### Task 5.1: E2E test - Multi-role workflow

**Files:**
- Create: `backend/tests/e2e/test_workflow_multiole.py`

**Step 1: Write E2E test**

```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_complete_multi_role_workflow():
    """Test full 6-step workflow from draft to approved"""

    # Step 1: Sales manager submits to procurement
    response = client.post(
        f"/api/quotes/{quote_id}/transition",
        headers=sales_manager_headers,
        json={"action": "submit_procurement", "comments": "Готово"}
    )
    assert response.status_code == 200
    assert response.json()["new_state"] == "awaiting_procurement"

    # Step 2: Procurement manager adds prices
    # ... (add products prices here)
    response = client.post(
        f"/api/quotes/{quote_id}/transition",
        headers=procurement_headers,
        json={"action": "submit_procurement"}
    )
    assert response.status_code == 200
    assert response.json()["new_state"] == "awaiting_logistics_customs"

    # Step 3a: Logistics manager completes their part
    response = client.post(
        f"/api/quotes/{quote_id}/transition",
        headers=logistics_headers,
        json={"action": "complete_logistics"}
    )
    assert response.status_code == 200

    # Step 3b: Customs manager completes (triggers auto-transition)
    response = client.post(
        f"/api/quotes/{quote_id}/transition",
        headers=customs_headers,
        json={"action": "complete_customs"}
    )
    assert response.status_code == 200
    assert response.json()["new_state"] == "awaiting_sales_review"

    # Step 4: Sales manager adds markup
    response = client.post(
        f"/api/quotes/{quote_id}/transition",
        headers=sales_manager_headers,
        json={"action": "submit_approval"}
    )
    assert response.status_code == 200
    assert response.json()["new_state"] == "awaiting_financial_approval"

    # Step 5: Financial manager approves
    response = client.post(
        f"/api/quotes/{quote_id}/transition",
        headers=financial_headers,
        json={"action": "approve"}
    )
    assert response.status_code == 200
    # Should go to approved (if <$100k) or awaiting_senior (if >$100k)

    # Verify final state
    workflow = client.get(f"/api/quotes/{quote_id}/workflow", headers=sales_manager_headers)
    assert workflow.json()["current_state"] in ["approved", "awaiting_senior_approval"]
```

**Step 2: Run test**

```bash
pytest tests/e2e/test_workflow_multirole.py -v
```

Expected: PASS (if all endpoints implemented)

**Step 3: Commit**

```bash
git add backend/tests/e2e/test_workflow_multirole.py
git commit -m "test(workflow): add E2E test for multi-role workflow"
```

---

## Verification Checklist

After completing all tasks:

- [ ] All backend tests pass (`cd backend && pytest -v`)
- [ ] All frontend builds (`cd frontend && npm run build`)
- [ ] Migration applied successfully in Supabase
- [ ] RLS policies tested with 2+ organizations
- [ ] Can transition through all 6 workflow steps
- [ ] Parallel tasks (logistics + customs) work correctly
- [ ] Multi-senior approval counts correctly
- [ ] Send back functionality works
- [ ] Simple mode works (backward compatible)
- [ ] My tasks page shows role-based filtering
- [ ] Workflow history displays all transitions
- [ ] Performance: Transitions complete <100ms

---

## Implementation Notes

**TDD Throughout:**
- Write failing test first
- Implement minimal code to pass
- Refactor if needed
- Commit after each passing test

**Commit Frequently:**
- After each completed task (every 2-5 minutes)
- Clear, descriptive commit messages
- Reference task number in commits

**Testing Priority:**
- Unit tests for validation logic (critical)
- Integration tests for API endpoints
- E2E tests for complete workflows
- RLS testing for security

**Performance Targets:**
- Workflow status query: <50ms
- Transition action: <100ms
- My tasks query: <200ms

---

**Plan Created:** 2025-11-08
**Estimated Total Time:** 12-15 hours
**Phases:** 5 (Database, Backend, Frontend, Integration, Testing)
**Total Tasks:** 51 bite-sized steps
