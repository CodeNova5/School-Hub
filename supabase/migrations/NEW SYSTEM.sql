-- ============================================================================
-- NEW GRANULAR RBAC SYSTEM
-- ============================================================================

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  key text unique not null
);

create table if not exists role_permissions (
  role_id uuid references roles(id) on delete cascade,
  permission_id uuid references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- user → role (many to many)
create table if not exists user_role_links (
  user_id uuid references auth.users(id) on delete cascade,
  role_id uuid references roles(id) on delete cascade,
  primary key (user_id, role_id)
);

insert into roles (name) values
('super_admin'),
('admin')
on conflict do nothing;

insert into permissions (key) values
('manage_admins'),
('manage_classes'),
('manage_teachers'),
('manage_admissions'),
('manage_sessions'),
('manage_terms'),
('manage_events'),
('manage_news'),
('manage_calendar'),
('manage_testimonials'),
('manage_notifications'),
('manage_settings'),
('admin_full')
on conflict do nothing;

insert into role_permissions
select r.id, p.id
from roles r, permissions p
where r.name = 'super_admin'
on conflict do nothing;

create or replace function has_permission(p_key text)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from user_role_links ul
    join role_permissions rp on rp.role_id = ul.role_id
    join permissions p on p.id = rp.permission_id
    where ul.user_id = auth.uid()
      and p.key = p_key
  );
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
as $$
  select has_permission('admin_full');
$$;

insert into user_role_links (user_id, role_id)
values (
  '20b92bf4-1bb9-4694-a09e-57746987e05a',
  (select id from roles where name = 'super_admin')
);

alter table roles enable row level security;

create policy "read roles"
on roles
for select
to authenticated
using (true);

create policy "only super admin manages roles"
on roles
for all
to authenticated
using (has_permission('manage_admins'))
with check (has_permission('manage_admins'));

alter table permissions enable row level security;

create policy "read permissions"
on permissions
for select
to authenticated
using (true);

create policy "only super admin manages permissions"
on permissions
for all
to authenticated
using (has_permission('manage_admins'))
with check (has_permission('manage_admins'));

alter table role_permissions enable row level security;

create policy "read role permissions"
on role_permissions
for select
to authenticated
using (true);

create policy "only super admin manages role permissions"
on role_permissions
for all
to authenticated
using (has_permission('manage_admins'))
with check (has_permission('manage_admins'));

alter table user_role_links enable row level security;

create policy "users read their own roles"
on user_role_links
for select
to authenticated
using (user_id = auth.uid() or has_permission('manage_admins'));

create policy "admins can modify roles"
on user_role_links
for insert
to authenticated
with check (has_permission('manage_admins'));

create policy "admins can update roles"
on user_role_links
for update
to authenticated
using (has_permission('manage_admins'))
with check (has_permission('manage_admins'));

create policy "admins can delete roles"
on user_role_links
for delete
to authenticated
using (has_permission('manage_admins'));


create or replace function can_access_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from user_role_links ul
    join roles r on r.id = ul.role_id
    where ul.user_id = auth.uid()
      and r.name in ('super_admin', 'admin')
  );
$$;

-- Helper function to get admin user details
create or replace function get_admin_users(user_ids uuid[])
returns table (
  id uuid,
  email text
)
language sql
security definer
as $$
  select id, email
  from auth.users
  where id = any(user_ids);
$$;

-- Helper function to search users by email
create or replace function search_users_by_email(search_email text)
returns table (
  id uuid,
  email text
)
language sql
security definer
as $$
  select id, email
  from auth.users
  where email ilike '%' || search_email || '%'
  limit 10;
$$;

