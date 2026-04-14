-- Upgrade live sessions to subject-class binding for timetable-aware live classes
ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS subject_class_id uuid REFERENCES subject_classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_live_sessions_subject_class ON live_sessions(subject_class_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_school_subject_status ON live_sessions(school_id, subject_class_id, status);

DROP POLICY IF EXISTS "Admins can manage live sessions" ON live_sessions;
DROP POLICY IF EXISTS "Teachers can manage own class live sessions" ON live_sessions;
DROP POLICY IF EXISTS "Students can read own class live sessions" ON live_sessions;

CREATE POLICY "Admins can manage live sessions"
  ON live_sessions FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

CREATE POLICY "Teachers can manage own subject live sessions"
  ON live_sessions FOR ALL
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND EXISTS (
      SELECT 1
      FROM teachers t
      WHERE t.user_id = auth.uid()
        AND t.school_id = live_sessions.school_id
        AND (
          t.id = live_sessions.teacher_id
          OR EXISTS (
            SELECT 1
            FROM subject_classes sc
            WHERE sc.id = live_sessions.subject_class_id
              AND sc.school_id = live_sessions.school_id
              AND sc.teacher_id = t.id
          )
          OR EXISTS (
            SELECT 1
            FROM classes c
            WHERE c.id = live_sessions.class_id
              AND c.school_id = live_sessions.school_id
              AND c.class_teacher_id = t.id
          )
        )
    )
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND EXISTS (
      SELECT 1
      FROM teachers t
      WHERE t.user_id = auth.uid()
        AND t.school_id = live_sessions.school_id
        AND t.id = live_sessions.teacher_id
        AND (
          EXISTS (
            SELECT 1
            FROM subject_classes sc
            WHERE sc.id = live_sessions.subject_class_id
              AND sc.school_id = live_sessions.school_id
              AND (
                sc.teacher_id = t.id
                OR EXISTS (
                  SELECT 1
                  FROM classes c
                  WHERE c.id = sc.class_id
                    AND c.school_id = live_sessions.school_id
                    AND c.class_teacher_id = t.id
                )
              )
          )
          OR EXISTS (
            SELECT 1
            FROM classes c
            WHERE c.id = live_sessions.class_id
              AND c.school_id = live_sessions.school_id
              AND c.class_teacher_id = t.id
          )
        )
    )
  );

CREATE POLICY "Students can read own subject live sessions"
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
        AND (
          live_sessions.subject_class_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM student_subjects ss
            WHERE ss.student_id = s.id
              AND ss.subject_class_id = live_sessions.subject_class_id
          )
        )
    )
  );
