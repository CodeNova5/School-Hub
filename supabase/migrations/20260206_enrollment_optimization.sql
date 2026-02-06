-- ============================================================================
-- ENROLLMENT SYSTEM - PHASE 4: CLEANUP & OPTIMIZATION
-- ============================================================================
-- Purpose: Add performance indexes, materialized views, and cleanup redundant columns
-- Created: February 6, 2026
-- Dependencies: 20260206_create_enrollments_system.sql
-- ============================================================================

-- ============================================================================
-- PART 1: ADD PERFORMANCE INDEXES
-- ============================================================================

-- Index for finding active enrollments by student
CREATE INDEX IF NOT EXISTS idx_enrollments_student_active 
ON enrollments(student_id, status) 
WHERE status = 'active';

-- Index for current session/term queries (most common)
CREATE INDEX IF NOT EXISTS idx_enrollments_session_term_status 
ON enrollments(session_id, term_id, status);

-- Index for class rosters (get all students in a class)
CREATE INDEX IF NOT EXISTS idx_enrollments_class_session_term 
ON enrollments(class_id, session_id, term_id, status);

-- Index for enrollment history queries
CREATE INDEX IF NOT EXISTS idx_enrollments_student_created 
ON enrollments(student_id, created_at DESC);

-- Index for enrollment type analytics
CREATE INDEX IF NOT EXISTS idx_enrollments_type_status 
ON enrollments(enrollment_type, status);

-- Index for tracking enrollment chains (promotions/transfers)
CREATE INDEX IF NOT EXISTS idx_enrollments_previous 
ON enrollments(previous_enrollment_id) 
WHERE previous_enrollment_id IS NOT NULL;

-- Composite index for common join patterns
CREATE INDEX IF NOT EXISTS idx_enrollments_student_class_session 
ON enrollments(student_id, class_id, session_id, term_id);

COMMENT ON INDEX idx_enrollments_student_active IS 'Fast lookup of active enrollments for a student';
COMMENT ON INDEX idx_enrollments_session_term_status IS 'Optimizes current session/term queries';
COMMENT ON INDEX idx_enrollments_class_session_term IS 'Optimizes class roster queries';
COMMENT ON INDEX idx_enrollments_student_created IS 'Speeds up enrollment history retrieval';

-- ============================================================================
-- PART 2: CREATE MATERIALIZED VIEW FOR CURRENT ENROLLMENTS
-- ============================================================================

-- Drop existing view and recreate as materialized
DROP VIEW IF EXISTS current_enrollments CASCADE;

-- Materialized view for currently active enrollments (refreshed periodically)
CREATE MATERIALIZED VIEW current_enrollments AS
SELECT 
  e.id as enrollment_id,
  e.student_id,
  s.student_id as student_number,
  s.first_name,
  s.last_name,
  s.email,
  s.phone,
  s.gender,
  s.date_of_birth,
  s.parent_name,
  s.parent_email,
  s.parent_phone,
  s.status as student_status,
  s.religion,
  s.department,
  s.address,
  s.admission_date,
  e.class_id,
  c.name as class_name,
  c.level as class_level,
  c.education_level,
  c.stream,
  e.session_id,
  sess.name as session_name,
  sess.is_current as is_current_session,
  e.term_id,
  t.name as term_name,
  t.is_current as is_current_term,
  e.status as enrollment_status,
  e.enrollment_type,
  e.enrolled_at,
  e.created_at,
  e.updated_at
FROM enrollments e
JOIN students s ON e.student_id = s.id
JOIN classes c ON e.class_id = c.id
JOIN sessions sess ON e.session_id = sess.id
JOIN terms t ON e.term_id = t.id
WHERE e.status = 'active';

-- Create indexes on materialized view for fast queries
CREATE INDEX idx_current_enrollments_student ON current_enrollments(student_id);
CREATE INDEX idx_current_enrollments_class ON current_enrollments(class_id);
CREATE INDEX idx_current_enrollments_session_term ON current_enrollments(session_id, term_id);
CREATE INDEX idx_current_enrollments_is_current ON current_enrollments(is_current_session, is_current_term);

COMMENT ON MATERIALIZED VIEW current_enrollments IS 'Pre-computed active enrollments with student/class details for fast queries';

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_current_enrollments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY current_enrollments;
END;
$$;

COMMENT ON FUNCTION refresh_current_enrollments IS 'Refreshes the current_enrollments materialized view';

-- ============================================================================
-- PART 3: MATERIALIZED VIEW FOR ENROLLMENT ANALYTICS
-- ============================================================================

CREATE MATERIALIZED VIEW enrollment_analytics AS
SELECT
  e.session_id,
  sess.name as session_name,
  e.term_id,
  t.name as term_name,
  e.class_id,
  c.name as class_name,
  c.level as class_level,
  c.education_level,
  e.status,
  e.enrollment_type,
  COUNT(*) as enrollment_count,
  COUNT(DISTINCT e.student_id) as unique_students,
  MIN(e.enrolled_at) as first_enrollment,
  MAX(e.enrolled_at) as last_enrollment
FROM enrollments e
JOIN classes c ON e.class_id = c.id
JOIN sessions sess ON e.session_id = sess.id
JOIN terms t ON e.term_id = t.id
GROUP BY 
  e.session_id, sess.name,
  e.term_id, t.name,
  e.class_id, c.name, c.level, c.education_level,
  e.status, e.enrollment_type;

CREATE INDEX idx_enrollment_analytics_session_term ON enrollment_analytics(session_id, term_id);
CREATE INDEX idx_enrollment_analytics_class ON enrollment_analytics(class_id);
CREATE INDEX idx_enrollment_analytics_status ON enrollment_analytics(status);

COMMENT ON MATERIALIZED VIEW enrollment_analytics IS 'Pre-aggregated enrollment statistics for dashboards';

-- Function to refresh analytics
CREATE OR REPLACE FUNCTION refresh_enrollment_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY enrollment_analytics;
END;
$$;

-- ============================================================================
-- PART 4: REMOVE REDUNDANT attendance.class_id COLUMN
-- ============================================================================

-- Step 1: Verify all attendance records have enrollment_id
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM attendance
  WHERE enrollment_id IS NULL AND class_id IS NOT NULL;
  
  IF missing_count > 0 THEN
    RAISE WARNING 'Found % attendance records without enrollment_id. Attempting to backfill...', missing_count;
    
    -- Backfill enrollment_id from class_id, student_id, and date
    UPDATE attendance a
    SET enrollment_id = e.id
    FROM enrollments e
    JOIN terms t ON e.term_id = t.id
    WHERE a.enrollment_id IS NULL
      AND a.class_id IS NOT NULL
      AND a.student_id = e.student_id
      AND a.class_id = e.class_id
      AND a.date BETWEEN t.start_date AND t.end_date
      AND e.status = 'active';
    
    -- Check if backfill was successful
    SELECT COUNT(*) INTO missing_count
    FROM attendance
    WHERE enrollment_id IS NULL AND class_id IS NOT NULL;
    
    IF missing_count > 0 THEN
      RAISE EXCEPTION 'Cannot remove class_id: % attendance records still missing enrollment_id', missing_count;
    ELSE
      RAISE NOTICE 'Successfully backfilled all enrollment_id values';
    END IF;
  ELSE
    RAISE NOTICE 'All attendance records have enrollment_id - safe to drop class_id column';
  END IF;
END $$;

-- Step 2: Drop the redundant class_id column
ALTER TABLE attendance DROP COLUMN IF EXISTS class_id;

COMMENT ON TABLE attendance IS 'Student attendance tracking (linked to enrollments for historical accuracy)';

-- ============================================================================
-- PART 5: CONVERT students.class_id TO COMPUTED/CACHED FIELD
-- ============================================================================

-- Add a comment explaining the purpose of class_id
COMMENT ON COLUMN students.class_id IS 
'CACHED FIELD: Current active class (auto-synced from enrollments table via trigger). 
Use enrollments table for queries. This field maintained for backward compatibility and quick lookups.';

-- Ensure the sync trigger is active (should already exist from previous migration)
-- This trigger keeps students.class_id in sync with active enrollments

-- Add a constraint to ensure class_id matches active enrollment (optional - can impact performance)
-- Uncomment if you want strict enforcement:
/*
CREATE OR REPLACE FUNCTION check_student_class_id_matches_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  active_class_id UUID;
BEGIN
  -- Get student's current active class from enrollments
  SELECT e.class_id INTO active_class_id
  FROM enrollments e
  JOIN sessions s ON e.session_id = s.id
  JOIN terms t ON e.term_id = t.id
  WHERE e.student_id = NEW.id
    AND e.status = 'active'
    AND s.is_current = true
    AND t.is_current = true
  LIMIT 1;
  
  -- If there's a mismatch, auto-correct it
  IF NEW.class_id IS DISTINCT FROM active_class_id THEN
    RAISE NOTICE 'Auto-correcting class_id for student % from % to %', NEW.id, NEW.class_id, active_class_id;
    NEW.class_id := active_class_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_student_class_id_consistency ON students;
CREATE TRIGGER enforce_student_class_id_consistency
  BEFORE INSERT OR UPDATE OF class_id ON students
  FOR EACH ROW
  EXECUTE FUNCTION check_student_class_id_matches_enrollment();
*/

-- ============================================================================
-- PART 6: UPDATE RLS POLICIES TO USE ENROLLMENTS
-- ============================================================================

-- Grant access to materialized views
GRANT SELECT ON current_enrollments TO authenticated;
GRANT SELECT ON enrollment_analytics TO authenticated;

-- ============================================================================
-- PART 7: HELPER FUNCTION TO GET STUDENT COUNT BY CLASS
-- ============================================================================

-- Optimized function to get current student count for a class
CREATE OR REPLACE FUNCTION get_class_student_count(
  p_class_id UUID,
  p_session_id UUID DEFAULT NULL,
  p_term_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_session_id UUID;
  v_term_id UUID;
  v_count INTEGER;
BEGIN
  -- Use provided session/term or get current ones
  IF p_session_id IS NULL THEN
    SELECT id INTO v_session_id FROM sessions WHERE is_current = true LIMIT 1;
  ELSE
    v_session_id := p_session_id;
  END IF;
  
  IF p_term_id IS NULL THEN
    SELECT id INTO v_term_id FROM terms WHERE is_current = true LIMIT 1;
  ELSE
    v_term_id := p_term_id;
  END IF;
  
  -- Count active enrollments
  SELECT COUNT(*)
  INTO v_count
  FROM enrollments
  WHERE class_id = p_class_id
    AND session_id = v_session_id
    AND term_id = v_term_id
    AND status = 'active';
  
  RETURN COALESCE(v_count, 0);
END;
$$;

COMMENT ON FUNCTION get_class_student_count IS 'Get current student count for a class (enrollment-based)';

-- ============================================================================
-- PART 8: HELPER FUNCTION TO GET AVAILABLE/UNASSIGNED STUDENTS
-- ============================================================================

-- Function to get students without active enrollment
CREATE OR REPLACE FUNCTION get_unassigned_students(
  p_session_id UUID DEFAULT NULL,
  p_term_id UUID DEFAULT NULL
)
RETURNS TABLE (
  student_id UUID,
  student_number VARCHAR,
  first_name VARCHAR,
  last_name VARCHAR,
  email VARCHAR,
  department VARCHAR,
  religion VARCHAR,
  status VARCHAR
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_session_id UUID;
  v_term_id UUID;
BEGIN
  -- Use provided session/term or get current ones
  IF p_session_id IS NULL THEN
    SELECT id INTO v_session_id FROM sessions WHERE is_current = true LIMIT 1;
  ELSE
    v_session_id := p_session_id;
  END IF;
  
  IF p_term_id IS NULL THEN
    SELECT id INTO v_term_id FROM terms WHERE is_current = true LIMIT 1;
  ELSE
    v_term_id := p_term_id;
  END IF;
  
  -- Return students without active enrollment in current session/term
  RETURN QUERY
  SELECT 
    s.id,
    s.student_id,
    s.first_name,
    s.last_name,
    s.email,
    s.department,
    s.religion,
    s.status
  FROM students s
  WHERE s.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.student_id = s.id
        AND e.session_id = v_session_id
        AND e.term_id = v_term_id
        AND e.status = 'active'
    )
  ORDER BY s.first_name, s.last_name;
END;
$$;

COMMENT ON FUNCTION get_unassigned_students IS 'Get students without active enrollment (enrollment-based)';

-- ============================================================================
-- PART 9: SCHEDULED REFRESH FOR MATERIALIZED VIEWS
-- ============================================================================

-- Note: Set up a cron job or scheduled function to refresh materialized views:
-- Example using pg_cron (if available):
/*
SELECT cron.schedule(
  'refresh-enrollments-hourly',
  '0 * * * *',  -- Every hour
  $$SELECT refresh_current_enrollments();$$
);

SELECT cron.schedule(
  'refresh-analytics-daily',
  '0 2 * * *',  -- Daily at 2 AM
  $$SELECT refresh_enrollment_analytics();$$
);
*/

-- Alternative: Create a trigger to auto-refresh on enrollment changes
-- (Warning: May impact performance on high-frequency updates)
CREATE OR REPLACE FUNCTION auto_refresh_enrollment_views()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Refresh materialized views when enrollments change
  -- Use CONCURRENTLY to avoid locking
  PERFORM refresh_current_enrollments();
  
  -- Optionally refresh analytics less frequently
  -- PERFORM refresh_enrollment_analytics();
  
  RETURN NULL;
END;
$$;

-- Uncomment to enable auto-refresh (may impact performance):
/*
DROP TRIGGER IF EXISTS trigger_auto_refresh_enrollment_views ON enrollments;
CREATE TRIGGER trigger_auto_refresh_enrollment_views
  AFTER INSERT OR UPDATE OR DELETE ON enrollments
  FOR EACH STATEMENT
  EXECUTE FUNCTION auto_refresh_enrollment_views();
*/

-- ============================================================================
-- PART 10: MIGRATION VERIFICATION
-- ============================================================================

-- Verification queries to run after migration
DO $$
DECLARE
  enrollment_count INTEGER;
  active_enrollment_count INTEGER;
  materialized_view_count INTEGER;
  index_count INTEGER;
BEGIN
  -- Count total enrollments
  SELECT COUNT(*) INTO enrollment_count FROM enrollments;
  
  -- Count active enrollments
  SELECT COUNT(*) INTO active_enrollment_count FROM enrollments WHERE status = 'active';
  
  -- Count records in materialized view
  SELECT COUNT(*) INTO materialized_view_count FROM current_enrollments;
  
  -- Count indexes on enrollments table
  SELECT COUNT(*) INTO index_count 
  FROM pg_indexes 
  WHERE tablename = 'enrollments' AND schemaname = 'public';
  
  RAISE NOTICE '=== MIGRATION VERIFICATION ===';
  RAISE NOTICE 'Total enrollments: %', enrollment_count;
  RAISE NOTICE 'Active enrollments: %', active_enrollment_count;
  RAISE NOTICE 'Materialized view records: %', materialized_view_count;
  RAISE NOTICE 'Indexes on enrollments table: %', index_count;
  RAISE NOTICE 'Expected at least 7 indexes';
  
  IF index_count < 7 THEN
    RAISE WARNING 'Some indexes may not have been created';
  END IF;
  
  RAISE NOTICE '=== MIGRATION COMPLETE ===';
END $$;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (IF NEEDED)
-- ============================================================================

/*
-- To rollback this migration:

-- 1. Restore attendance.class_id column
ALTER TABLE attendance ADD COLUMN class_id UUID REFERENCES classes(id);
UPDATE attendance a SET class_id = e.class_id 
FROM enrollments e WHERE a.enrollment_id = e.id;

-- 2. Drop materialized views
DROP MATERIALIZED VIEW IF EXISTS current_enrollments CASCADE;
DROP MATERIALIZED VIEW IF EXISTS enrollment_analytics CASCADE;

-- 3. Recreate current_enrollments as regular view
CREATE VIEW current_enrollments AS
SELECT ... (use original view definition from previous migration)

-- 4. Drop indexes (optional - they don't hurt)
-- DROP INDEX IF EXISTS idx_enrollments_student_active;
-- ... etc

-- 5. Drop helper functions
DROP FUNCTION IF EXISTS get_class_student_count;
DROP FUNCTION IF EXISTS get_unassigned_students;
DROP FUNCTION IF EXISTS refresh_current_enrollments;
DROP FUNCTION IF EXISTS refresh_enrollment_analytics;
*/

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
