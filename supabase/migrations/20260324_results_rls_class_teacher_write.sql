-- ============================================================================
-- RESULTS RLS: ALLOW CLASS TEACHERS TO MANAGE RESULTS FOR THEIR OWN CLASS
-- ============================================================================

-- Keep existing admin policy intact; add class-teacher policy for class-owned subject rows.
-- Applies to INSERT/UPDATE/DELETE and conflict updates from upsert.

DROP POLICY IF EXISTS "Class teachers can manage class results" ON results;

CREATE POLICY "Class teachers can manage class results"
  ON results FOR ALL
  TO authenticated
  USING (
    is_super_admin()
    OR (
      can_access_teacher()
      AND school_id = get_my_school_id()
      AND EXISTS (
        SELECT 1
        FROM subject_classes sc
        JOIN classes c ON c.id = sc.class_id
        JOIN teachers t ON t.id = c.class_teacher_id
        WHERE sc.id = results.subject_class_id
          AND sc.school_id = results.school_id
          AND c.school_id = results.school_id
          AND t.school_id = results.school_id
          AND t.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      can_access_teacher()
      AND school_id = get_my_school_id()
      AND EXISTS (
        SELECT 1
        FROM subject_classes sc
        JOIN classes c ON c.id = sc.class_id
        JOIN teachers t ON t.id = c.class_teacher_id
        WHERE sc.id = results.subject_class_id
          AND sc.school_id = results.school_id
          AND c.school_id = results.school_id
          AND t.school_id = results.school_id
          AND t.user_id = auth.uid()
      )
    )
  );
