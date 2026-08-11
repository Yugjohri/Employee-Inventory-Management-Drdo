# Review — adopting the other team's database

**Purpose:** we were asked to follow the schema used by the other DRDO internship
team (`github.com/adi-12G/drdo-project`) so the two systems could eventually
share one database. This note records what we found when we examined it, what we
adopted, and the one issue that decided our database choice.

**Reviewed at commit** `0ecf5fd`. Every point below cites the file and line so it
can be checked directly.

**Scope note:** their project is complete and works for what it does — a staff
directory. Nothing here is a criticism of their work meeting its own goal. These
are findings about what happens if *our* application adopts their database, which
is a different question.

---

## 1. What we did adopt

Their organisational structure is sound, and we followed it. Our tables mirror
theirs one-for-one:

| Theirs | Ours |
|---|---|
| `employee` | `employees` |
| `employee_group` | `groups` |
| `cadre` | `cadres` |
| `designation` | `designations` |
| `internal_designation` | `internal_designations` |

Same relationships (`cadre → designation`, employees belong to a group), same
employee fields, and `pis_number` kept as the employee identifier. If the two
systems are ever reconciled, `pis_number` is the natural key to match people on —
it is the only business-meaningful unique column in their schema.

**We followed the schema instruction.** The rest of this note is about the
database *software* and some defects in the design, which are separate questions.

---

## 2. The decisive issue: MySQL cannot enforce the group restriction

Their project runs on **MySQL**. Ours runs on **PostgreSQL**.

Our requirement is that a Group IT Coordinator must not be able to see another
group's employees — including by editing a URL or replaying a request by hand.

PostgreSQL has **Row Level Security**: the database itself refuses to return rows
the current user is not entitled to. Our queries contain no group filter at all;
the database applies it. If a developer later writes a careless query, the data
still does not leak.

**MySQL has no equivalent feature.** On MySQL that rule has to live in
application code, where a single missing `WHERE` clause silently exposes another
group's records.

This is not theoretical. **Their backend has exactly that gap today.**

`backend/employees.py:52-70` — the endpoint that lists all staff:

```python
@employee_bp.route("/employees")
@any_user_required                       # admin OR any read-only role
def get_employees():
    cursor.execute("""
        SELECT e.*, a.id AS adgh_id
        FROM employee e
        LEFT JOIN adgh a ON e.emp_id = a.emp_id
        WHERE e.deleted = FALSE          # <- no group filter
    """)
```

`backend/decorators.py:8-12` gives their `adgh` role read access:

```python
ROLE_PERMISSIONS = {
    "admin": "admin",
    "employee": "view",
    "adgh": "view",
}
```

`adgh` (Associate Director / Group Head) is their nearest equivalent to a Group
IT Coordinator, and the `adgh` table does carry a `group_id`. But **no endpoint
anywhere filters by the caller's group** — we checked all of them. So an `adgh`
user can currently read every employee in every group.

If we adopted MySQL, we would have to build this restriction ourselves in
application code and keep it correct forever. On PostgreSQL it is enforced by the
database and covered by automated tests.

---

## 3. Defects in the schema itself

These are in the database design, so they would carry over if the schema were
adopted verbatim.

### 3.1 Login credentials stored in three separate tables

`schema.sql` defines a `password` column on **three** tables:

- `employee.password` (line 78)
- `admin.password` (line 131)
- `adgh.password` (line 110)

One person can therefore have up to three copies of their password. Their code
keeps these in sync by hand — `employees.py:11-49`, `_sync_admin_row()` — which
runs on create, update, and password reset. Any path that misses a call leaves a
stale credential behind that still works.

*Our approach:* credentials live in exactly one place, on the employee record.
A role change cannot desynchronise anything, because there is nothing to sync.

### 3.2 No uniqueness rule on usernames or email

The only `UNIQUE` constraint in the entire schema is `pis_number`
(`schema.sql:56`). `username` and `email` have none, on any of the three tables.

So two people can be given the same login. Their login code
(`auth.py:10-41`) searches `admin`, then `employee`, then `adgh`, and returns
the first match — meaning who you are authenticated as depends on table order.

*Our approach:* `username` and `email` are both `UNIQUE NOT NULL`.

### 3.3 Plaintext passwords in the seed data

`schema.sql:189` and `:193` insert passwords as plain text:

```sql
'password123'                                    -- employee
VALUES ('Administrator', 'admin', 'admin123', 'admin');   -- admin
```

These are also present in the committed database dump
(`employee_management_dump.sql`), so they are in the repository's history.

### 3.4 The login path accepts plaintext passwords

`auth.py:44-53`:

```python
def _verify_password(stored_password, password):
    if check_password_hash(stored_password, password):
        return True
    # Temporary compatibility path for legacy plain-text seeded passwords.
    if stored_password == password:
        return True
    return False
```

Because 3.3 leaves plaintext values in the table, this fallback is live, not
dormant. Anyone who reads the database can sign in as those accounts directly.

*Our approach:* passwords are bcrypt hashes only. There is no plaintext path.

### 3.5 No inventory tables

Their schema has **no** tables for assets, assignments or requests — we checked;
there are zero matches. Their project is a staff directory.

This is not a defect, and it is good news for integration: our four inventory
tables (`assets`, `assignments`, `asset_categories`, `asset_requests`) add to
theirs without colliding with anything.

---

## 4. Defects in their backend implementation

Context rather than schema, but relevant if their backend were adopted too.

### 4.1 One endpoint is broken

`groups.py:59-70` updates a group using a column that does not exist:

```python
UPDATE employee_group SET sname=%s, ...
```

The `employee_group` table declares `short_name` (`schema.sql:40`), not `sname`.
(`sname` is used on `cadre`, `designation` and `internal_designation` — the
naming is inconsistent between tables, which is likely how this arose.) Any call
to update a group fails.

### 4.2 The signing key is hardcoded

`app.py:23`:

```python
app.config["JWT_SECRET_KEY"] = "drdo-secret-key-change-in-production"
```

It is in a public repository. Anyone with it can mint a valid admin session
token for any deployment still using it.

### 4.3 The development server is used to run the application

`app.py:48` — `app.run(debug=True)`. Flask's debug server is not intended for
anything but local development; with `debug=True` it also exposes an interactive
debugger. `gunicorn` is listed in `requirements.txt` but nothing uses it.

### 4.4 The frontend can only work on one machine

`src/lib/api.js:1`:

```js
const API_BASE_URL = "http://127.0.0.1:5000";
```

`127.0.0.1` means "this computer". The address is compiled into the browser
bundle, so the application only works when the browser and the server are the
same machine. Deploying it to an intranet server for multiple users requires
changing this and the CORS list in `app.py:16-21`.

---

## 5. What this means for "one shared database"

A single shared database requires a single database engine. Theirs is MySQL,
ours is PostgreSQL, and no database is both.

| Option | Feasible | Cost |
|---|---|---|
| We move to MySQL | Yes | Lose database-level enforcement of the group rule; inherit the issues above unless fixed |
| They move to PostgreSQL | Not our call | Their project is complete |
| Separate databases, matching schemas | **Already done** | Data is reconcilable via `pis_number`; not automatic |

We have taken the third option, which is why our schema deliberately mirrors
theirs.

**Moving to MySQL later remains realistic.** Our frontend never talks to the
database — only to our API — so changing the database means changing one layer of
the backend, with no changes to any screen. Roughly a day's work.

---

## 6. Recommendation

Keep PostgreSQL for now, because:

1. It is the only one of the two that can enforce the group restriction in the
   database rather than in application code.
2. The schema instruction has been followed — same tables, same relationships,
   same identifier.
3. It runs entirely offline on the DRDO intranet, which was the original driver
   for moving off Supabase.
4. Switching to MySQL later costs about a day and touches no part of the UI.

**The question we would like answered:**

> Is the goal literally one shared physical database, or is it that employee and
> group data must stay consistent and reconcilable between the two systems?

The first forces a database-engine decision now, and means accepting that the
group restriction moves into application code. The second is already satisfied by
the current design.

If the answer is the first, we would also suggest fixing 3.1–3.4 before the two
systems share data, since those defects would then affect both.

---

## Appendix — demo accounts

For the demonstration only. These are throwaway accounts on a local database,
created by `backend/scripts/seed.js`. **They are not real credentials and must
be changed or removed before any actual deployment** — see §3.3 above for why
sample passwords left in a repository are a problem worth avoiding.

**Password for every account below:** `drdo@1234`

Application: <http://localhost:4000>

### Administrator — sees every group, and is the only role that can set roles or group placement

| Login | Name | Designation |
|---|---|---|
| `admin@company.com` | Sapna Kharwar | Scientist F |

### Group IT Coordinators — manage their own group's staff; read-only on inventory

| Login | Name | Group | Designation |
|---|---|---|---|
| `itcoordinator1@company.com` | Priya Nair | AI | Scientist E |
| `itcoordinator2@company.com` | Anil Deshmukh | NET | Scientist E |
| `itcoordinator3@company.com` | Meera Iyer | RAD | Scientist E |
| `itcoordinator4@company.com` | Sanjay Bose | ADM | Administrative Officer |

### Employees — see only their own record and their own assets

| Login | Name | Group | Designation |
|---|---|---|---|
| `employee@company.com` | Rahul Sharma | AI | Scientist D |
| `arjun.pillai@company.com` | Arjun Pillai | AI | Scientist C |
| `imran.qureshi@company.com` | Imran Qureshi | AI | Scientist D |
| `kavya.menon@company.com` | Kavya Menon | AI | Scientist C |
| `neha.gupta@company.com` | Neha Gupta | AI | Technical Officer |
| `arun.verma@company.com` | Arun Verma | NET | Scientist C |
| `divya.rangan@company.com` | Divya Rangan | NET | Scientist D |
| `farhan.ali@company.com` | Farhan Ali | NET | Technical Officer |
| `sneha.kulkarni@company.com` | Sneha Kulkarni | NET | Scientist C |
| `ananya.das@company.com` | Ananya Das | RAD | Scientist C |
| `pooja.shetty@company.com` | Pooja Shetty | RAD | Scientist D |
| `rohit.chandra@company.com` | Rohit Chandra | RAD | Scientist D |
| `vivek.raman@company.com` | Vivek Raman | RAD | Technical Officer |
| `geeta.rane@company.com` | Geeta Rane | ADM | Administrative Officer |
| `manoj.tiwari@company.com` | Manoj Tiwari | ADM | Administrative Officer |
| `leela.krishnan@company.com` | Leela Krishnan | ADM | Administrative Officer |

**21 accounts** — 1 administrator, 4 coordinators, 16 employees across 4 groups,
holding 28 assets between them.

### Suggested demonstration of the access rules

1. Sign in as `itcoordinator1@company.com` (Priya, AI) → **Group Employees**.
   She sees her five AI staff, the administrator, and the other three
   coordinators. Edit and password-reset buttons appear **only** on her own
   group's employees.
2. Sign in as `itcoordinator2@company.com` (Anil, NET) → the same page now shows
   NET staff instead. Neither coordinator can see the other's employees.
3. Sign in as `admin@company.com` → all 21, every group, with the **IT
   Coordinator** column and filter showing who reports to whom.
4. Run `npm test` in `backend/` → 21 tests, including a coordinator attempting to
   read another group's record by its ID and being refused by the database.

Step 4 is the one that matters: it demonstrates the restriction rather than
asserting it.
