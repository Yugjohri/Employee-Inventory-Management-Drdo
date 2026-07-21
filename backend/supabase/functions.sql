-- =============================================================================
-- AssetTrack — assignment functions
--
-- Run this ONCE in the Supabase SQL Editor, AFTER schema.sql.
-- Safe to re-run (everything is CREATE OR REPLACE).
--
-- Why these exist
-- ---------------
-- Assigning an asset touches two tables: it inserts an `assignments` row AND
-- flips the asset's status to 'assigned'. Doing that as two calls from the
-- browser means a dropped connection between them leaves the database in a
-- half-updated state (an active assignment on an asset still marked
-- available). Inside a function both statements share one transaction, so it
-- either fully happens or not at all.
--
-- They also re-check permissions server-side. RLS already blocks non-admin
-- writes, but these raise a clear message instead of a generic policy error.
-- =============================================================================


-- Assign an available asset to an active employee.
create or replace function public.assign_asset(
  p_asset_id     uuid,
  p_employee_id  uuid,
  p_remarks      text default null
)
returns public.assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.assignments;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can assign assets.' using errcode = '42501';
  end if;

  -- Lock the asset row so two admins assigning the same asset at the same
  -- moment can't both pass the "is it free?" check below.
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
    select 1 from public.profiles
    where id = p_employee_id and is_active = true
  ) then
    raise exception 'That employee is inactive or no longer exists.';
  end if;

  insert into public.assignments (asset_id, employee_id, assigned_date, status, remarks)
  values (p_asset_id, p_employee_id, current_date, 'active', nullif(trim(p_remarks), ''))
  returning * into v_assignment;

  update public.assets
     set status = 'assigned'
   where id = p_asset_id;

  return v_assignment;
end;
$$;


-- Mark an active assignment returned and put the asset back in the pool.
create or replace function public.return_assignment(
  p_assignment_id uuid,
  p_remarks       text default null
)
returns public.assignments
language plpgsql
security definer
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

  -- Only return it to the pool if it isn't retired or in for repair -- those
  -- statuses are deliberate and shouldn't be overwritten by a return.
  update public.assets
     set status = 'available'
   where id = v_assignment.asset_id
     and status = 'assigned';

  return v_assignment;
end;
$$;


-- RLS still applies to everything these functions read back; the admin check
-- inside each one is the real gate.
grant execute on function public.assign_asset(uuid, uuid, text)      to authenticated;
grant execute on function public.return_assignment(uuid, text)       to authenticated;
