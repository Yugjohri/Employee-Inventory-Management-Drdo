-- =============================================================================
-- Employee Inventory Management — database schema (PostgreSQL)
--
-- Runs entirely on an intranet/offline PostgreSQL 14+ server. No cloud
-- services, no extensions beyond what ships with core Postgres.
--
-- Apply with:
--   psql -U postgres -d eims -f 01_schema.sql
--   psql -U postgres -d eims -f 02_seed.sql
--
-- Safe to re-run: every object uses IF NOT EXISTS / CREATE OR REPLACE, and
-- policies are dropped before being recreated.
--
-- Structure
--   1. Application role      eims_app — the login the API connects as
--   2. Organisation tables   groups, cadres, designations, internal_designations
--   3. People                employees (identity + login + role, one row each)
--   4. Inventory             asset_categories, assets, assignments
--   5. Requests              asset_requests
--   6. Session helpers       app_user_id() / app_role() / app_group_id()
--   7. Row Level Security    admin > group_it_coordinator > employee
--   8. Transactional funcs   assign_asset, return_assignment, resolve_request
--
-- The organisation tables (groups/cadres/designations, pis_number) follow the
-- structure used by the reference DRDO project, translated to Postgres idiom:
-- uuid keys instead of INT AUTO_INCREMENT, timestamptz instead of TIMESTAMP,
-- and real foreign keys. Their three-way split of login credentials across
-- employee/admin/adgh tables is deliberately NOT copied — credentials live in
-- exactly one place here, so a role change can never desynchronise a password.
-- =============================================================================


-- =============================================================================
-- 1. APPLICATION ROLE
--
-- The API connects as eims_app, which is intentionally NOT the table owner.
-- That matters: Postgres exempts a table's owner from its own RLS policies, so
-- connecting as the owner would silently disable every policy below.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'eims_app') then
    -- Password is overridden by 02_seed.sql / your own ALTER ROLE. Change it.
    create role eims_app login password 'change-me-in-production';
  end if;
end
$$;


-- =============================================================================
-- 2. ORGANISATION
-- =============================================================================

-- DRDO group (e.g. "AI — Artificial Intelligence Group"). This is the unit a
-- Group IT Coordinator's visibility is scoped to.
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  short_name  text        not null unique,
  full_name   text        not null,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.groups is
  'Organisational group. Defines the visibility boundary for group_it_coordinator.';


-- Service cadre: Technical, Administrative, etc.
create table if not exists public.cadres (
  id          uuid primary key default gen_random_uuid(),
  short_name  text        not null unique,
  full_name   text        not null,
  created_at  timestamptz not null default now()
);


-- Substantive designation (Scientist E, Scientist D, ...), belonging to a cadre.
create table if not exists public.designations (
  id          uuid primary key default gen_random_uuid(),
  cadre_id    uuid        references public.cadres (id) on delete set null,
  short_name  text        not null unique,
  full_name   text        not null,
  created_at  timestamptz not null default now()
);


-- Functional/internal designation (Group Head, Associate Director, ...).
create table if not exists public.internal_designations (
  id          uuid primary key default gen_random_uuid(),
  short_name  text        not null unique,
  full_name   text        not null,
  created_at  timestamptz not null default now()
);


-- =============================================================================
-- 3. EMPLOYEES
--
-- One row per person: identity, organisational placement, AND login. Keeping
-- credentials in a single table is the main structural change from the
-- reference project, which stored passwords in three tables and hand-synced
-- them — a standing opportunity for the copies to drift apart.
-- =============================================================================

create table if not exists public.employees (
  id            uuid primary key default gen_random_uuid(),

  -- Identity
  pis_number    text unique,
  first_name    text        not null,
  middle_name   text,
  last_name     text        not null,
  gender        text,
  dob           date,

  -- Contact
  email         text        not null unique,
  mobile        text,
  tele_no       text,

  -- Organisational placement
  group_id                 uuid references public.groups (id)                on delete set null,
  cadre_id                 uuid references public.cadres (id)                on delete set null,
  designation_id           uuid references public.designations (id)          on delete set null,
  internal_designation_id  uuid references public.internal_designations (id) on delete set null,
  is_gazetted              boolean not null default false,

  -- Login + authorisation
  username      text        not null unique,
  password_hash text        not null,
  role          text        not null default 'employee'
                            check (role in ('admin', 'group_it_coordinator', 'employee')),

  is_active     boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- A coordinator whose group is NULL would be scoped to nothing, which is a
  -- silent misconfiguration rather than a useful state. Reject it outright.
  constraint coordinator_needs_group
    check (role <> 'group_it_coordinator' or group_id is not null)
);

create index if not exists employees_group_id_idx on public.employees (group_id);
create index if not exists employees_role_idx     on public.employees (role);

-- Convenience for display and search; kept in the database so every query and
-- report spells a person's name the same way.
create or replace function public.employee_full_name(
  p_first text, p_middle text, p_last text
)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    coalesce(p_first,'') || ' ' || coalesce(p_middle,'') || ' ' || coalesce(p_last,''),
    '\s+', ' ', 'g'
  ));
$$;


-- =============================================================================
-- 4. INVENTORY
-- =============================================================================

create table if not exists public.asset_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null unique,
  created_at  timestamptz not null default now()
);


-- `status` values must match the keys in frontend theme.js -> statusColors,
-- which is what the UI colour-codes against.
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


-- A row with status='active' means "currently held"; 'returned' is history.
create table if not exists public.assignments (
  id             uuid primary key default gen_random_uuid(),
  asset_id       uuid        not null references public.assets (id)    on delete cascade,
  employee_id    uuid        not null references public.employees (id) on delete cascade,
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

-- An asset can only be actively held by one person at a time.
create unique index if not exists assignments_one_active_per_asset_idx
  on public.assignments (asset_id)
  where status = 'active';


-- =============================================================================
-- 5. ASSET REQUESTS
--
-- Employees raise these; admins resolve them. Two kinds, distinguished by
-- request_type, sharing one status lifecycle:
--
--   repair     — something is wrong with an asset the employee already holds,
--                so asset_id is required and identifies it (serial number and
--                asset tag come from the joined asset).
--   new_asset  — the employee wants hardware they don't have. There is no
--                asset row yet, so they name a category instead.
-- =============================================================================

create table if not exists public.asset_requests (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid        not null references public.employees (id) on delete cascade,

  request_type  text        not null check (request_type in ('repair', 'new_asset')),
  asset_id      uuid references public.assets (id)           on delete set null,
  category_id   uuid references public.asset_categories (id) on delete set null,

  description   text        not null,
  status        text        not null default 'pending'
                            check (status in ('pending', 'approved', 'rejected', 'completed')),

  admin_remarks text,
  resolved_at   timestamptz,
  resolved_by   uuid references public.employees (id) on delete set null,
  created_at    timestamptz not null default now(),

  -- Each type carries the field that actually identifies what's being asked
  -- for. Enforcing it here means the API can't write a half-formed request.
  constraint request_shape check (
    (request_type = 'repair'    and asset_id is not null) or
    (request_type = 'new_asset' and asset_id is null)
  )
);

create index if not exists asset_requests_employee_id_idx on public.asset_requests (employee_id);
create index if not exists asset_requests_status_idx      on public.asset_requests (status);

-- One open repair request per asset per person: stops a frustrated employee
-- filing the same fault five times and burying the queue.
create unique index if not exists asset_requests_one_open_repair_idx
  on public.asset_requests (asset_id, employee_id)
  where request_type = 'repair' and status = 'pending';


-- =============================================================================
-- 6. SESSION CONTEXT
--
-- The API opens a transaction per request and calls set_app_user(...) with the
-- values it read out of the verified JWT. The policies below then read them
-- back. Because identity comes from the session rather than a lookup, no policy
-- on `employees` ever has to query `employees` — which is what would otherwise
-- recurse infinitely.
--
-- current_setting(..., true) returns NULL rather than raising when the setting
-- is absent, so an unauthenticated connection simply sees nothing.
-- =============================================================================

create or replace function public.app_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

create or replace function public.app_role()
returns text
language sql
stable
as $$
  select nullif(current_setting('app.role', true), '');
$$;

create or replace function public.app_group_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.group_id', true), '')::uuid;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.app_role() = 'admin';
$$;

create or replace function public.is_coordinator()
returns boolean
language sql
stable
as $$
  select public.app_role() = 'group_it_coordinator' and public.app_group_id() is not null;
$$;

-- Which group a given employee belongs to. SECURITY DEFINER so it bypasses RLS
-- on `employees` — the policies on assignments/assets/requests need this answer
-- for people the caller cannot otherwise see.
create or replace function public.employee_group_id(p_employee_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select group_id from public.employees where id = p_employee_id;
$$;

-- True when the caller is a coordinator and the given employee is in their
-- group. The single predicate every group-scoped policy is built from.
create or replace function public.coordinator_covers(p_employee_id uuid)
returns boolean
language sql
stable
as $$
  select public.is_coordinator()
     and public.employee_group_id(p_employee_id) = public.app_group_id();
$$;

-- --------------------------------------------------------------------------
-- Authentication lookups.
--
-- These exist because of a genuine chicken-and-egg problem: signing in means
-- reading an employee row, but the policies below only reveal rows once the
-- caller is already identified. During a login attempt nobody is identified
-- yet, so an ordinary query returns nothing and every password looks wrong.
--
-- Both are SECURITY DEFINER, so they run as the owner and bypass RLS. They
-- are the only way eims_app can see an unscoped employee row, and each
-- returns strictly what its one caller needs — login_lookup is the only one
-- that exposes the password hash.
-- --------------------------------------------------------------------------

create or replace function public.login_lookup(p_username text)
returns table (
  id uuid, username text, email text, role text, group_id uuid,
  is_active boolean, password_hash text, name text, group_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.username, e.email, e.role, e.group_id,
         e.is_active, e.password_hash,
         public.employee_full_name(e.first_name, e.middle_name, e.last_name),
         g.full_name
    from public.employees e
    left join public.groups g on g.id = e.group_id
   where lower(e.username) = lower(p_username);
$$;

-- Resolving a session cookie to a user. Deliberately excludes password_hash —
-- this runs on every single request and has no reason to see it.
create or replace function public.session_lookup(p_id uuid)
returns table (
  id uuid, username text, email text, role text, group_id uuid,
  is_active boolean, name text, group_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.username, e.email, e.role, e.group_id, e.is_active,
         public.employee_full_name(e.first_name, e.middle_name, e.last_name),
         g.full_name
    from public.employees e
    left join public.groups g on g.id = e.group_id
   where e.id = p_id;
$$;


-- Called by the API at the start of every authenticated request.
create or replace function public.set_app_user(
  p_user_id uuid, p_role text, p_group_id uuid
)
returns void
language plpgsql
as $$
begin
  perform set_config('app.user_id',  coalesce(p_user_id::text, ''),  true);
  perform set_config('app.role',     coalesce(p_role, ''),           true);
  perform set_config('app.group_id', coalesce(p_group_id::text, ''), true);
end;
$$;


-- =============================================================================
-- 7. ROW LEVEL SECURITY
--
-- The real access boundary. Even if a bug in the API forgot to filter, or a
-- user crafted a request by hand, these policies still apply — the connection
-- simply cannot see rows outside its scope.
--
--   admin                 everything, read and write
--   group_it_coordinator  read-only, restricted to their own group
--   employee              read-only, restricted to themselves (+ own requests)
-- =============================================================================

alter table public.groups                enable row level security;
alter table public.cadres                enable row level security;
alter table public.designations          enable row level security;
alter table public.internal_designations enable row level security;
alter table public.employees             enable row level security;
alter table public.asset_categories      enable row level security;
alter table public.assets                enable row level security;
alter table public.assignments           enable row level security;
alter table public.asset_requests        enable row level security;


-- ---------- lookup tables ---------------------------------------------------
-- Names of groups/cadres/designations/categories are not sensitive and every
-- role needs them to render dropdowns and labels. Writes stay admin-only.

do $$
declare
  t text;
begin
  foreach t in array array['groups','cadres','designations','internal_designations','asset_categories']
  loop
    execute format('drop policy if exists "%1$s: read" on public.%1$I', t);
    execute format('drop policy if exists "%1$s: admin writes" on public.%1$I', t);

    execute format(
      'create policy "%1$s: read" on public.%1$I for select using (public.app_user_id() is not null)', t
    );
    execute format(
      'create policy "%1$s: admin writes" on public.%1$I for all
         using (public.is_admin()) with check (public.is_admin())', t
    );
  end loop;
end
$$;


-- ---------- employees -------------------------------------------------------

drop policy if exists "employees: read scoped"  on public.employees;
drop policy if exists "employees: admin writes" on public.employees;
drop policy if exists "employees: update own"   on public.employees;

-- The core of the requested hierarchy.
--
--   admin        every employee, in every group
--   coordinator  everyone in their own group, PLUS the admin and the other
--                coordinators — they need to know who their counterparts are,
--                and who to escalate to. What stays hidden is the rank-and-file
--                of other groups, which is the actual confidentiality boundary.
--   employee     only themselves
--
-- Note this widens visibility of *people* only. Inventory, assignments and
-- requests remain strictly own-group for a coordinator: seeing that another
-- coordinator exists is not the same as seeing what their group holds.
create policy "employees: read scoped"
  on public.employees for select
  using (
    public.is_admin()
    or id = public.app_user_id()
    or (
      public.is_coordinator()
      and (
        group_id = public.app_group_id()
        or role in ('admin', 'group_it_coordinator')
      )
    )
  );

create policy "employees: admin writes"
  on public.employees for all
  using (public.is_admin())
  with check (public.is_admin());

-- A coordinator manages the staff of their own group: they may add people to
-- it, edit their details, and reset their passwords.
--
-- What they may NOT do is set anyone's role or move anyone between groups —
-- that is the admin's decision, and allowing it would let a coordinator
-- promote themselves or quietly pull another group's employee into their own.
-- The INSERT check below pins new rows to role 'employee' in their own group;
-- the trigger further down pins the same fields on UPDATE.
create policy "employees: coordinator adds to own group"
  on public.employees for insert
  with check (
    public.is_coordinator()
    and group_id = public.app_group_id()
    and role = 'employee'
  );

create policy "employees: coordinator updates own group"
  on public.employees for update
  using (
    public.is_coordinator()
    and group_id = public.app_group_id()
    and role = 'employee'
  )
  with check (
    public.is_coordinator()
    and group_id = public.app_group_id()
    and role = 'employee'
  );

-- Anyone may edit their own contact details. Role, group and is_active are
-- pinned by the trigger below, so this cannot be used for self-promotion.
create policy "employees: update own"
  on public.employees for update
  using (id = public.app_user_id())
  with check (id = public.app_user_id());


-- Privilege fields are writable only by an admin. Doing this in a trigger
-- rather than a policy predicate keeps it obviously correct: the trigger sees
-- OLD and NEW directly, with no sub-select that might read a stale row.
create or replace function public.pin_privileged_employee_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- An admin may change anything.
  if public.is_admin() then
    return new;
  end if;

  -- A coordinator may maintain their own group's staff: contact details, the
  -- active flag, and a password reset. Role, group, login and PIS number stay
  -- fixed — those decide who someone *is* and what they can reach, and belong
  -- to the admin. Pinning rather than rejecting means a coordinator can send
  -- the whole employee record back without tripping over fields they can't
  -- change; the values they aren't allowed to touch simply don't move.
  if public.is_coordinator()
     and old.group_id = public.app_group_id()
     and old.role = 'employee'
  then
    new.role       := old.role;
    new.group_id   := old.group_id;
    new.username   := old.username;
    new.pis_number := old.pis_number;
    return new;
  end if;

  -- Everyone else (an employee editing their own record) may change only
  -- their contact details.
  new.role          := old.role;
  new.group_id      := old.group_id;
  new.is_active     := old.is_active;
  new.username      := old.username;
  new.password_hash := old.password_hash;
  new.pis_number    := old.pis_number;
  return new;
end;
$$;

drop trigger if exists employees_pin_privileged_fields on public.employees;
create trigger employees_pin_privileged_fields
  before update on public.employees
  for each row
  execute function public.pin_privileged_employee_fields();


-- Keep updated_at honest without the API having to remember.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists employees_touch_updated_at on public.employees;
create trigger employees_touch_updated_at
  before update on public.employees
  for each row
  execute function public.touch_updated_at();


-- ---------- assets ----------------------------------------------------------

drop policy if exists "assets: read scoped"  on public.assets;
drop policy if exists "assets: admin writes" on public.assets;

-- An employee sees an asset only while it is actively assigned to them; a
-- coordinator sees the assets actively held by anyone in their group.
create policy "assets: read scoped"
  on public.assets for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.assignments a
      where a.asset_id = assets.id
        and a.status   = 'active'
        and (
          a.employee_id = public.app_user_id()
          or public.coordinator_covers(a.employee_id)
        )
    )
  );

create policy "assets: admin writes"
  on public.assets for all
  using (public.is_admin())
  with check (public.is_admin());


-- ---------- assignments -----------------------------------------------------

drop policy if exists "assignments: read scoped"  on public.assignments;
drop policy if exists "assignments: admin writes" on public.assignments;

create policy "assignments: read scoped"
  on public.assignments for select
  using (
    public.is_admin()
    or employee_id = public.app_user_id()
    or public.coordinator_covers(employee_id)
  );

create policy "assignments: admin writes"
  on public.assignments for all
  using (public.is_admin())
  with check (public.is_admin());


-- ---------- asset_requests --------------------------------------------------

drop policy if exists "requests: read scoped"    on public.asset_requests;
drop policy if exists "requests: employee files" on public.asset_requests;
drop policy if exists "requests: admin writes"   on public.asset_requests;

create policy "requests: read scoped"
  on public.asset_requests for select
  using (
    public.is_admin()
    or employee_id = public.app_user_id()
    or public.coordinator_covers(employee_id)
  );

-- An employee may file a request only in their own name. A coordinator is
-- view-only by design, so they are not granted insert.
create policy "requests: employee files"
  on public.asset_requests for insert
  with check (
    employee_id = public.app_user_id()
    and public.app_role() = 'employee'
    and status = 'pending'
  );

create policy "requests: admin writes"
  on public.asset_requests for all
  using (public.is_admin())
  with check (public.is_admin());


-- =============================================================================
-- 8. TRANSACTIONAL OPERATIONS
--
-- Each of these touches two tables. Doing that as separate statements from the
-- API risks a half-applied state if the connection drops in between; inside a
-- function both share one transaction.
--
-- They are SECURITY INVOKER (the default) on purpose — RLS still applies, so
-- the admin check is defence in depth rather than the only gate.
-- =============================================================================

create or replace function public.assign_asset(
  p_asset_id uuid, p_employee_id uuid, p_remarks text default null
)
returns public.assignments
language plpgsql
set search_path = public
as $$
declare
  v_assignment public.assignments;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can assign assets.' using errcode = '42501';
  end if;

  -- Lock the asset so two admins assigning it at the same moment can't both
  -- pass the "is it free?" check below.
  perform 1 from public.assets where id = p_asset_id for update;
  if not found then
    raise exception 'That asset no longer exists.';
  end if;

  if exists (
    select 1 from public.assignments
    where asset_id = p_asset_id and status = 'active'
  ) then
    raise exception 'That asset is already assigned to someone.';
  end if;

  if not exists (
    select 1 from public.employees where id = p_employee_id and is_active = true
  ) then
    raise exception 'That employee is inactive or no longer exists.';
  end if;

  insert into public.assignments (asset_id, employee_id, assigned_date, status, remarks)
  values (p_asset_id, p_employee_id, current_date, 'active', nullif(trim(p_remarks), ''))
  returning * into v_assignment;

  update public.assets set status = 'assigned' where id = p_asset_id;

  return v_assignment;
end;
$$;


create or replace function public.return_assignment(
  p_assignment_id uuid, p_remarks text default null
)
returns public.assignments
language plpgsql
set search_path = public
as $$
declare
  v_assignment public.assignments;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can return assets.' using errcode = '42501';
  end if;

  update public.assignments
     set status        = 'returned',
         returned_date = current_date,
         remarks       = coalesce(nullif(trim(p_remarks), ''), remarks)
   where id = p_assignment_id
     and status = 'active'
  returning * into v_assignment;

  if not found then
    raise exception 'That assignment was not found, or it has already been returned.';
  end if;

  -- Only return it to the pool if it isn't retired or in for repair — those
  -- statuses are deliberate and shouldn't be overwritten by a return.
  update public.assets
     set status = 'available'
   where id = v_assignment.asset_id
     and status = 'assigned';

  return v_assignment;
end;
$$;


-- Resolve a request, and for an approved repair also park the asset in
-- 'under_repair' so it stops looking available on the inventory screen.
create or replace function public.resolve_request(
  p_request_id uuid, p_status text, p_remarks text default null
)
returns public.asset_requests
language plpgsql
set search_path = public
as $$
declare
  v_request public.asset_requests;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can resolve requests.' using errcode = '42501';
  end if;

  if p_status not in ('approved', 'rejected', 'completed') then
    raise exception 'Invalid request status: %', p_status;
  end if;

  update public.asset_requests
     set status        = p_status,
         admin_remarks = coalesce(nullif(trim(p_remarks), ''), admin_remarks),
         resolved_at   = now(),
         resolved_by   = public.app_user_id()
   where id = p_request_id
     and status = 'pending'
  returning * into v_request;

  if not found then
    raise exception 'That request was not found, or it has already been resolved.';
  end if;

  if v_request.request_type = 'repair' and p_status = 'approved' then
    update public.assets
       set status = 'under_repair'
     where id = v_request.asset_id
       and status = 'assigned';
  end if;

  return v_request;
end;
$$;


-- =============================================================================
-- 9. GRANTS
--
-- eims_app gets ordinary DML rights and nothing more. It owns no tables, so
-- every policy above applies to it. It cannot create, alter or drop anything.
-- =============================================================================

grant usage on schema public to eims_app;

grant select, insert, update, delete on all tables in schema public to eims_app;
grant execute on all functions in schema public to eims_app;

-- Same rights for anything added by a later migration.
alter default privileges in schema public
  grant select, insert, update, delete on tables to eims_app;
alter default privileges in schema public
  grant execute on functions to eims_app;

-- The functions the API must always be able to call, including before anyone
-- is authenticated.
grant execute on function public.set_app_user(uuid, text, uuid) to eims_app;
grant execute on function public.login_lookup(text) to eims_app;
grant execute on function public.session_lookup(uuid) to eims_app;
