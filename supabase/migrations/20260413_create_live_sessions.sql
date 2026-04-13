-- Live class sessions for external Zoom deep-link integration (no SDK)
CREATE TABLE IF NOT EXISTS live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Live Class',
  zoom_join_url_original text NOT NULL,
  meeting_id text NOT NULL,
  meeting_password_encrypted text,
  scheduled_for timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_school ON live_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_class ON live_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_teacher ON live_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_school_status ON live_sessions(school_id, status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_school_scheduled_for ON live_sessions(school_id, scheduled_for);

ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users can read live sessions" ON live_sessions;
DROP POLICY IF EXISTS "Admins can manage live sessions" ON live_sessions;
DROP POLICY IF EXISTS "Teachers can manage own class live sessions" ON live_sessions;
DROP POLICY IF EXISTS "Students can read own class live sessions" ON live_sessions;

CREATE POLICY "Admins can manage live sessions"
  ON live_sessions FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

CREATE POLICY "Teachers can manage own class live sessions"
  ON live_sessions FOR ALL
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND EXISTS (
      SELECT 1
      FROM teachers t
      JOIN classes c ON c.class_teacher_id = t.id
      WHERE t.user_id = auth.uid()
        AND t.school_id = live_sessions.school_id
        AND c.id = live_sessions.class_id
        AND c.school_id = live_sessions.school_id
    )
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND EXISTS (
      SELECT 1
      FROM teachers t
      JOIN classes c ON c.class_teacher_id = t.id
      WHERE t.user_id = auth.uid()
        AND t.school_id = live_sessions.school_id
        AND c.id = live_sessions.class_id
        AND c.school_id = live_sessions.school_id
        AND t.id = live_sessions.teacher_id
    )
  );

CREATE POLICY "Students can read own class live sessions"
  ON live_sessions FOR SELECT
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND EXISTS (
      SELECT 1
      FROM students s
      WHERE s.user_id = auth.uid()
        AND s.school_id = live_sessions.school_id
        AND s.class_id = live_sessions.class_id
    )
  );
