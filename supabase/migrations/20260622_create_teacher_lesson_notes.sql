-- =============================================================================
-- Teacher Lesson Notes
-- Stores AI-generated lesson notes linked to subjects and topics
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'lesson_note_status'
  ) THEN
    CREATE TYPE lesson_note_status AS ENUM ('draft', 'published', 'archived');
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS teacher_lesson_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_by_teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_class_id uuid NOT NULL REFERENCES subject_classes(id) ON DELETE CASCADE,
  topic text NOT NULL,
  title text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text DEFAULT '',
  status lesson_note_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_lesson_notes_teacher
  ON teacher_lesson_notes (school_id, created_by_teacher_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_teacher_lesson_notes_subject
  ON teacher_lesson_notes (school_id, subject_class_id, created_at DESC);

ALTER TABLE teacher_lesson_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can read own lesson notes" ON teacher_lesson_notes;
CREATE POLICY "Teachers can read own lesson notes"
  ON teacher_lesson_notes FOR SELECT
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND created_by_teacher_id IN (
      SELECT id
      FROM teachers
      WHERE user_id = auth.uid()
        AND school_id = get_my_school_id()
    )
  );

DROP POLICY IF EXISTS "Teachers can manage own lesson notes" ON teacher_lesson_notes;
CREATE POLICY "Teachers can manage own lesson notes"
  ON teacher_lesson_notes FOR ALL
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND created_by_teacher_id IN (
      SELECT id
      FROM teachers
      WHERE user_id = auth.uid()
        AND school_id = get_my_school_id()
    )
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND created_by_teacher_id IN (
      SELECT id
      FROM teachers
      WHERE user_id = auth.uid()
        AND school_id = get_my_school_id()
    )
  );

COMMENT ON TABLE teacher_lesson_notes IS 'AI-generated lesson notes created by teachers per subject-class assignment';

-- updated_at trigger
DROP TRIGGER IF EXISTS set_teacher_lesson_notes_updated_at ON teacher_lesson_notes;
CREATE TRIGGER set_teacher_lesson_notes_updated_at BEFORE UPDATE ON teacher_lesson_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

COMMIT;
