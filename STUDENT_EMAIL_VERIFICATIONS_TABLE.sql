create extension if not exists "pgcrypto";

create table if not exists student_email_verifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists student_email_verifications_school_email_idx
  on student_email_verifications (school_id, email);

alter table student_email_verifications enable row level security;
