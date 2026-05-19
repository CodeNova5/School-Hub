# Platform And Public Pages Structure

This file covers supporting modules that sit alongside the core school data.

## Tables And Modules
- `notification_logs`
- `notification_tokens`
- `email_logs`
- `ai_chat_history`
- `live_sessions`
- `teacher_attendance`
- website builder page/content tables
- hall of fame support tables
- alumni directory tables
- admissions extension tables
- academics/public showcase tables
- AI assistant execution helpers

## Dependency Order
- Core school and user tables must exist first
- Notification and communication tables come next because they depend on school scoping and auth users
- Live sessions and attendance tables should follow teachers, classes, and subject bindings
- Website/public-content tables are safe after the core school model exists

## RLS And Access Notes
- Public-facing tables should still be school-scoped where they store school-owned data
- Live sessions must protect teacher and student read paths with class/school checks
- Notification and email logs should keep writes constrained to trusted server-side paths

## Historical Sources
- `supabase/migrations/20260221_create_notification_tokens.sql`
- `supabase/migrations/20260224_create_notification_logs.sql`
- `supabase/migrations/20260306_create_ai_chat_history.sql`
- `supabase/migrations/02_AI_ASSISTANT_FUNCTION.sql`
- `supabase/migrations/20260405_create_email_logs_table.sql`
- `supabase/migrations/20260406_remove_delivery_method_from_notification_logs.sql`
- `supabase/migrations/20260413_create_live_sessions.sql`
- `supabase/migrations/20260414_live_sessions_subject_binding.sql`
- `supabase/migrations/20260415_live_sessions_scheduling_window.sql`
- `supabase/migrations/20260417_fix_live_sessions_rls_for_custom_classes.sql`
- `supabase/migrations/20260418_create_teacher_attendance.sql`
- `supabase/migrations/20260422_website_builder_v1.sql`
- `supabase/migrations/20260425_hall_of_fame_page_support.sql`
- `supabase/migrations/20260426_alumni_directory_workflow.sql`
- `supabase/migrations/20260427_add_school_admission_fields.sql`
- `supabase/migrations/20260428_academics_page_support.sql`
- `supabase/migrations/20260428_add_ip_address_to_admissions.sql`
- `supabase/migrations/20260428_public_academics_showcase.sql`
