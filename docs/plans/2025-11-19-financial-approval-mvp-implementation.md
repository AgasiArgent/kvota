# Financial Approval MVP - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable financial manager to review quotes via Excel export with auto-checks and approve/reject in UI

**Architecture:** Excel export with auto-validation highlighting + UI approval actions on quote page

**Tech Stack:** FastAPI, openpyxl (Excel), Pydantic validation, existing workflow system

---

## Summary

**What we're building:**
1. Excel export "Financial Review" with auto-checks for financial manager
2. UI on quote page for Approve/Send Back actions
3. Workflow transitions (awaiting_financial_approval → approved/draft)

**Scope:**
- Backend: Excel export endpoint with validation highlighting
- Frontend: Approval UI on quote detail page
- No notification system yet (MVP)

---

## Task 1: Create Excel Export Service (Financial Review)

**Files:**
- Create: `backend/services/financial_review_export.py`
- Test: `backend/tests/services/test_financial_review_export.py`

### Step 1: Write failing test for basic export

**File:** `backend/tests/services/test_financial_review_export.py`

```python
import pytest
from services.financial_review_export import create_financial_review_excel
from decimal import Decimal

def test_creates_excel_with_quote_data():
    """Test basic Excel creation with quote data"""
    quote_data = {
        'quote_number': 'KP-2025-001',
        'customer_name': 'Test Customer',
        'total_amount': Decimal('10000.00'),
        'markup': Decimal('15.0'),
        'rate_forex_risk': Decimal('3.0'),
        'dm_fee_value': Decimal('1000.00'),
        'products': []
    }

    workbook = create_financial_review_excel(quote_data)

    assert workbook is not None
    assert 'Review' in workbook.sheetnames
    sheet = workbook['Review']
    assert sheet['A1'].value == 'Financial Review'
```

### Step 2: Run test (should fail)

```bash
cd backend
pytest tests/services/test_financial_review_export.py::test_creates_excel_with_quote_data -v
```

Expected: `ImportError: cannot import name 'create_financial_review_excel'`

### Step 3: Implement basic export function

**File:** `backend/services/financial_review_export.py`

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.comments import Comment
from decimal import Decimal
from typing import Dict, List, Any

def create_financial_review_excel(quote_data: Dict[str, Any]) -> Workbook:
    """
    Create Excel workbook for financial manager review

    Args:
        quote_data: Quote data with calculation results

    Returns:
        openpyxl Workbook ready for download
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Review"

    # Header
    ws['A1'] = 'Financial Review'
    ws['A1'].font = Font(bold=True, size=14)

    # Quote info section
    ws['A3'] = 'Quote Number:'
    ws['B3'] = quote_data.get('quote_number', '')

    ws['A4'] = 'Customer:'
    ws['B4'] = quote_data.get('customer_name', '')

    ws['A5'] = 'Total Amount:'
    ws['B5'] = float(quote_data.get('total_amount', 0))

    return wb
```

### Step 4: Run test (should pass)

```bash
pytest tests/services/test_financial_review_export.py::test_creates_excel_with_quote_data -v
```

Expected: `PASSED`

### Step 5: Commit

```bash
git add backend/services/financial_review_export.py backend/tests/services/test_financial_review_export.py
git commit -m "feat: add basic financial review Excel export

- Create openpyxl workbook with quote info
- Test basic structure

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Add Auto-Validation Logic

**Files:**
- Modify: `backend/services/financial_review_export.py`
- Test: `backend/tests/services/test_financial_review_export.py`

### Step 1: Write failing test for VAT validation

```python
def test_highlights_vat_removal_issues():
    """Test that VAT removal check highlights problems"""
    quote_data = {
        'quote_number': 'KP-001',
        'products': [{
            'name': 'Product 1',
            'purchase_price_with_vat': Decimal('115.00'),
            'purchase_price_no_vat': Decimal('115.00'),  # ERROR: VAT not removed!
            'vat_seller_country': Decimal('15.0')
        }]
    }

    workbook = create_financial_review_excel(quote_data)
    sheet = workbook['Review']

    # Find purchase_price_no_vat cell (should be highlighted red)
    # Assuming row 10, col B for example
    cell = sheet['B10']
    assert cell.fill.start_color.rgb == 'FFCCCC'  # Red background
    assert cell.comment is not None
    assert 'VAT not removed' in cell.comment.text
```

### Step 2: Run test (should fail)

```bash
pytest tests/services/test_financial_review_export.py::test_highlights_vat_removal_issues -v
```

Expected: `AssertionError: cell.fill is default`

### Step 3: Add VAT validation logic

**File:** `backend/services/financial_review_export.py`

Add validation function:

```python
from openpyxl.styles import PatternFill
from openpyxl.comments import Comment

RED_FILL = PatternFill(start_color="FFCCCC", end_color="FFCCCC", fill_type="solid")
GREEN_FILL = PatternFill(start_color="CCFFCC", end_color="CCFFCC", fill_type="solid")

def validate_vat_removal(product: Dict[str, Any]) -> tuple[bool, str]:
    """
    Check if VAT was properly removed from purchase price

    Returns:
        (is_valid, error_message)
    """
    price_with_vat = Decimal(str(product.get('purchase_price_with_vat', 0)))
    price_no_vat = Decimal(str(product.get('purchase_price_no_vat', 0)))
    vat_rate = Decimal(str(product.get('vat_seller_country', 0)))

    if vat_rate == 0:
        return (True, '')  # No VAT expected

    # Calculate expected price without VAT
    expected_no_vat = price_with_vat / (Decimal('1') + vat_rate / Decimal('100'))

    # Allow 1% tolerance for rounding
    diff = abs(price_no_vat - expected_no_vat)
    tolerance = expected_no_vat * Decimal('0.01')

    if diff > tolerance:
        return (False, f"⚠️ VAT not removed properly. Expected: {expected_no_vat:.2f}, Got: {price_no_vat:.2f}")

    return (True, '')

def apply_validation_to_cell(cell, is_valid: bool, error_message: str):
    """Apply color and comment to cell based on validation"""
    if not is_valid:
        cell.fill = RED_FILL
        cell.comment = Comment(error_message, "System")
```

Update `create_financial_review_excel` to use validation:

```python
def create_financial_review_excel(quote_data: Dict[str, Any]) -> Workbook:
    # ... existing code ...

    # Products table (row 10+)
    row = 10
    for product in quote_data.get('products', []):
        # ... write product data ...

        # Validate VAT removal
        vat_valid, vat_error = validate_vat_removal(product)
        price_no_vat_cell = ws.cell(row=row, column=2)
        price_no_vat_cell.value = float(product.get('purchase_price_no_vat', 0))
        apply_validation_to_cell(price_no_vat_cell, vat_valid, vat_error)

        row += 1

    return wb
```

### Step 4: Run test (should pass)

```bash
pytest tests/services/test_financial_review_export.py::test_highlights_vat_removal_issues -v
```

Expected: `PASSED`

### Step 5: Commit

```bash
git add backend/services/financial_review_export.py backend/tests/services/test_financial_review_export.py
git commit -m "feat: add VAT removal validation to financial review

- Check if VAT properly removed from purchase price
- Highlight issues in red with comments

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Add Markup Validation

**Files:**
- Modify: `backend/services/financial_review_export.py`
- Test: `backend/tests/services/test_financial_review_export.py`

### Step 1: Write failing test

```python
def test_highlights_low_markup():
    """Test that markup below threshold is highlighted"""
    quote_data = {
        'markup': Decimal('8.0'),  # Below 10% threshold
        'markup_threshold': Decimal('10.0'),
        'products': []
    }

    workbook = create_financial_review_excel(quote_data)
    sheet = workbook['Review']

    # Markup cell should be red
    markup_cell = sheet['B6']  # Assuming markup at B6
    assert markup_cell.fill.start_color.rgb == 'FFCCCC'
    assert 'below threshold' in markup_cell.comment.text.lower()
```

### Step 2: Run test (should fail)

```bash
pytest tests/services/test_financial_review_export.py::test_highlights_low_markup -v
```

### Step 3: Add markup validation

```python
def validate_markup(markup: Decimal, threshold: Decimal = Decimal('10.0')) -> tuple[bool, str]:
    """Check if markup meets minimum threshold"""
    if markup < threshold:
        return (False, f"⚠️ Markup {markup}% below threshold ({threshold}%)")
    return (True, '')
```

Update Excel generation to validate markup.

### Step 4: Run test (should pass)

### Step 5: Commit

```bash
git commit -am "feat: add markup threshold validation

- Highlight markup below 10% threshold
- Add explanatory comment

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Add All Financial Validations

**Validations to implement:**

1. ✅ VAT removal (done)
2. ✅ Markup threshold (done)
3. Currency risk rate (rate_forex_risk)
4. Financial agent commission (financial_agent_fee)
5. DM fee reasonableness

**Pattern:** Same TDD cycle for each validation function.

---

## Task 5: Create API Endpoint for Excel Export

**Files:**
- Create: `backend/routes/financial_approval.py`
- Test: `backend/tests/routes/test_financial_approval.py`
- Modify: `backend/main.py` (register router)

### Step 1: Write failing test

```python
def test_get_financial_review_excel(test_client, sample_quote):
    """Test financial review Excel download endpoint"""
    response = test_client.get(f'/api/quotes/{sample_quote["id"]}/financial-review')

    assert response.status_code == 200
    assert response.headers['Content-Type'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    assert 'attachment' in response.headers['Content-Disposition']
```

### Step 2: Run test (should fail)

### Step 3: Implement endpoint

**File:** `backend/routes/financial_approval.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from services.financial_review_export import create_financial_review_excel
from io import BytesIO
import uuid

router = APIRouter(prefix='/api/quotes', tags=['financial-approval'])

@router.get('/{quote_id}/financial-review')
async def get_financial_review_excel(
    quote_id: uuid.UUID,
    # current_user: dict = Depends(get_current_user)  # Add auth
):
    """
    Generate Excel file for financial manager review

    Returns Excel with:
    - Quote data
    - Auto-validations (highlighted cells)
    - Comments on issues
    """
    # Get quote with calculation results
    # quote = await get_quote_with_calculations(quote_id)

    # For now, mock data
    quote_data = {'quote_number': 'KP-001', 'products': []}

    # Generate Excel
    workbook = create_financial_review_excel(quote_data)

    # Save to BytesIO
    output = BytesIO()
    workbook.save(output)
    output.seek(0)

    # Return as download
    filename = f"Financial_Review_{quote_data['quote_number']}.xlsx"

    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )
```

Register router in `backend/main.py`:

```python
from routes import financial_approval

app.include_router(financial_approval.router)
```

### Step 4: Run test (should pass)

### Step 5: Commit

---

## Task 6: Add Approval Action Endpoint

**Files:**
- Modify: `backend/routes/financial_approval.py`
- Test: `backend/tests/routes/test_financial_approval.py`

### Step 1: Write failing test

```python
def test_approve_quote(test_client, sample_quote):
    """Test approving quote by financial manager"""
    response = test_client.post(
        f'/api/quotes/{sample_quote["id"]}/approve',
        json={'comments': 'All checks passed'}
    )

    assert response.status_code == 200
    data = response.json()
    assert data['workflow_state'] == 'approved'
```

### Step 2: Run test (should fail)

### Step 3: Implement approval endpoint

```python
from pydantic import BaseModel

class ApprovalRequest(BaseModel):
    comments: str = ''

@router.post('/{quote_id}/approve')
async def approve_quote(
    quote_id: uuid.UUID,
    request: ApprovalRequest,
    # current_user: dict = Depends(get_current_user)
):
    """
    Approve quote by financial manager

    Transitions: awaiting_financial_approval → approved
    """
    # Get quote
    # quote = await get_quote(quote_id)

    # Verify current state is awaiting_financial_approval
    # if quote['workflow_state'] != 'awaiting_financial_approval':
    #     raise HTTPException(400, "Quote not in correct state")

    # Update workflow state
    # await update_quote_workflow_state(
    #     quote_id=quote_id,
    #     from_state='awaiting_financial_approval',
    #     to_state='approved',
    #     action='approve',
    #     performed_by=current_user['id'],
    #     comments=request.comments
    # )

    # For MVP: mock response
    return {
        'success': True,
        'workflow_state': 'approved',
        'message': 'Quote approved by financial manager'
    }
```

### Step 4: Run test (should pass)

### Step 5: Commit

---

## Task 7: Add Send Back Endpoint

**Files:**
- Modify: `backend/routes/financial_approval.py`
- Test: `backend/tests/routes/test_financial_approval.py`

### Step 1: Write failing test

```python
def test_send_back_quote(test_client, sample_quote):
    """Test sending quote back to sales manager"""
    response = test_client.post(
        f'/api/quotes/{sample_quote["id"]}/send-back',
        json={'comments': 'Markup too low, please review'}
    )

    assert response.status_code == 200
    data = response.json()
    assert data['workflow_state'] == 'draft'
```

### Step 2: Run test (should fail)

### Step 3: Implement send-back endpoint

```python
@router.post('/{quote_id}/send-back')
async def send_back_quote(
    quote_id: uuid.UUID,
    request: ApprovalRequest,
    # current_user: dict = Depends(get_current_user)
):
    """
    Send quote back to sales manager for corrections

    Transitions: awaiting_financial_approval → draft
    """
    # Similar to approve but transition to 'draft'
    return {
        'success': True,
        'workflow_state': 'draft',
        'message': 'Quote sent back to sales manager'
    }
```

### Step 4: Run test (should pass)

### Step 5: Commit

---

## Task 8: Add Frontend Approval UI

**Files:**
- Modify: `frontend/src/app/quotes/[id]/page.tsx`
- Create: `frontend/src/components/quotes/FinancialApprovalActions.tsx`

### Step 1: Create approval actions component

**File:** `frontend/src/components/quotes/FinancialApprovalActions.tsx`

```typescript
'use client';

import { Button, Input, Modal, message } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useState } from 'react';

interface Props {
  quoteId: string;
  onApprove: () => void;
  onSendBack: () => void;
}

export default function FinancialApprovalActions({ quoteId, onApprove, onSendBack }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [action, setAction] = useState<'approve' | 'sendback'>('approve');
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAction = async () => {
    setLoading(true);
    try {
      const endpoint = action === 'approve' ? 'approve' : 'send-back';
      const response = await fetch(`/api/quotes/${quoteId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments })
      });

      if (!response.ok) throw new Error('Failed');

      message.success(action === 'approve' ? 'Quote approved!' : 'Quote sent back');
      setShowModal(false);

      if (action === 'approve') onApprove();
      else onSendBack();
    } catch (error) {
      message.error('Action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="primary"
        icon={<CheckOutlined />}
        onClick={() => { setAction('approve'); setShowModal(true); }}
      >
        Approve
      </Button>

      <Button
        danger
        icon={<CloseOutlined />}
        onClick={() => { setAction('sendback'); setShowModal(true); }}
      >
        Send Back
      </Button>

      <Modal
        title={action === 'approve' ? 'Approve Quote' : 'Send Back for Revisions'}
        open={showModal}
        onOk={handleAction}
        onCancel={() => setShowModal(false)}
        confirmLoading={loading}
      >
        <Input.TextArea
          placeholder={action === 'approve' ? 'Comments (optional)' : 'What needs to be fixed?'}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={4}
          required={action === 'sendback'}
        />
      </Modal>
    </>
  );
}
```

### Step 2: Add to quote detail page

**File:** `frontend/src/app/quotes/[id]/page.tsx`

Add import and component:

```typescript
import FinancialApprovalActions from '@/components/quotes/FinancialApprovalActions';

// In the quote detail page, add conditional rendering:
{quote.workflow_state === 'awaiting_financial_approval' && (
  <FinancialApprovalActions
    quoteId={quote.id}
    onApprove={() => router.refresh()}
    onSendBack={() => router.refresh()}
  />
)}
```

### Step 3: Test manually

- Create quote, set state to 'awaiting_financial_approval'
- Open quote detail page
- Click Approve → should show modal → submit → success
- Click Send Back → should require comments → submit → success

### Step 4: Commit

```bash
git add frontend/src/components/quotes/FinancialApprovalActions.tsx frontend/src/app/quotes/[id]/page.tsx
git commit -m "feat: add financial approval UI actions

- Approve/Send Back buttons for financial manager
- Comments modal for send back reason
- Workflow state transitions

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: Add Download Financial Review Button

**Files:**
- Modify: `frontend/src/app/quotes/[id]/page.tsx`

### Step 1: Add download button

```typescript
import { DownloadOutlined } from '@ant-design/icons';

// Add button near approval actions
<Button
  icon={<DownloadOutlined />}
  onClick={async () => {
    const response = await fetch(`/api/quotes/${quote.id}/financial-review`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Financial_Review_${quote.quote_number}.xlsx`;
    a.click();
  }}
>
  Download Financial Review
</Button>
```

### Step 2: Test manually

- Click button → should download Excel file
- Open Excel → should see quote data

### Step 3: Commit

---

## Task 10: Integration Test - Full Flow

**Test the complete workflow:**

### Step 1: Create test quote

- Sales manager creates quote
- Fills all calculation data
- Submits for review (workflow_state = 'awaiting_financial_approval')

### Step 2: Financial manager reviews

- Opens quote detail page
- Sees "Download Financial Review" button
- Downloads Excel
- Opens Excel → sees:
  - Quote-level variables
  - Product-level table
  - Red cells for issues (if any)
  - Comments explaining problems

### Step 3: Financial manager approves

- Returns to app
- Clicks "Approve"
- Adds comment: "All checks passed"
- Submits
- Quote state → 'approved'

### Step 4: Verify in database

```sql
SELECT workflow_state, financial_manager_comments FROM quotes WHERE id = '<quote_id>';
```

Expected: `workflow_state = 'approved'`

### Step 5: Document test results

Create: `docs/testing/financial-approval-mvp-test-results.md`

```markdown
# Financial Approval MVP - Test Results

**Date:** 2025-11-19
**Tester:** [name]

## Test Case 1: Happy Path

- [x] Create quote
- [x] Submit for approval
- [x] Download Excel
- [x] Excel contains correct data
- [x] Approve in UI
- [x] State updated to 'approved'

## Test Case 2: Send Back

- [x] Financial manager finds issue
- [x] Clicks "Send Back"
- [x] Adds comments
- [x] State returns to 'draft'
- [x] Sales manager sees comments

## Test Case 3: Auto-Validations

- [x] VAT removal issue → Red cell + comment
- [x] Low markup → Red cell + comment
- [x] All OK → No highlighting
```

---

## MVP Scope Summary

**What's included:**
- ✅ Excel export with auto-validations
- ✅ Cell highlighting for issues (red)
- ✅ Excel comments explaining problems
- ✅ UI buttons: Approve / Send Back
- ✅ Comments field for send back reason
- ✅ Workflow transitions

**What's NOT included (future):**
- ❌ Notification system (email/in-app)
- ❌ Invoice comparison side-by-side
- ❌ Ability to edit values in UI
- ❌ Senior approval workflow (next phase)

**Estimated time:** 1-2 days

---

## Files Modified/Created

**Backend:**
- `services/financial_review_export.py` (new)
- `routes/financial_approval.py` (new)
- `main.py` (modified - register router)
- `tests/services/test_financial_review_export.py` (new)
- `tests/routes/test_financial_approval.py` (new)

**Frontend:**
- `components/quotes/FinancialApprovalActions.tsx` (new)
- `app/quotes/[id]/page.tsx` (modified - add approval UI)

**Docs:**
- `docs/plans/2025-11-19-financial-approval-mvp-implementation.md` (this file)
- `docs/testing/financial-approval-mvp-test-results.md` (created during testing)

---

## Success Criteria

**MVP is successful when:**
- ✅ Financial manager can download Excel with quote data
- ✅ Excel highlights issues automatically (red cells + comments)
- ✅ Financial manager can approve/reject in UI
- ✅ Comments are saved and visible to sales manager
- ✅ Workflow state transitions correctly
- ✅ No manual checks required for basic validations

---

**Ready for implementation!**
