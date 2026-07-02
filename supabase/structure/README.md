# Supabase Structure

These files are the canonical current-structure reference for the database.
They are organized by domain so future edits do not require reading the full migration history.

## Recommended Order
1. `00-core-and-tenancy.md`
2. `01-academics-and-assessment.md`
3. `02-platform-and-public-pages.md`
4. `03-finance-and-jamb.md`
5. `04-plans-and-subscriptions.md`
6. `05-admin-audit-and-infrastructure.md`

## Rule
Use the structure files for understanding the current database layout.
Treat `supabase/migrations/` as historical change log files, not the place to rebuild the model by hand.

## Current Coverage
- Core identity, tenancy, class hierarchy, and shared helpers (00)
- Academic data, grading, attendance, results, promotion, timetable support, teacher question bank, and lesson notes (01)
- Platform features such as notifications, live sessions, AI assistant, admissions, alumni, website pages, guardian links, WhatsApp logs, and AI usage tracking (02)
- Finance, teacher payroll, and JAMB CBT feature tables, policies, and helpers (03)
- Subscription plans, feature gating, subscriber management, school plan grants, and route-based enforcement (04)
- Admin audit logs, trigger-based change tracking, and data retention policies (05)
