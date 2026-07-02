# Core And Tenancy Structure

This file covers the database foundation that every other domain depends on.

## Tables
- `sessions`
- `terms`
- `schools`
- `school_education_levels`
- `school_class_levels`
- `school_streams`
- `school_departments`
- `school_religions`
- `school_level_subject_presets`
- `teachers`
- `classes`
- `subjects`
- `students`
- `parents`
- `period_slots`
- `timetable_entries`
- `notification_tokens`
- `admins` or admin-role primitives where present in the setup bundle
- `student_guardian_links`

## Column Changes (Post-Initial-Setup)
- `schools.motto` — optional school motto text (`20260701_add_school_motto_and_domain_ratings.sql`)
- `teachers.signature_url` — teacher signature image for result sheets
- `teachers.bank_name`, `teachers.bank_code`, `teachers.account_number`, `teachers.account_name` — bank details for payroll
- `teachers.paystack_subaccount_code` — Paystack subaccount for salary payments
- `admins.signature_url` — admin signature image

## Core Relationships
- `terms.session_id` -> `sessions.id`
- Every school-scoped table uses `school_id -> schools.id`
- `school_class_levels.education_level_id` -> `school_education_levels.id`
- `school_level_subject_presets.education_level_id` -> `school_education_levels.id`
- `school_level_subject_presets.department_id` -> `school_departments.id`
- `school_level_subject_presets.religion_id` -> `school_religions.id`
- `teachers.user_id`, `students.user_id`, and `parents.user_id` link back to `auth.users` where used

## Shared Functions
- `is_super_admin()`
- `is_admin()`
- `get_my_school_id()`
- `can_access_super_admin()`
- `search_users_by_email(search_email text)`
- timestamp helpers used by the setup bundle

## RLS
- School-scoped access is enforced by `school_id = get_my_school_id()` or equivalent helper checks
- `school_level_subject_presets` is explicitly protected with read/manage policies
- Core tables should be created before any feature bundle that references classes, students, teachers, or school config

## Historical Sources
- `supabase/migrations/00_COMPLETE_DATABASE_SETUP.sql`
- `supabase/migrations/01_MULTITENANCY_MIGRATION.sql`
- `supabase/migrations/02_FIX_SCHOOL_ID_LOOKUP.sql`
- `supabase/migrations/create_admins_table.sql`
- `supabase/migrations/add_signature_to_admins.sql`
- `supabase/migrations/add_signature_to_teachers.sql`
- `supabase/migrations/add_promotion_locking.sql`
- `supabase/migrations/fix-sessions.SQL`
- `supabase/migrations/20260316_create_school_level_subject_presets.sql`
- `supabase/migrations/20260316_drop_category_from_school_level_subject_presets.sql`
- `supabase/migrations/20260608_add_session_end_date_trigger.sql`
- `supabase/migrations/20260701_allow_admins_update_own_profile.sql`
- `supabase/migrations/20260701_add_school_motto_and_domain_ratings.sql`
