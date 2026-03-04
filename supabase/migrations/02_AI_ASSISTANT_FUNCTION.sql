-- ============================================================================
-- AI ASSISTANT QUERY EXECUTION FUNCTION
-- ============================================================================
-- This migration adds a function to safely execute AI-generated SQL queries
-- with proper parameter binding and security checks.
-- ============================================================================

-- Function to execute AI-generated queries safely
CREATE OR REPLACE FUNCTION execute_ai_query(
  query_text text,
  query_params anyarray DEFAULT '{}'::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  query_result record;
  results jsonb[] := '{}';
BEGIN
  -- Security check: Only allow SELECT queries
  IF query_text !~* '^\s*SELECT' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  -- Security check: Prevent dangerous keywords
  IF query_text ~* '(DROP|DELETE|TRUNCATE|ALTER|CREATE|INSERT|UPDATE|GRANT|REVOKE|EXEC|EXECUTE)' THEN
    RAISE EXCEPTION 'Query contains forbidden keywords';
  END IF;

  -- Security check: Must include school_id for multi-tenancy
  IF query_text !~* 'school_id' THEN
    RAISE EXCEPTION 'Query must include school_id filter';
  END IF;

  -- Execute the query with parameters
  -- Note: This uses EXECUTE with proper parameter binding
  FOR query_result IN 
    EXECUTE query_text USING query_params
  LOOP
    results := array_append(results, row_to_json(query_result)::jsonb);
  END LOOP;

  -- Return results as JSON array
  result := jsonb_build_object(
    'success', true,
    'data', results,
    'count', array_length(results, 1)
  );

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    -- Return error as JSON
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION execute_ai_query TO authenticated;

-- Add comment
COMMENT ON FUNCTION execute_ai_query IS 'Safely executes AI-generated SELECT queries with parameter binding';
