-- ============================================================================
-- PLANS MIGRATION
-- ============================================================================
-- Adds a 3-tier plan system to the School Hub platform.
--
-- Tiers:
--   basic    → Core school operations (students, teachers, classes, timetable,
--               attendance, results, school config, periods, promotions, history)
--   pro      → Everything in basic + finance, payroll, notifications, calendar,
--               families, assignments, subject analytics, parents/guardians, ID cards
--   premium  → Everything in pro + AI assistant, website builder, JAMB CBT,
--               question bank, live classes, lesson notes, admissions, alumni,
--               audit trail
-- ============================================================================

-- Add plan column to schools table
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'basic'
  CHECK (plan IN ('basic', 'pro', 'premium'));

-- Update the existing trigger to set updated_at on plan changes
-- (the trigger already exists, no action needed)

-- ============================================================================
-- HELPER: Get the plan for a school
-- ============================================================================
CREATE OR REPLACE FUNCTION get_school_plan(p_school_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT plan FROM schools WHERE id = p_school_id;
$$;

-- ============================================================================
-- HELPER: Check if a school has access to a feature
-- Feature keys: finance, payroll, notifications, calendar, families,
--               assignments, subject_analytics, parents_guardians,
--               student_id_cards, teacher_id_cards,
--               ai_assistant, website_builder, jamb_cbt, question_bank,
--               live_classes, lesson_notes, admissions, alumni, audit_trail
-- ============================================================================
-- Since plan checks are simpler in SQL (just compare the plan value),
-- we handle feature-to-plan mapping in application code.
-- This function is for convenience when you need to check a school's plan in SQL.

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION get_school_plan TO authenticated;

-- ============================================================================
-- COMPLETION
-- ============================================================================
-- ✅ plan column added to schools table
-- ✅ Default value is 'basic' for backward compatibility
-- ✅ Check constraint ensures only valid plan values
-- ✅ get_school_plan() helper function created
--
-- NEXT STEPS:
-- 1. Update existing schools to appropriate plans
--    UPDATE schools SET plan = 'pro' WHERE ...;
-- 2. The application code in lib/plan-features.ts handles feature checks
-- 3. Super admin UI to change school plans
