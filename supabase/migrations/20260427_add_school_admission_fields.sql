-- Add religion and file_url columns to admissions table for school-specific applications
-- Supports multi-tenant school admission forms with document uploads

-- Add new columns
ALTER TABLE admissions
  ADD COLUMN IF NOT EXISTS religion text DEFAULT '',
  ADD COLUMN IF NOT EXISTS file_url text DEFAULT '';

-- Add comment for clarity
COMMENT ON COLUMN admissions.religion IS 'Religion selection for schools with religion mode enabled';
COMMENT ON COLUMN admissions.file_url IS 'URL to uploaded student documents/certificates';

-- Ensure RLS policies are properly set for school_id scoping
-- Drop old policies if they exist and recreate with proper scope
DROP POLICY IF EXISTS "School users can read admissions"        ON admissions;
DROP POLICY IF EXISTS "Admins can manage admissions"            ON admissions;

-- Allow public/anonymous users to create applications via their school subdomain
-- Applications are automatically school-scoped via school_id in the request
CREATE POLICY "Public can create admissions for their school"
  ON admissions FOR INSERT
  WITH CHECK (true); -- school_id is set server-side from x-school-id header

-- School users can read admissions for their school
CREATE POLICY "School users can read admissions"
  ON admissions FOR SELECT
  USING (is_super_admin() OR school_id = get_my_school_id());

-- Admins can manage admissions for their school
CREATE POLICY "Admins can manage admissions"
  ON admissions FOR UPDATE
  USING (is_super_admin() OR school_id = get_my_school_id())
  WITH CHECK (is_super_admin() OR school_id = get_my_school_id());
