-- Fix RLS policy for live sessions to show all class sessions to students (both timetable and custom)
-- This allows students to see custom (non-timetable) live classes created by teachers

DROP POLICY IF EXISTS "Students can read own subject live sessions" ON live_sessions;

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
