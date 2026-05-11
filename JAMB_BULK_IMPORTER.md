# JAMB Bulk Importer

This repository now includes a standalone Node.js importer for JAMB question backfills.

## What it does

- Scrapes every question page for a given subject and year from MySchool.ng
- Fetches answer details so the correct option and explanation are stored
- Downloads any question image and uploads it to Supabase Storage
- Inserts new rows into `jamb_questions` and refreshes existing rows on reruns

## Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JAMB_IMAGE_BUCKET` optional, defaults to `jamb-question-images`

## Required CLI arguments

- `--subject` the JAMB subject slug, such as `mathematics`
- `--year` the exam year, such as `2022`

## Example

```bash
node scripts/import-jamb-questions.js --subject mathematics --year 2022
```

Or use the npm script:

```bash
npm run jamb:import -- --subject mathematics --year 2022
```

## Storage bucket

The importer creates the bucket if it does not exist and marks it public. Uploaded images are stored under paths like:

`jamb/<subject>/<year>/page-<n>/<external-question-id>.jpg`

If you want a different bucket name, set `JAMB_IMAGE_BUCKET` before running the import.