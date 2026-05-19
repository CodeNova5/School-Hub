-- Allow students to keep multiple completed attempts for the same subject/year.
-- The old table constraint blocked updates from active -> submitted once a prior
-- submitted row already existed for the same student/subject/year.

ALTER TABLE jamb_exam_sessions
  DROP CONSTRAINT IF EXISTS jamb_exam_sessions_student_id_school_id_subject_slug_exam_year_status_key;

DROP INDEX IF EXISTS idx_jamb_sessions_unique_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_jamb_sessions_unique_active
  ON jamb_exam_sessions(student_id, school_id, subject_slug, exam_year)
  WHERE status = 'active';