-- Migration: Add Google Calendar Integration to Leads
-- Date: 2025-11-17
-- Description: Add columns for storing Google Calendar event data
--
-- Features:
-- - Store Google Calendar event ID for sync/update/delete
-- - Store Google Meet link for easy access
-- - Enable automatic meeting creation via n8n webhook
-- - Enable manual meeting creation from UI

-- ============================================================================
-- Add Google Calendar Columns to Leads Table
-- ============================================================================

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS google_event_id TEXT,
ADD COLUMN IF NOT EXISTS google_calendar_link TEXT;

-- Add index for looking up leads by Google event ID
-- (useful for syncing updates from Google Calendar back to CRM)
CREATE INDEX IF NOT EXISTS idx_leads_google_event
ON leads(google_event_id)
WHERE google_event_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN leads.google_event_id IS 'Google Calendar event ID for sync/update/delete operations';
COMMENT ON COLUMN leads.google_calendar_link IS 'Google Meet link (meet.google.com/xxx) for easy access';

-- ============================================================================
-- Update RLS Policies (if needed)
-- ============================================================================

-- No RLS policy changes needed - these columns follow same rules as other lead columns
-- Users can only see/update leads in their organization (existing RLS policies apply)

-- ============================================================================
-- Rollback Instructions
-- ============================================================================

-- To rollback this migration:
-- ALTER TABLE leads DROP COLUMN IF EXISTS google_event_id;
-- ALTER TABLE leads DROP COLUMN IF EXISTS google_calendar_link;
-- DROP INDEX IF EXISTS idx_leads_google_event;
