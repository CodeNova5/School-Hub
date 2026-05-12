# JAMB Catalog Reset Runbook

This runbook applies the catalog-only architecture:
- no fallback scans from `jamb_questions` for subject/year filters
- no trigger/backfill-based catalog maintenance
- `jamb_questions` is dropped and rebuilt from scratch
- importer is the sole writer for `jamb_questions`, `jamb_subjects`, and `jamb_subject_years`

## Preconditions

- You have a valid `.env` with:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- `supabase/migrations/20260512_reset_jamb_catalogs.sql` exists.
- Importer changes are present in `import-jamb-questions.js`.
- You are prepared to repopulate the full JAMB question bank after reset.

## 1) Apply migrations

Use your normal Supabase migration workflow.

```powershell
supabase db push
```

If you are using remote SQL editor/manual execution, apply migration file contents from:
- `supabase/migrations/20260512_reset_jamb_catalogs.sql`

## 2) Verify schema reset succeeded

Run these SQL checks in Supabase SQL editor.

```sql
-- Catalog tables must exist
select to_regclass('public.jamb_subjects') as jamb_subjects_table;
select to_regclass('public.jamb_subject_years') as jamb_subject_years_table;
select to_regclass('public.jamb_questions') as jamb_questions_table;

-- Trigger-based sync must be gone
select tgname
from pg_trigger
where tgname in (
  'trg_jamb_questions_upsert_subject_catalog',
  'trg_jamb_questions_upsert_subject_year_catalog'
);

-- Legacy functions must be gone  
select proname
from pg_proc
where proname in (
  'upsert_jamb_subject_from_question',
  'upsert_jamb_subject_year_from_question'
);

-- Policies should exist
select schemaname, tablename, policyname
from pg_policies
where tablename in ('jamb_subjects', 'jamb_subject_years')
order by tablename, policyname;
```

Expected:
- both tables resolve
- `jamb_questions` resolves
- no rows for the two triggers
- no rows for the two legacy functions
- admin/student policies present on both catalog tables

## 3) Rebuild catalog + questions via importer

Run importer for each subject/year scope you want.

Single subject/year:

```powershell
node import-jamb-questions.js --subject physics --year 2024
```

Year range for one subject:

```powershell
node import-jamb-questions.js --subject physics --year 2010-2025
```

Important:
- Importer now fails fast if any JAMB catalog table is missing/broken.
- Importer now upserts `jamb_subjects` and `jamb_subject_years` before question writes.
- Because `jamb_questions` is reset, you must re-import all intended questions.

## 4) Verify rebuilt data quality

```sql
-- Subject catalog count
select count(*) as subject_count from jamb_subjects;

-- Subject-year uniqueness sanity
select count(*) as subject_year_rows,
       count(distinct (subject_slug, exam_year)) as subject_year_distinct
from jamb_subject_years;

-- Top subject-year pairs
select subject_slug, exam_year, count(*) as row_count
from jamb_subject_years
group by subject_slug, exam_year
order by exam_year desc, subject_slug asc
limit 100;

-- Questions still keyed by subject/year
select subject_slug, exam_year, count(*) as question_count
from jamb_questions
group by subject_slug, exam_year
order by exam_year desc, subject_slug asc
limit 100;
```

Expected:
- `subject_year_rows == subject_year_distinct`
- subject/year entries align with imported questions
- `jamb_questions` row counts match the importer scope you ran

## 5) App behavior check

On student JAMB page:
- Subject dropdown loads from `jamb_subjects` only
- Year dropdown loads from `jamb_subject_years` only
- No fallback scans over `jamb_questions`

If dropdowns are empty:
- run importer for missing subject/year coverage
- verify RLS/policies and authenticated user access

## 6) Full reset reminder

This reset deletes the entire JAMB question bank. Run the importer for every subject/year slice you want to restore before handing the app back to users.

## 7) Rollback note

If needed, rollback by restoring a DB backup taken before reset.
This reset intentionally removes trigger-sync behavior and should not be rolled back partially.
