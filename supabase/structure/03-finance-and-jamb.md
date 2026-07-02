# Finance And JAMB Structure

This file groups the remaining feature domains that depend on the core school model.

## Tables And Modules
- finance module foundation tables
- JAMB question bank tables
- JAMB student access tables
- JAMB attempt tracking tables
- any catalog reset or refresh support tables used by the CBT feature
- `jamb_exam_sessions` — server-side active/completed exam session tracking with timeout enforcement
- `teacher_payroll_settings` — salary configuration per teacher
- `teacher_payroll_payments` — payment records with status tracking
- `teachers.paystack_subaccount_code` — Paystack subaccount for salary disbursement
- `teachers.bank_name`, `teachers.bank_code`, `teachers.account_number`, `teachers.account_name` — bank details for payroll

## Dependency Order
- Core school, student, and role tables must exist first
- Finance tables should come after the school and user-scoping helpers are available
- JAMB tables should come after students and school-scoped access checks exist

## RLS And Access Notes
- Finance data should remain school-scoped and role-scoped
- JAMB access should be driven by student access grants and the `get_my_school_id()` helper
- Reset scripts should not be treated as permanent schema definitions

## Historical Sources
- `supabase/migrations/20260327_finance_module_foundation.sql`
- `supabase/migrations/20260504_jamb_cbt_feature.sql`
- `supabase/migrations/20260512_reset_jamb_catalogs.sql`
- `supabase/migrations/20260624_teacher_payroll_module.sql`
- `supabase/migrations/20260625_add_teacher_bank_details.sql`
- `migrations/create_jamb_exam_sessions.sql` (legacy root migration, content folded into canonical SQL)
- `migrations/fix_jamb_exam_sessions_unique_constraint.sql` (legacy root migration)

## Permanent Vs Temporary
- Keep the finance and JAMB table definitions in the structure set
- Treat reset, backfill, and uniqueness repair scripts as history, not as the canonical structure
