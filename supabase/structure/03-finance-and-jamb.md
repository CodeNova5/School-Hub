# Finance And JAMB Structure

This file groups the remaining feature domains that depend on the core school model.

## Tables And Modules
- finance module foundation tables
- JAMB question bank tables
- JAMB student access tables
- JAMB attempt tracking tables
- any catalog reset or refresh support tables used by the CBT feature

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
- legacy JAMB helper scripts outside the main `supabase/migrations/` history

## Permanent Vs Temporary
- Keep the finance and JAMB table definitions in the structure set
- Treat reset, backfill, and uniqueness repair scripts as history, not as the canonical structure
