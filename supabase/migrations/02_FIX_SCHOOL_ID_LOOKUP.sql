-- Fix: Update get_my_school_id() to check students, teachers, and parents tables
-- This allows non-admin users (students, teachers, parents) to get their school_id
-- even if they're not in the user_role_links table

CREATE OR REPLACE FUNCTION get_my_school_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result uuid;
BEGIN
  -- Try to get from admins table first (for admins)
  SELECT school_id INTO result FROM admins WHERE user_id = auth.uid() LIMIT 1;
  
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  -- Fallback to user_role_links (for explicit role assignments)
  SELECT school_id INTO result 
  FROM user_role_links 
  WHERE user_id = auth.uid() AND school_id IS NOT NULL 
  LIMIT 1;
  
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  -- Check students table (students table always has school_id)
  SELECT school_id INTO result FROM students WHERE user_id = auth.uid() LIMIT 1;
  
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  -- Check teachers table
  SELECT school_id INTO result FROM teachers WHERE user_id = auth.uid() LIMIT 1;
  
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  -- Check parents table
  SELECT school_id INTO result FROM parents WHERE user_id = auth.uid() LIMIT 1;
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
