ALTER TABLE subject_classes
  DROP CONSTRAINT IF EXISTS subject_classes_pass_mark_non_negative,
  DROP CONSTRAINT IF EXISTS subject_classes_full_mark_positive,
  DROP CONSTRAINT IF EXISTS subject_classes_pass_mark_within_full_mark;

ALTER TABLE subject_classes
  DROP COLUMN IF EXISTS pass_mark,
  DROP COLUMN IF EXISTS full_mark_obtainable;