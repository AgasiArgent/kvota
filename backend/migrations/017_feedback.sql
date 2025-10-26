-- Migration 017: Feedback System
-- Create feedback table for in-app bug reporting

CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  description TEXT NOT NULL CHECK (LENGTH(description) >= 10),
  browser_info JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_feedback_org_status ON feedback(organization_id, status, created_at DESC);
CREATE INDEX idx_feedback_status ON feedback(status, created_at DESC);
CREATE INDEX idx_feedback_user ON feedback(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read org feedback"
  ON feedback FOR SELECT
  USING (organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid);

CREATE POLICY "Users can insert feedback"
  ON feedback FOR INSERT
  WITH CHECK (
    organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
    AND user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
  );

CREATE POLICY "Admins can update feedback"
  ON feedback FOR UPDATE
  USING (
    organization_id = (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  );

-- Trigger to auto-update updated_at
CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE feedback IS 'User feedback and bug reports';
COMMENT ON COLUMN feedback.page_url IS 'URL where the feedback was submitted';
COMMENT ON COLUMN feedback.description IS 'User description of the issue (min 10 chars)';
COMMENT ON COLUMN feedback.browser_info IS 'Auto-captured browser information (userAgent, screen size, timestamp)';
COMMENT ON COLUMN feedback.status IS 'Feedback status: open or resolved';
