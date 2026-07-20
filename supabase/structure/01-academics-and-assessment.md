# Academics And Assessment Structure

This file groups the school operations that sit on top of the core tenancy model.

## Tables
- `subject_classes`
- `student_subjects`
- `student_optional_subjects` (includes `session_id`/`term_id` for historical optional enrollment tracking)
- `attendance`
- `assignments`
- `assignment_submissions`
- `submissions`
- `results` (includes `domain_ratings` jsonb column for affective/psychomotor domain ratings)
- `results_publication`
- `result_settings` (view over `result_school_settings`)
- `result_school_settings`
- `result_component_templates`
- `result_grade_scales`
- `result_component_scores`
- `class_history`
- `promotion_settings`
- `promotion_class_mappings`
- `promotion_class_progress`
- promotion and class-history tables where present

## Teacher Question Bank Module
- `teacher_question_topic_sets` — reusable topic lists per subject-class assignment (supports weekly scheme-of-work)
- `teacher_question_banks` — question banks (private or school-shared)
- `teacher_questions` — questions authored or generated, linked to banks
- `teacher_question_generation_logs` — audit trail for AI generation attempts
- `exam_paper_configs` — saved exam paper configurations per bank per term
- `question_bank_audit_logs` — audit trail for all question bank activities (create, edit, delete, print, etc.)

## Teacher Lesson Notes Module
- `teacher_lesson_notes` — AI-generated lesson notes linked to subjects and topics

## Custom Types (Teacher Question Bank)
- `teacher_question_visibility` ENUM: `'private', 'public_school'`
- `teacher_question_type` ENUM: `'objective', 'theory'`
- `teacher_question_difficulty` ENUM: `'easy', 'medium', 'hard'`
- `teacher_question_generation_status` ENUM: `'success', 'failed'`
- `lesson_note_status` ENUM: `'draft', 'published', 'archived'`
- `question_bank_audit_action` ENUM: `'bank_created', 'bank_updated', 'question_created', ...`

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
- school-level subject presets (compatibility migration to drop `category` column)
- teacher question bank (banks, questions, topic sets, generation logs)
- exam paper configurations (saved configs per bank per term)
- question bank audit logs
- teacher lesson notes (AI-generated)
- domain ratings on results (affective/psychomotor)

## Historical Sources
- `supabase/migrations/20260315_subject_assignment_flexibility.sql`
- `supabase/migrations/20260316_create_school_level_subject_presets.sql`
- `supabase/migrations/20260316_drop_category_from_school_level_subject_presets.sql`
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
- `supabase/migrations/20260527_teacher_question_bank_v1.sql`
- `supabase/migrations/20260622_create_teacher_lesson_notes.sql`
- `supabase/migrations/20260622_fix_question_bank_admin_id.sql`
- `supabase/migrations/20260623_fix_teacher_questions_admin_id.sql`
- `supabase/migrations/20260624_exam_paper_configs.sql`
- `supabase/migrations/20260625_question_bank_audit_logs.sql`
- `supabase/migrations/20260626_teacher_question_weekly_scheme.sql`
- `supabase/migrations/20260701_add_school_motto_and_domain_ratings.sql`
- `supabase/migrations/create_class_history_and_promotion.sql`
- `supabase/migrations/add-session-term-to-optional-subjects.sql`
