-- ============================================================================
-- SIMPLIFIED ADMIN SYSTEM - SUPER ADMIN ONLY
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

-- Only super_admin role
insert into roles (name) values
('super_admin')
on conflict do nothing;

-- Only admin_full permission
insert into permissions (key) values
('admin_full')
on conflict do nothing;

-- Grant admin_full to super_admin
insert into role_permissions
select r.id, p.id
from roles r, permissions p
where r.name = 'super_admin' and p.key = 'admin_full'
on conflict do nothing;

-- Check if user has admin_full permission (super_admin)
create or replace function is_admin()
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
      and p.key = 'admin_full'
  );
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
using (is_admin())
with check (is_admin());

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
using (is_admin())
with check (is_admin());

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
using (is_admin())
with check (is_admin());

alter table user_role_links enable row level security;

create policy "users read their own roles"
on user_role_links
for select
to authenticated
using (user_id = auth.uid() or is_admin());

create policy "super admins can modify roles"
on user_role_links
for insert
to authenticated
with check (is_admin());

create policy "super admins can update roles"
on user_role_links
for update
to authenticated
using (is_admin())
with check (is_admin());

create policy "super admins can delete roles"
on user_role_links
for delete
to authenticated
using (is_admin());


-- Check if user can access admin panel
create or replace function can_access_admin()
returns boolean
language sql
stable
security definer
as $$
  select is_admin();
$$;

