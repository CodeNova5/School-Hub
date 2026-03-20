-- Fix RLS policy for results table to allow teachers to save results

-- Remove the restrictive policy
DROP POLICY IF EXISTS "Admins can manage results" ON results;

-- Create new policy that allows admins AND teachers to manage results
CREATE POLICY "Admins and teachers can manage results"
  ON results FOR ALL
  TO authenticated
  USING (
    is_super_admin() 
    OR (is_admin() AND school_id = get_my_school_id())
    OR (
      -- Teachers can see/edit results for their subject classes
      EXISTS (
        SELECT 1 FROM subject_classes
        WHERE subject_classes.id = results.subject_class_id
        AND subject_classes.teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
      )
      AND (SELECT school_id FROM teachers WHERE user_id = auth.uid()) = results.school_id
    )
  )
  WITH CHECK (
    is_super_admin() 
    OR (is_admin() AND school_id = get_my_school_id())
    OR (
      -- Teachers can only save results for their subject classes
      EXISTS (
        SELECT 1 FROM subject_classes
        WHERE subject_classes.id = results.subject_class_id
        AND subject_classes.teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
      )
      AND (SELECT school_id FROM teachers WHERE user_id = auth.uid()) = results.school_id
    )
  );
