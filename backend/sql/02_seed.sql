-- =============================================================================
-- Employee Inventory Management — reference data
--
--   psql -U postgres -d eims -f 02_seed.sql
--
-- Holds only data that doesn't depend on a user account: organisational
-- lookups and the inventory carried over from the previous Supabase project.
-- Demo logins and their assignments are created by `npm run seed`, which has
-- to hash passwords and so can't be plain SQL.
--
-- Every statement is idempotent — re-running tops up what's missing without
-- duplicating or overwriting.
-- =============================================================================


-- ---------- organisation ----------------------------------------------------

insert into public.groups (short_name, full_name) values
  ('AI',  'Artificial Intelligence Group'),
  ('NET', 'Network Security Group'),
  ('RAD', 'Radar Systems Group'),
  ('ADM', 'Administration Group')
on conflict (short_name) do nothing;


insert into public.cadres (short_name, full_name) values
  ('TECH',  'Technical Cadre'),
  ('ADMIN', 'Administrative Cadre')
on conflict (short_name) do nothing;


insert into public.designations (cadre_id, short_name, full_name)
select c.id, v.short_name, v.full_name
from (values
  ('TECH',  'SF', 'Scientist F'),
  ('TECH',  'SE', 'Scientist E'),
  ('TECH',  'SD', 'Scientist D'),
  ('TECH',  'SC', 'Scientist C'),
  ('TECH',  'TO', 'Technical Officer'),
  ('ADMIN', 'AO', 'Administrative Officer')
) as v (cadre, short_name, full_name)
join public.cadres c on c.short_name = v.cadre
on conflict (short_name) do nothing;


insert into public.internal_designations (short_name, full_name) values
  ('GH',  'Group Head'),
  ('AD',  'Associate Director'),
  ('PD',  'Project Director'),
  ('ITC', 'IT Coordinator')
on conflict (short_name) do nothing;


-- ---------- inventory categories --------------------------------------------

insert into public.asset_categories (name) values
  ('Laptop'), ('Monitor'), ('Phone'), ('Tablet'), ('Peripheral'), ('Networking')
on conflict (name) do nothing;


-- NOTE: no assets, employees or assignments are created here.
--
-- This file holds only reference data — the lookup values a real deployment
-- needs on day one, before anyone has entered anything. Demo content (people,
-- hardware, assignments, requests) lives in scripts/seed.js instead, so a
-- production install can run 01 and 02 and simply skip `npm run seed`.
