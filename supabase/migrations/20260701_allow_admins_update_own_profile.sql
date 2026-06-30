-- ============================================================================
-- ALLOW ADMINS TO UPDATE THEIR OWN PROFILE
-- ============================================================================
-- The existing policies on admins table only allow super_admins to update.
-- This policy allows regular admins to update their own record (for profile
-- settings like name and signature_url).

DROP POLICY IF EXISTS "Admins can update own profile" ON admins;
CREATE POLICY "Admins can update own profile"
  ON admins FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
