-- ============================================================================
-- ALLOW UNNUMBERED BREAK INTERVALS IN PERIOD_SLOTS
-- Break rows should not have period numbers; class rows must keep 1..20.
-- ============================================================================

-- Remove legacy uniqueness/index constraints that assume every slot has a period number.
ALTER TABLE period_slots DROP CONSTRAINT IF EXISTS unique_day_period;
ALTER TABLE period_slots DROP CONSTRAINT IF EXISTS unique_school_day_period;
DROP INDEX IF EXISTS idx_period_slots_day_period;
DROP INDEX IF EXISTS idx_period_slots_school_day_period;

-- Make period_number nullable for break rows.
ALTER TABLE period_slots ALTER COLUMN period_number DROP NOT NULL;

-- Remove older check constraints before adding the new rule.
ALTER TABLE period_slots DROP CONSTRAINT IF EXISTS period_slots_period_number_check;
ALTER TABLE period_slots DROP CONSTRAINT IF EXISTS period_slots_break_number_rule;

-- Normalize existing data: break rows become unnumbered.
UPDATE period_slots
SET period_number = NULL
WHERE is_break = true;

-- Enforce rule: breaks are unnumbered, classes are numbered 1..20.
ALTER TABLE period_slots
ADD CONSTRAINT period_slots_break_number_rule CHECK (
  (is_break = true AND period_number IS NULL)
  OR (is_break = false AND period_number BETWEEN 1 AND 20)
);

-- Keep class-period uniqueness while allowing multiple breaks per day.
CREATE UNIQUE INDEX IF NOT EXISTS unique_period_slots_class_period_per_day
  ON period_slots(school_id, day_of_week, period_number)
  WHERE is_break = false;

-- Query performance index for schedule rendering by day/time.
CREATE INDEX IF NOT EXISTS idx_period_slots_day_start_time
  ON period_slots(school_id, day_of_week, start_time);
