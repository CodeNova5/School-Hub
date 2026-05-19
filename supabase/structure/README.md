# Supabase Structure

These files are the canonical current-structure reference for the database.
They are organized by domain so future edits do not require reading the full migration history.

## Recommended Order
1. `00-core-and-tenancy.md`
2. `01-academics-and-assessment.md`
3. `02-platform-and-public-pages.md`
4. `03-finance-and-jamb.md`

## Rule
Use the structure files for understanding the current database layout.
Treat `supabase/migrations/` as historical change log files, not the place to rebuild the model by hand.

## Current Coverage
- Core identity, tenancy, class hierarchy, and shared helpers
- Academic data, grading, attendance, results, promotion, and timetable support
- Platform features such as notifications, live sessions, AI assistant, admissions, alumni, and website pages
- Finance and JAMB CBT feature tables, policies, and helpers
