-- DROP unused fields first if they already exist
ALTER TABLE classes DROP COLUMN IF EXISTS capacity;
ALTER TABLE classes DROP COLUMN IF EXISTS session_id;

-- Add new fields for the new generation system
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS level_of_education text CHECK (
  level_of_education IN (
    'Pre-Primary Education',
    'Primary Education',
    'Junior Secondary Education',
    'Senior Secondary Education'
  )
),
ADD COLUMN IF NOT EXISTS suffix text DEFAULT '';

-- Ensure class name is unique even with suffix
ALTER TABLE classes
ADD CONSTRAINT unique_class_name UNIQUE (name, suffix);

ALTER TABLE class_teachers DROP COLUMN IF EXISTS session_id;

ALTER TABLE class_teachers
ADD CONSTRAINT unique_class_teacher UNIQUE (class_id);
