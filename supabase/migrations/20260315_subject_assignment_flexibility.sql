ALTER TABLE subjects
  ALTER COLUMN education_level_id DROP NOT NULL;

ALTER TABLE subject_classes
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES school_departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS religion_id uuid REFERENCES school_religions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_optional boolean DEFAULT false,
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

CREATE INDEX IF NOT EXISTS idx_subject_classes_department ON subject_classes(department_id);
CREATE INDEX IF NOT EXISTS idx_subject_classes_religion ON subject_classes(religion_id);
CREATE INDEX IF NOT EXISTS idx_subject_classes_is_optional ON subject_classes(is_optional);