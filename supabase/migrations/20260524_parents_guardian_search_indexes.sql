-- Improve admin guardian search performance for large parent datasets.
-- Supports school-scoped lookups by name/email and recent ordering.

create extension if not exists pg_trgm;

create index if not exists idx_parents_school_created_at
  on public.parents (school_id, created_at desc);

create index if not exists idx_parents_school_is_active_created_at
  on public.parents (school_id, is_active, created_at desc);

create index if not exists idx_parents_name_trgm
  on public.parents
  using gin (name gin_trgm_ops);

create index if not exists idx_parents_email_trgm
  on public.parents
  using gin (email gin_trgm_ops);
