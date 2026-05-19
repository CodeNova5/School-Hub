# Academics And Assessment Structure

This file groups the school operations that sit on top of the core tenancy model.

## Tables
- `subject_classes`
- `student_subjects`
- `student_optional_subjects`
- `attendance`
- `assignments`
- `assignment_submissions`
- `submissions`
- `results`
- `results_publication`
- `result_settings`
- promotion and class-history tables where present

## Dependency Order
- Create core school, class, student, subject, and term tables first
- Then create junction tables such as `subject_classes` and `student_subjects`
- Then create assessment tables such as `attendance`, `assignments`, and `results`
- Add promotion and backfill/index changes only after the base academic tables exist

## RLS And Integrity Notes
- `student_subjects` does not need a direct `school_id` filter when the student relation already scopes the record
- `subject_classes` and `student_subjects` must have working RLS policies so nested relationship expansion can resolve cleanly
- Result publication and teacher write policies should remain aligned with the class/subject structure

## Common Feature Bundles In This Group
- subject assignment flexibility
- period slot fixes
- timetable break handling
- result settings and published component keys
- results RLS and performance adjustments
- promotion workflow and idempotency helpers
- class history / promotion tracking

## Historical Sources
- `supabase/migrations/20260315_subject_assignment_flexibility.sql`
- `supabase/migrations/20260317_fix_period_slots.sql`
- `supabase/migrations/20260318_allow_break_without_period_number.sql`
- `supabase/migrations/20260320_create_result_settings.sql`
- `supabase/migrations/20260320_add_published_component_keys.sql`
- `supabase/migrations/20260320_fix_results_rls_for_teachers.sql`
- `supabase/migrations/20260320_remove_subject_mark_columns.sql`
- `supabase/migrations/20260321_add_promotion_class_workflow.sql`
- `supabase/migrations/20260321_promotion_idempotency_and_tx.sql`
- `supabase/migrations/20260323_fix_assignments_subjects_fk.sql`
- `supabase/migrations/20260323_fix_student_subjects_school_id.sql`
- `supabase/migrations/20260323_backfill_result_component_scores_and_indexes.sql`
- `supabase/migrations/20260324_results_rls_class_teacher_write.sql`
- `supabase/migrations/20260324_results_scalability_indexes.sql`
- `supabase/migrations/20260326_add_student_assignment_submission_rls.sql`
- `supabase/migrations/20260326_add_student_timetable_rls.sql`
- `supabase/migrations/20260326_fix_student_timetable_rls.sql`
- `supabase/migrations/20260326_fix_subject_classes_rls_recursion.sql`
- `supabase/migrations/20260327_fix_student_subject_visibility_rls.sql`
- `supabase/migrations/create_class_history_and_promotion.sql`
