-- Add explicit scheduling window to live sessions
ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS scheduled_end_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_live_sessions_school_window
  ON live_sessions(school_id, scheduled_for, scheduled_end_at, status);
