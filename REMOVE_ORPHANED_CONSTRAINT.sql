-- ============================================================================
-- REMOVE ORPHANED CONSTRAINT
-- ============================================================================

-- Find and drop the old constraint with the wrong name
ALTER TABLE IF EXISTS period_slots 
DROP CONSTRAINT IF EXISTS "period_slots_period_number_check";

-- Verify all constraints are clean now
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'period_slots'
ORDER BY constraint_name;
