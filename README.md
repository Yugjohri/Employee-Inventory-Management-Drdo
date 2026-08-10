# Employee Inventory Management

An internal system for tracking departmental hardware — what exists, who holds
it, and what people have asked for. Built for DRDO and designed to run entirely
on an intranet with **no internet access of any kind**.

**Stack:** React 18 · Vite · MUI v6 · Express · PostgreSQL

---

## Runs completely offline

This matters more than anything else here, so it is worth being explicit.

Once PostgreSQL and Node are installed and `npm ci` has been run, the
application makes **no outbound network requests at all**:

- The database is PostgreSQL on your own machine or your own intranet server.
- The API is an Express process next to it.
- The browser only ever talks to that API, at a relative `/api` path.
- There are no web fonts, CDNs, analytics, icon services or hosted images. The
  interface uses a system font stack, and the DRDO emblem is bundled.

The only step that needs internet is `npm ci`, which downloads dependencies. On
an air-gapped machine, copy the `node_modules` directories across from a machine
that has already run it — see [Installing without internet](#installing-without-internet).

> **This replaced a hosted Supabase backend.** Supabase is a cloud service
> reached over the public internet, so the application could not have worked on
> an isolated network — it could not even have signed anyone in. The database
> now runs locally, which also keeps personnel records on departmental
> infrastructure. The migration is described in
> [What changed and why](#what-changed-and-why).

---

## Quick start

**Requirements:** [Node.js](https://nodejs.org) 18+ and
[PostgreSQL](https://www.postgresql.org/download/) 14+.
Check with `node -v` and `psql --version`.

> **No PostgreSQL installed?** If you have Docker, this gets you one on the
> standard port without installing anything:
>
> ```bash
> docker run -d --name eims-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16-alpine
> ```
>
> The defaults in `.env.example` already point at it. Once the image is on the
> machine, this works offline too. Stop it with `docker stop eims-pg`, start it
> again with `docker start eims-pg`.

```bash
# 1. Backend
cd backend
npm ci
cp .env.example .env          # Windows: copy .env.example .env
```

Open `backend/.env` and set at minimum:

```
ADMIN_PGPASSWORD=<your postgres superuser password>
PGPASSWORD=<any password you choose for the app's database login>
JWT_SECRET=<a long random string>
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Then:

```bash
npm run setup                 # creates the database, applies the schema, seeds demo data
npm start                     # API on http://localhost:4000
```

```bash
# 2. Frontend (in a second terminal)
cd frontend
npm ci
npm run dev                   # http://localhost:5173
```

Open the printed URL and sign in.

### Demo logins

All accounts use the password from `DEFAULT_PASSWORD` in `backend/.env`
(`drdo@1234` by default).

| Login | Role | Sees |
|---|---|---|
| `admin@company.com` | Administrator | Everything, and can edit it |
| `itcoordinator1@company.com` | Group IT Coordinator | AI group |
| `itcoordinator2@company.com` | Group IT Coordinator | NET group |
| `itcoordinator3@company.com` | Group IT Coordinator | RAD group |
| `itcoordinator4@company.com` | Group IT Coordinator | ADM group |
| `employee@company.com` | Employee (AI group) | Only their own assets |

Every other employee also has a login of the form `first.last@company.com` —
see `PEOPLE` in `backend/scripts/seed.js` for the full list.

The seeded organisation is 4 groups, 4 coordinators and 17 employees, with
28 assets and a mix of open and resolved requests.

To see the access rules working, sign in as `itcoordinator1@company.com`, then
as `itcoordinator2@company.com`: each sees their own group's staff and nobody
else's, while both see the admin and each other.

**Change these before any real deployment.**

---

## Roles

Three roles, in order of organisational scope:

```
Administrator  →  Group IT Coordinator  →  Employee
```

- **Administrator** — sees and edits everything: all employees regardless of
  group, the whole inventory, every assignment, and the request queue. Creates
  accounts, resets passwords, and is the only role that can **assign a person
  to a group** (and so to that group's IT Coordinator) or change anyone's role.
- **Group IT Coordinator** — responsible for the people in their own group.
  They can **add, edit and reset passwords for their own group's employees**,
  and they see the hardware those people hold and the requests they've raised.
  They also see the administrator and the other coordinators, so they know who
  their counterparts are — but *not* the rank-and-file of any other group,
  which is the actual confidentiality boundary. Inventory stays strictly
  own-group: seeing that another coordinator exists does not reveal what their
  group holds.

  Two things they deliberately cannot do:
  - **Set anyone's role or group.** Otherwise a coordinator could promote
    themselves to administrator, or pull another group's employee into their
    own. Role and group placement are the administrator's decision.
  - **Touch the inventory.** They can read it; adding, editing, assigning and
    returning assets are admin-only. They manage people, not equipment.
- **Employee** — read-only, restricted to themselves. Sees their own assets and
  raises repair or new-item requests.

### How the restriction is enforced

Not in the interface. Hiding a menu item stops nobody who is willing to edit a
URL.

Every request runs inside a database transaction that first records who is
making it. PostgreSQL row-level security policies then filter every table
against that identity, so a coordinator's connection simply cannot see another
group's rows — the query returns nothing. The API applies no group filter of its
own anywhere; it doesn't need to, and that's deliberate. If a route were ever
written carelessly, the database would still refuse.

The API connects as `eims_app`, a login that owns no tables. This is load-bearing:
PostgreSQL exempts a table's *owner* from its own security policies, so
connecting as the owner would silently disable every rule.

`npm test` in `backend/` verifies this, including the cases someone would
actually try — reading another group's record by its id, replaying an admin
request as an employee, and presenting a forged session cookie.

---

## Requests

Employees raise two kinds of request, from **My Assets** or **My Requests**:

- **Repair** — for something they already hold. They pick from their own
  assets, and the serial number is filled in from the record, so it can't be
  mistyped or guessed.
- **New item** — for hardware they don't have. There's no asset record yet, so
  they choose a category.

Admins resolve requests from the **Requests** page. Approving a repair also
moves the asset to *Under Repair*, so it stops appearing as a working machine on
the inventory screens.

A person can only raise a request in their own name and only against an asset
actually assigned to them. Both are enforced server-side.

---

## Project structure

```
backend/
├── sql/
│   ├── 01_schema.sql        tables, security policies, transactional functions
│   └── 02_seed.sql          reference data only: groups, cadres, designations, categories
├── scripts/
│   ├── migrate.js           creates the database and applies the SQL
│   └── seed.js              ALL demo content: people, assets, assignments, requests
├── src/
│   ├── server.js            Express app; also serves the built frontend
│   ├── db.js                connection pool + the per-request session binding
│   ├── auth.js              password hashing, session cookie, role guards
│   ├── http.js              errors, validation helpers
│   └── routes/              auth, employees, assets, assignments, requests, lookups
└── tests/permissions.test.js

frontend/
├── index.html
├── public/drdo-logo.png
└── src/
    ├── api/                 client + one module per resource
    ├── context/             AuthContext, ToastContext
    ├── theme/theme.js       the whole design system
    ├── routes/AppRoutes.jsx
    ├── components/
    │   ├── common/          DashboardLayout, DataTable, StatCard, StatusBadge, …
    │   ├── admin/           asset / employee / assign dialogs
    │   └── requests/        request form + the shared request list
    └── pages/
        ├── Login, Forbidden, NotFound
        ├── admin/           Dashboard, Assets, Employees, Assignments, Requests
        ├── coordinator/     Dashboard, Group Employees, Group Inventory, Requests
        └── employee/        Dashboard, My Assets, Asset Details, My Requests, Profile
```

---

## Database

```
groups ─┬─ employees ─┬─ assignments ── assets ── asset_categories
        │             └─ asset_requests ─┘
cadres ─── designations
internal_designations
```

`employees` holds identity, organisational placement **and** login in one row.
Credentials live in exactly one place, so changing someone's role can never
leave a stale copy of their password behind.

The organisational tables — `groups`, `cadres`, `designations`,
`internal_designations`, and `pis_number` on the employee record — follow the
structure used by the reference DRDO project, translated to PostgreSQL idiom:
`uuid` keys rather than `INT AUTO_INCREMENT`, `timestamptz` rather than
`TIMESTAMP`, and real foreign keys.

Both SQL files are safe to re-run.

### Useful commands

```bash
cd backend
npm run setup      # migrate + seed (first-time setup)
npm run migrate    # re-apply the schema after editing sql/
npm run seed       # top up demo data; never overwrites an existing account
npm test           # permission tests — needs the database up and seeded
npm run dev        # API with auto-restart on change
```

---

## Where the accounts and demo data live

**Accounts are rows in the `employees` table in PostgreSQL.** Nowhere else.
There are no credentials in Docker config, no hard-coded users in the API, and
no auth service. The only credential-related setting in `.env` is
`DEFAULT_PASSWORD`, which is the password new and seeded accounts start with.

`username` is what you type to sign in. It's a plain unique string, so an email
address works — that is all "email-style login" means here. Passwords are stored
as bcrypt hashes and are never recoverable, only resettable.

Three ways to change the logins, in increasing order of permanence:

1. **In the app** (normal route) — sign in as the admin, go to **Employees**.
   *Add Employee* creates an account on the default password; the key icon
   resets one. Nothing to redeploy.
2. **Edit the demo data** — change the `PEOPLE` list at the top of
   `backend/scripts/seed.js`, then rebuild the database:
   ```bash
   cd backend
   psql -U postgres -c "drop database eims"   # or: docker exec eims-pg psql -U postgres -c "drop database eims"
   npm run setup
   ```
   Re-running `npm run seed` on an existing database only *adds* what's missing;
   it never overwrites an account that already exists, so drop the database if
   you want a clean slate.
3. **Change the default password** — set `DEFAULT_PASSWORD` in `backend/.env`
   before running the seed.

All demo content — people, hardware, assignments, requests — lives in
`backend/scripts/seed.js`. The SQL files contain only reference data (groups,
cadres, designations, categories), so a real deployment can run `npm run migrate`
and skip `npm run seed` entirely and start with an empty, clean system.

---

## Portability: moving the backend later

The application is deliberately arranged so the database or backend can be
replaced without rewriting the UI.

- **The frontend has exactly one network call site**, `frontend/src/api/client.js`.
  Every page goes through the resource modules in `frontend/src/api/`, which deal
  in plain objects. Nothing else in the UI knows how data is fetched.
- **The API talks to Postgres in one place**, `backend/src/db.js`, and the SQL
  lives in the route modules rather than being scattered through components.
- **The schema is plain SQL** in `backend/sql/`, with no vendor-specific
  extensions.

### If you move to Supabase

Supabase *is* PostgreSQL, so this is the easy direction:

1. Run `01_schema.sql` in the Supabase SQL editor. It is standard PostgreSQL and
   the row-level security model transfers as-is — that is the same mechanism
   Supabase uses.
2. Replace the session helpers: our policies read identity from
   `current_setting('app.user_id')`, set per request by the API. On Supabase you
   would use `auth.uid()` instead. That is a find-and-replace inside
   `app_user_id()` / `app_role()` / `app_group_id()` — the policies themselves
   don't change.
3. Point the frontend at Supabase by rewriting `api/client.js` and the six
   functions in `api/*.js`, or keep the Express API and simply change its
   connection string to the Supabase database. **The second option is far less
   work** and keeps everything else identical.

The important caveat is the one that started this migration: Supabase is only
viable if the deployment has internet access. It cannot work on an isolated
intranet.

### If you stay local

Nothing to do. Docker is a convenience for getting PostgreSQL quickly — the
application has no dependency on it, and a native PostgreSQL install is
identical from the app's point of view. Data moves with `pg_dump` /
`pg_restore` either way.

---

## Deploying on the intranet

For a single-machine deployment, Express serves the built frontend, so there is
one process plus PostgreSQL:

```bash
cd frontend && npm ci && npm run build     # writes frontend/dist
cd ../backend && npm ci && npm run setup
NODE_ENV=production npm start              # serves API + app on port 4000
```

The whole system is then at `http://<server>:4000`.

Before going live:

1. **Change every demo password**, or delete the demo accounts outright.
2. Set a fresh `JWT_SECRET`. Anyone who knows it can mint an admin session.
3. Set a real `PGPASSWORD` for the `eims_app` login.
4. If you put it behind HTTPS, the session cookie sets `Secure` automatically
   when `NODE_ENV=production`. Over plain HTTP on an isolated network it stays
   off, because a `Secure` cookie would never be sent at all.
5. Back up the database — `pg_dump eims > backup.sql`.

### Installing without internet

`npm ci` is the only step that needs the network. To install on an air-gapped
machine, run `npm ci` in `backend/` and `frontend/` on a machine that has
internet, then copy both `node_modules` directories across along with the code.
Node and PostgreSQL installers must likewise be carried over.

---

## What changed and why

The application previously used hosted Supabase — PostgreSQL, authentication and
a generated REST API, all as a cloud service.

That could not meet the offline requirement. Supabase is reached at a public
`*.supabase.co` address over the internet; with no internet, the app cannot
query, and cannot even sign a user in. There is no offline mode to fall back on.

What changed:

| | Before | Now |
|---|---|---|
| Database | Supabase (hosted) | PostgreSQL, local |
| Auth | Supabase GoTrue, email + password | bcrypt + JWT in an httpOnly cookie, username + password |
| API | PostgREST, generated | Express, ~10 endpoints |
| Access rules | PostgreSQL RLS | PostgreSQL RLS *(kept — the good part)* |
| Roles | admin, employee | admin, group_it_coordinator, employee |
| Creating accounts | Impossible in-app | Built in |
| Fonts | Google Fonts | System font stack |

Row-level security was worth keeping: it is the reason the group restriction
holds at the database rather than depending on every route remembering to filter.

Creating accounts in-app became possible for a specific reason. Under Supabase
it required the `service_role` key, which must never reach a browser — so
accounts had to be made by hand in a dashboard. With our own API the password is
hashed server-side and never leaves the machine.

The old `backend/supabase/*.sql` files were removed rather than left in place;
they describe tables that no longer exist. They remain in the git history.
