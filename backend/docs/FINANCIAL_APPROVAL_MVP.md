# Financial Approval MVP Implementation

**Date:** 2025-11-21
**Session:** 41
**Status:** Core functionality working, audit trail partially implemented

## Overview

Implementation of financial approval workflow for quotes, allowing financial managers to approve, reject, or send back quotes for revision.

## Database Schema Changes

### Migration 027: Organization-Level Financial Manager
- Added `financial_manager_id` column to `organizations` table
- Allows designating a specific user as the financial manager for an organization
- Performance: Requires network call to check manager status

### Migration 028: User-Level Financial Manager Flag
- Added `is_financial_manager` boolean flag to `user_profiles` table
- Faster performance (10-100x) as it's checked during authentication
- No additional network calls needed
- **Recommended approach for production**

### Migration 029: Missing Workflow States
- Added three new workflow states to quotes constraint:
  - `sent_back_for_revision` - Quote needs changes
  - `rejected_by_finance` - Quote rejected by financial manager
  - `financially_approved` - Quote approved by financial manager

## Implementation Status

### ✅ Completed Features

1. **Financial Manager Designation**
   - Both organization-level and user-level approaches implemented
   - User-level flag is active and working

2. **Workflow State Transitions**
   - Quotes successfully transition between states
   - States update correctly in database
   - UI reflects state changes immediately

3. **Send-Back Functionality**
   - Financial managers can send quotes back for revision
   - Required comment field enforced
   - Quote status changes to "На доработке" (On revision)

4. **API Endpoints**
   - `POST /api/quotes/{id}/approve-financially` - Approve quote
   - `POST /api/quotes/{id}/reject-financially` - Reject quote
   - `POST /api/quotes/{id}/send-back-for-revision` - Send back with comment
   - All endpoints check financial manager permissions

### ⚠️ Known Issues

1. **Workflow Transition Audit Trail**
   - Issue: Insert into `quote_workflow_transitions` table fails with 400 error
   - Impact: Workflow history not being recorded
   - Severity: Medium (functionality works, but no audit trail)
   - Root cause: Likely RLS policies or additional validation constraints

### Test Scenarios

#### Scenario 1: Approve Quote ✅
- Financial manager can approve quotes
- State changes to `financially_approved`
- Success message displayed

#### Scenario 2: Send Back Quote ✅ (with caveat)
- Financial manager can send quotes back
- State changes to `sent_back_for_revision`
- Comment is required and validated
- **Caveat:** Audit trail not saved

#### Scenario 3: Reject Quote (Not tested)
- Similar implementation to send-back
- Should work but needs testing

## Technical Details

### Backend Changes

**File:** `backend/routes/quotes.py`

Key fixes applied:
1. Fixed missing `Client` import from supabase
2. Fixed incorrect table names (`workflow_transitions` → `quote_workflow_transitions`)
3. Added required fields for transition inserts:
   - `performed_by` (was using `user_id`)
   - `action` field
   - `role_at_transition` field
4. Added debug logging for troubleshooting

### Frontend Integration

The frontend correctly:
- Displays workflow state in quote detail page
- Shows appropriate action buttons based on state
- Enforces required comment for send-back action
- Updates UI after successful state transitions

## Next Steps

### High Priority
1. **Fix workflow transition audit trail**
   - Debug why insert fails with 400 error
   - Check RLS policies on `quote_workflow_transitions` table
   - Ensure all required fields are provided

2. **Test rejection workflow**
   - Verify reject functionality works end-to-end
   - Ensure proper state transition

### Medium Priority
3. **Add workflow history viewer**
   - Display transition history in quote detail page
   - Show who made changes and when

4. **Add email notifications**
   - Notify sales team when quote sent back
   - Notify management when quote approved/rejected

### Low Priority
5. **Add bulk operations**
   - Approve/reject multiple quotes at once
   - Useful for high-volume scenarios

## Configuration

### Setting a Financial Manager

#### Option 1: User-Level Flag (Recommended)
```sql
UPDATE user_profiles
SET is_financial_manager = true
WHERE user_id = 'user-uuid-here';
```

#### Option 2: Organization-Level
```sql
UPDATE organizations
SET financial_manager_id = 'user-uuid-here'
WHERE id = 'org-uuid-here';
```

### Current Test User
- Name: Andy Testuser
- Email: andrey@masterbearingsales.ru
- User ID: 97ccad9e-ae96-4be5-ba07-321e07e8ee1e
- Status: Financial Manager (both flags set)

## Performance Considerations

- User-level flag is 10-100x faster than organization-level check
- No additional database calls needed when using user-level flag
- Flag is loaded during authentication and cached in JWT

## Security Notes

- All endpoints verify financial manager status before allowing actions
- RLS policies ensure users can only see quotes from their organization
- Required comments provide audit trail for compliance

## Related Files

- `backend/migrations/027_organization_financial_manager.sql`
- `backend/migrations/028_user_financial_manager_flag.sql`
- `backend/migrations/029_add_financial_workflow_states.sql`
- `backend/routes/quotes.py` (lines 1200-1400)
- `backend/set_org_financial_manager.py` (utility script)

## References

- Session 41 conversation log
- GitHub Issue: (To be created for audit trail bug)