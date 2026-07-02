# Admin Audit And Infrastructure Structure

This file covers system-level audit logging and data retention policies that sit outside any single feature domain.

## Tables
- `admin_audit_logs` — trigger-based audit trail for all admin CRUD operations on managed tables
  - Captures: `school_id`, `table_name`, `record_id`, `operation` (INSERT/UPDATE/DELETE), `old_data` (jsonb), `new_data` (jsonb), `changed_by`, `changed_by_name`

## Trigger Function
- `log_admin_audit()` — generic trigger function that captures old/new row values and resolves the admin's display name
  - Runs with SECURITY DEFINER to bypass RLS on insert
  - Gracefully handles failures (logs a warning, does NOT roll back the original data change)

## Trigger Targets
The audit trigger is attached to every admin-managed table:
- `students`, `teachers`, `classes`, `subjects`, `subject_classes`, `sessions`, `terms`
- `period_slots`, `timetable_entries`, `parents`
- `school_education_levels`, `school_class_levels`, `school_streams`, `school_departments`, `school_religions`
- `school_level_subject_presets`, `student_guardian_links`, `admins`

## Data Retention
- `cleanup_old_audit_logs(retention_days DEFAULT 90)` — deletes audit log entries older than the retention period
- Scheduled via pg_cron (if available) at 03:00 UTC daily

## RLS
- Super admins and school admins can read audit logs for their school
- Only the SECURITY DEFINER trigger function inserts rows; no direct INSERT/UPDATE/DELETE policies for regular users

## Dependency Order
- Core tables (students, teachers, classes, etc.) must exist first
- The `admins` table must exist to resolve `changed_by_name`
- `admin_audit_logs` table is created last after all trigger target tables exist

## Historical Sources
- `supabase/migrations/20260626_admin_audit_logs.sql`
- `supabase/migrations/20260627_audit_logs_retention_policy.sql`
