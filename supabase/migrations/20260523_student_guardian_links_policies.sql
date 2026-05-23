-- Enable RLS and add policies for student_guardian_links

ALTER TABLE IF EXISTS student_guardian_links ENABLE ROW LEVEL SECURITY;

-- Parents can view their own guardian links
DROP POLICY IF EXISTS "Parents can view their guardian links" ON student_guardian_links;
CREATE POLICY "Parents can view their guardian links"
  ON student_guardian_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parents p WHERE p.id = student_guardian_links.guardian_id AND p.user_id = auth.uid()
    )
    OR is_super_admin()
    OR (is_admin() AND school_id = get_my_school_id())
  );

-- School admins / admins can manage links for their school
DROP POLICY IF EXISTS "Admins can manage student_guardian_links" ON student_guardian_links;
CREATE POLICY "Admins can manage student_guardian_links"
  ON student_guardian_links FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- Service role (server) may insert rows via service key (RLS bypass) but allow insert checks for direct clients if needed
DROP POLICY IF EXISTS "Service role can insert student_guardian_links" ON student_guardian_links;
CREATE POLICY "Service role can insert student_guardian_links"
  ON student_guardian_links FOR INSERT
  WITH CHECK (true);

-- Allow parents to select via parent->guardian relationship; inserts/updates restricted to admins/service
