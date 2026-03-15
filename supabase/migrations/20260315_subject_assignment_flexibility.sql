ALTER TABLE subjects
  ALTER COLUMN education_level_id DROP NOT NULL;

ALTER TABLE subject_classes
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES school_departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS religion_id uuid REFERENCES school_religions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_optional boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS full_mark_obtainable integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS pass_mark integer DEFAULT 40,
  ADD COLUMN IF NOT EXISTS prerequisite_subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prerequisite_min_score numeric,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

UPDATE subject_classes sc
SET
  department_id = s.department_id,
  religion_id = s.religion_id,
  is_optional = COALESCE(s.is_optional, false)
FROM subjects s
WHERE sc.subject_id = s.id
  AND (
    sc.department_id IS DISTINCT FROM s.department_id
    OR sc.religion_id IS DISTINCT FROM s.religion_id
    OR sc.is_optional IS DISTINCT FROM COALESCE(s.is_optional, false)
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subject_classes_pass_mark_non_negative'
  ) THEN
    ALTER TABLE subject_classes
      ADD CONSTRAINT subject_classes_pass_mark_non_negative CHECK (pass_mark >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subject_classes_full_mark_positive'
  ) THEN
    ALTER TABLE subject_classes
      ADD CONSTRAINT subject_classes_full_mark_positive CHECK (full_mark_obtainable > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subject_classes_pass_mark_within_full_mark'
  ) THEN
    ALTER TABLE subject_classes
      ADD CONSTRAINT subject_classes_pass_mark_within_full_mark CHECK (pass_mark <= full_mark_obtainable);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subject_classes_prerequisite_min_score_non_negative'
  ) THEN
    ALTER TABLE subject_classes
      ADD CONSTRAINT subject_classes_prerequisite_min_score_non_negative CHECK (
        prerequisite_min_score IS NULL OR prerequisite_min_score >= 0
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subject_classes_department ON subject_classes(department_id);
CREATE INDEX IF NOT EXISTS idx_subject_classes_religion ON subject_classes(religion_id);
CREATE INDEX IF NOT EXISTS idx_subject_classes_is_optional ON subject_classes(is_optional);
CREATE INDEX IF NOT EXISTS idx_subject_classes_prerequisite_subject ON subject_classes(prerequisite_subject_id);