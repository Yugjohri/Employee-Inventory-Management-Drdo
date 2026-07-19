# AssetTrack — Employee Hardware Inventory Management System

An internal tool for tracking company hardware (laptops, monitors, etc.)
and who it's assigned to. Admins manage the full inventory; employees get
a read-only view of what's assigned to them.

**Stack:** React 18 · Vite · MUI v6 · Recharts · Supabase (Postgres + Auth + RLS)

---

## Quick start — running this on another machine

If the Supabase project already exists (you're just moving the code to a
new computer), this is all you need:

**Requirements:** [Node.js](https://nodejs.org) 18 or newer. Check with
`node -v`. Nothing else — no database to install, since Supabase is hosted.

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>/frontend
npm ci
cp .env.example .env      # Windows: copy .env.example .env
```

Open `.env` and paste in your two values from
**Supabase → Project Settings → Data API**:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

```bash
npm run dev
```

Open the printed localhost URL and sign in with an existing account.

### Why there's no `node_modules` in this repo

It's ~270 MB of generated files, so it's gitignored. `npm ci` rebuilds it
exactly from `package-lock.json` in a few seconds — the lockfile pins every
version, so you get an identical tree on every machine. Use `npm ci` rather
than `npm install`: it installs strictly from the lockfile instead of
re-resolving versions.

### The one thing you must carry across yourself

`.env` is **deliberately not in the repo** — it holds your Supabase keys.
Recreate it from `.env.example` on each machine. Everything else, including
all your data, lives in the hosted Supabase project and is available from
anywhere you sign in.

---

## Repo structure

```
assettrack/
├── frontend/                    # React app (Vite + MUI), talks to Supabase
│   ├── index.html
│   ├── package.json
│   ├── .env.example             # copy to .env and fill in
│   ├── public/favicon.svg
│   └── src/
│       ├── main.jsx  App.jsx
│       ├── api/                 # supabaseClient + assets/employees/assignments
│       ├── context/             # AuthContext, ToastContext
│       ├── hooks/               # useAuth, useDocumentTitle
│       ├── theme/               # theme.js — the whole design system
│       ├── utils/               # formatters, navigation, layout constants
│       ├── routes/              # AppRoutes.jsx
│       ├── components/
│       │   ├── common/          # DashboardLayout, DataTable, StatCard,
│       │   │                    # StatusBadge, EmptyState, ConfirmDialog,
│       │   │                    # PageHeader, TwoLineCell, StatusPage,
│       │   │                    # ProtectedRoute, FullPageLoader
│       │   └── admin/           # AssetCharts + the three form dialogs
│       └── pages/
│           ├── Login, Forbidden, NotFound
│           ├── admin/           # Dashboard, ManageAssets,
│           │                    # ManageEmployees, AssignmentHistory
│           └── employee/        # Dashboard, MyAssets, AssetDetails, Profile
└── backend/
    └── supabase/
        ├── schema.sql           # tables, RLS policies, signup trigger
        └── functions.sql        # atomic assign/return functions
```

---

## Setting up the real app

### Step 1 — Create your Supabase project & database

1. Go to [supabase.com](https://supabase.com) → New Project
2. Once created, open **SQL Editor** → New query
3. Paste the entire contents of `backend/supabase/schema.sql` → **Run**
4. New query again → paste `backend/supabase/functions.sql` → **Run**
   (this adds the atomic assign/return functions the Assignments page calls)
5. Go to **Table Editor** — you should see `profiles`, `asset_categories`,
   `assets`, `assignments`

### Step 2 — Create your first users

1. **Authentication → Users → Add user** → create an admin account
   (e.g. `alice.admin@company.com`)
2. Add a couple of employee accounts the same way
3. In **Table Editor → profiles**, find the admin's row and change
   `role` from `employee` to `admin`
4. (Optional) Seed sample asset assignments — see the note at the
   bottom of `schema.sql` for the exact query, using the UUIDs from
   the `profiles` table

### Step 3 — Get your API keys

**Project Settings → API** → copy:
- `Project URL`
- `anon public` key

### Step 4 — Run the frontend

```bash
cd frontend
npm install
cp .env.example .env
```

Edit `.env` and paste in your Supabase URL + anon key:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

```bash
npm run dev
```

Open the printed localhost URL, sign in with the accounts you created
in Step 2.

---

## What's built vs. what's still a placeholder

**Admin**
- Dashboard — stat cards, assets-by-category donut, assets-by-status bar
  chart, recent assignments (warranty-expiring rows highlighted amber)
- Manage Assets — search + status/category filters, add/edit modal,
  delete with confirmation
- Manage Employees — search + role/status filters, edit department, role
  and active toggle
- Assignments — full ledger with status/employee filters, Assign Asset
  modal, and Return action

**Employee**
- Dashboard, My Assets (search + category filter), Asset Details, Profile —
  strictly view-only

Both roles share one shell (dark sidebar) and the same table, badge, card
and modal components, so the product feels consistent throughout.

**Deliberately not built:** creating login accounts from inside the app.
That needs the Supabase `service_role` key, which must never ship to the
browser — accounts are created in the Supabase dashboard, and their profile
row appears in Manage Employees automatically.

## Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: AssetTrack demo + frontend + Supabase backend"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

**Important:** `.gitignore` already excludes `frontend/.env` — don't
remove that, or your Supabase keys get pushed publicly. (The anon key
is technically safe to expose since RLS protects your data, but it's
still good practice to keep `.env` out of git and let each person
set up their own.)
