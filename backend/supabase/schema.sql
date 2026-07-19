-- =============================================================================
-- AssetTrack — database schema
--
-- Run this ONCE in your Supabase project: SQL Editor → New query → paste → Run.
-- It is safe to re-run: every object is created with IF NOT EXISTS or
-- CREATE OR REPLACE, and policies are dropped before being recreated.
--
-- Creates:
--   1. Tables      profiles, asset_categories, assets, assignments
--   2. Trigger     handle_new_user() — auto-creates a profile row on signup
--   3. RLS         admins see everything; employees see only their own rows
--   4. Seed data   a few asset categories to get you started
-- =============================================================================


-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- Every signed-up user gets exactly one profile row, keyed by their auth id.
-- The app reads role/is_active from here on every page load (AuthContext.jsx).
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text        not null default '',
  email       text        not null,
  role        text        not null default 'employee'
                          check (role in ('admin', 'employee')),
  department  text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Application-level user data. Mirrors auth.users 1:1 via the handle_new_user trigger.';


-- Lookup table for asset types: Laptop, Monitor, Phone, etc.
create table if not exists public.asset_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null unique,
  created_at  timestamptz not null default now()
);


-- The hardware itself. `status` values must match the keys in
-- theme.js → statusColors, which is what the UI colour-codes against.
create table if not exists public.assets (
  id               uuid primary key default gen_random_uuid(),
  asset_tag        text        not null unique,
  name             text        not null,
  brand            text,
  model            text,
  serial_number    text unique,
  category_id      uuid references public.asset_categories (id) on delete set null,
  status           text        not null default 'available'
                               check (status in ('available', 'assigned', 'under_repair', 'retired')),
  purchase_date    date,
  warranty_expiry  date,
  created_at       timestamptz not null default now()
);

create index if not exists assets_status_idx      on public.assets (status);
create index if not exists assets_category_id_idx on public.assets (category_id);


-- Links an asset to the employee holding it. A row with status='active'
-- means "currently assigned"; 'returned' keeps the historical record.
create table if not exists public.assignments (
  id             uuid primary key default gen_random_uuid(),
  asset_id       uuid        not null references public.assets (id)   on delete cascade,
  employee_id    uuid        not null references public.profiles (id) on delete cascade,
  assigned_date  date        not null default current_date,
  returned_date  date,
  status         text        not null default 'active'
                             check (status in ('active', 'returned')),
  remarks        text,
  created_at     timestamptz not null default now()
);

create index if not exists assignments_employee_id_idx on public.assignments (employee_id);
create index if not exists assignments_asset_id_idx    on public.assignments (asset_id);
create index if not exists assignments_status_idx      on public.assignments (status);

-- An asset can only be actively assigned to one person at a time.
create unique index if not exists assignments_one_active_per_asset_idx
  on public.assignments (asset_id)
  where status = 'active';


-- =============================================================================
-- 2. TRIGGER — auto-create a profile when someone signs up
--
-- AuthContext.loadProfile() signs a user straight back out if they have no
-- profile row, so without this trigger nobody can ever log in.
--
-- Reads optional name/department out of the signup metadata if present:
--   supabase.auth.signUp({ email, password,
--     options: { data: { name: 'Alice Kumar', department: 'Engineering' } } })
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, department)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'department'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- =============================================================================
-- 3. ROW LEVEL SECURITY
--
-- This is the app's ONLY security boundary. The frontend ships the anon key
-- to the browser and several components (notably AssetDetails.jsx) do no
-- ownership checking of their own — they rely entirely on these policies.
--
-- NOTE ON is_admin(): a policy on `profiles` that checks the caller's role by
-- selecting from `profiles` would re-trigger the same policy and recurse
-- forever. Marking the helper `security definer` makes it run as the function
-- owner, which bypasses RLS and breaks the cycle.
-- =============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

alter table public.profiles        enable row level security;
alter table public.asset_categories enable row level security;
alter table public.assets          enable row level security;
alter table public.assignments     enable row level security;


-- ---------- profiles --------------------------------------------------------

drop policy if exists "profiles: read own"           on public.profiles;
drop policy if exists "profiles: admin reads all"    on public.profiles;
drop policy if exists "profiles: update own"         on public.profiles;
drop policy if exists "profiles: admin writes all"   on public.profiles;

-- Everyone can read their own profile (this is what login depends on).
create policy "profiles: read own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: admin reads all"
  on public.profiles for select
  using (public.is_admin());

-- Users may edit their own name/department, but NOT their own role or
-- is_active flag — otherwise any employee could promote themselves to admin.
create policy "profiles: update own"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role      = (select role      from public.profiles where id = auth.uid())
    and is_active = (select is_active from public.profiles where id = auth.uid())
  );

create policy "profiles: admin writes all"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());


-- ---------- asset_categories ------------------------------------------------

drop policy if exists "categories: read for signed-in" on public.asset_categories;
drop policy if exists "categories: admin writes"       on public.asset_categories;

-- Employees need to read category names to render their asset tables.
create policy "categories: read for signed-in"
  on public.asset_categories for select
  to authenticated
  using (true);

create policy "categories: admin writes"
  on public.asset_categories for all
  using (public.is_admin())
  with check (public.is_admin());


-- ---------- assets ----------------------------------------------------------

drop policy if exists "assets: admin reads all"    on public.assets;
drop policy if exists "assets: employee reads own" on public.assets;
drop policy if exists "assets: admin writes"       on public.assets;

create policy "assets: admin reads all"
  on public.assets for select
  using (public.is_admin());

-- An employee can only see an asset if it is actively assigned to them.
-- This is what makes the assignments→assets→categories join in
-- EmployeeDashboard.jsx / MyAssets.jsx return their rows and nobody else's.
create policy "assets: employee reads own"
  on public.assets for select
  using (
    exists (
      select 1
      from public.assignments a
      where a.asset_id    = assets.id
        and a.employee_id = auth.uid()
        and a.status      = 'active'
    )
  );

create policy "assets: admin writes"
  on public.assets for all
  using (public.is_admin())
  with check (public.is_admin());


-- ---------- assignments -----------------------------------------------------

drop policy if exists "assignments: admin reads all"    on public.assignments;
drop policy if exists "assignments: employee reads own" on public.assignments;
drop policy if exists "assignments: admin writes"       on public.assignments;

create policy "assignments: admin reads all"
  on public.assignments for select
  using (public.is_admin());

-- The policy AssetDetails.jsx leans on: fetching an assignment id that
-- isn't yours returns zero rows, and .single() turns that into an error
-- the page renders as "not found, or you don't have access to it".
create policy "assignments: employee reads own"
  on public.assignments for select
  using (employee_id = auth.uid());

create policy "assignments: admin writes"
  on public.assignments for all
  using (public.is_admin())
  with check (public.is_admin());


-- =============================================================================
-- 4. SEED DATA — a handful of categories so the dropdowns aren't empty
-- =============================================================================

insert into public.asset_categories (name) values
  ('Laptop'), ('Monitor'), ('Phone'), ('Tablet'), ('Peripheral'), ('Networking')
on conflict (name) do nothing;


-- =============================================================================
-- OPTIONAL — sample assets + an assignment, for testing the employee views.
--
-- Run this AFTER you have created your users (see README Step 2). Replace
-- the email below with the address of one of your employee accounts.
-- =============================================================================
--
-- insert into public.assets
--   (asset_tag, name, brand, model, serial_number, category_id, status, purchase_date, warranty_expiry)
-- values
--   ('AT-0001', 'MacBook Pro 14"', 'Apple', 'M3 Pro', 'C02XK1ABCD01',
--    (select id from public.asset_categories where name = 'Laptop'),
--    'assigned', '2024-02-11', '2027-02-11'),
--   ('AT-0002', 'Dell UltraSharp 27"', 'Dell', 'U2723QE', 'CN0ABCD1234',
--    (select id from public.asset_categories where name = 'Monitor'),
--    'assigned', '2024-03-02', '2026-09-30'),
--   ('AT-0003', 'ThinkPad X1 Carbon', 'Lenovo', 'Gen 11', 'LR0ZZ9981X',
--    (select id from public.asset_categories where name = 'Laptop'),
--    'available', '2023-11-20', '2026-11-20');
--
-- insert into public.assignments (asset_id, employee_id, assigned_date, status, remarks)
-- select
--   a.id,
--   p.id,
--   current_date - 30,
--   'active',
--   'Issued at onboarding.'
-- from public.assets a
-- cross join public.profiles p
-- where a.asset_tag in ('AT-0001', 'AT-0002')
--   and p.email = 'employee@company.com';   -- ← change this
