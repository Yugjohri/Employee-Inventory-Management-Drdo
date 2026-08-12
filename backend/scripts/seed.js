/**
 * Demo data — the accounts, hardware and requests used to demonstrate the
 * system. This is the ONE file to edit if you want different demo users.
 *
 *   npm run seed
 *
 * Separate from the SQL files because passwords must be hashed, which plain
 * SQL can't do. Idempotent: an existing username is left completely untouched,
 * so re-running never resets anyone's password or duplicates a record.
 *
 * ---------------------------------------------------------------------------
 * CHANGING THE LOGINS
 * ---------------------------------------------------------------------------
 * Accounts live in the `employees` table in PostgreSQL. There are no
 * credentials in environment variables, Docker config, or anywhere else — the
 * only thing .env controls is DEFAULT_PASSWORD, the password every seeded
 * account starts with.
 *
 * To change them, either:
 *   a) edit PEOPLE below, drop the database and re-run `npm run setup`; or
 *   b) leave this alone and manage accounts in the app: sign in as the admin
 *      and use Employees → Add Employee / Reset Password. That is the normal
 *      route once the system is in use.
 *
 * `username` is what you type to sign in. It is a plain unique string, so an
 * email address works fine — that is all "email-style login" means here.
 * ---------------------------------------------------------------------------
 */

import bcrypt from "bcryptjs";
import pg from "pg";
import "dotenv/config";

import { ownerConnection } from "../src/dbConfig.js";

const password = process.env.DEFAULT_PASSWORD || "drdo@1234";

/**
 * Everyone with a login.
 *
 * The shape is deliberately flat and repetitive rather than generated — it
 * should be obvious at a glance who exists, what they can see, and how to add
 * one more.
 *
 * `group` must match a groups.short_name from 02_seed.sql (AI / NET / RAD / ADM).
 * A coordinator without a group is rejected by the database, on purpose.
 */
const PEOPLE = [
  // ---- Administrator: sees everything, everywhere -------------------------
  { username: "admin@company.com", first: "Sapna", last: "Kharwar",
    role: "admin", group: null, desig: "SF", internal: "PD" },

  // ---- Group IT Coordinators: one per group, view-only within it ---------
  { username: "itcoordinator1@company.com", first: "Priya", last: "Nair",
    role: "group_it_coordinator", group: "AI", desig: "SE", internal: "ITC" },
  { username: "itcoordinator2@company.com", first: "Anil", last: "Deshmukh",
    role: "group_it_coordinator", group: "NET", desig: "SE", internal: "ITC" },
  { username: "itcoordinator3@company.com", first: "Meera", last: "Iyer",
    role: "group_it_coordinator", group: "RAD", desig: "SE", internal: "ITC" },
  { username: "itcoordinator4@company.com", first: "Sanjay", last: "Bose",
    role: "group_it_coordinator", group: "ADM", desig: "AO", internal: "ITC" },

  // ---- AI group -----------------------------------------------------------
  { username: "employee@company.com", first: "Rahul", last: "Sharma",
    role: "employee", group: "AI", desig: "SD", internal: null },
  { username: "kavya.menon@company.com", first: "Kavya", last: "Menon",
    role: "employee", group: "AI", desig: "SC", internal: null },
  { username: "imran.qureshi@company.com", first: "Imran", last: "Qureshi",
    role: "employee", group: "AI", desig: "SD", internal: null },
  { username: "neha.gupta@company.com", first: "Neha", last: "Gupta",
    role: "employee", group: "AI", desig: "TO", internal: null },
  { username: "arjun.pillai@company.com", first: "Arjun", last: "Pillai",
    role: "employee", group: "AI", desig: "SC", internal: null },

  // ---- NET group ----------------------------------------------------------
  { username: "arun.verma@company.com", first: "Arun", last: "Verma",
    role: "employee", group: "NET", desig: "SC", internal: null },
  { username: "divya.rangan@company.com", first: "Divya", last: "Rangan",
    role: "employee", group: "NET", desig: "SD", internal: null },
  { username: "farhan.ali@company.com", first: "Farhan", last: "Ali",
    role: "employee", group: "NET", desig: "TO", internal: null },
  { username: "sneha.kulkarni@company.com", first: "Sneha", last: "Kulkarni",
    role: "employee", group: "NET", desig: "SC", internal: null },

  // ---- RAD group ----------------------------------------------------------
  { username: "rohit.chandra@company.com", first: "Rohit", last: "Chandra",
    role: "employee", group: "RAD", desig: "SD", internal: null },
  { username: "ananya.das@company.com", first: "Ananya", last: "Das",
    role: "employee", group: "RAD", desig: "SC", internal: null },
  { username: "vivek.raman@company.com", first: "Vivek", last: "Raman",
    role: "employee", group: "RAD", desig: "TO", internal: null },
  { username: "pooja.shetty@company.com", first: "Pooja", last: "Shetty",
    role: "employee", group: "RAD", desig: "SD", internal: null },

  // ---- ADM group ----------------------------------------------------------
  { username: "geeta.rane@company.com", first: "Geeta", last: "Rane",
    role: "employee", group: "ADM", desig: "AO", internal: null },
  { username: "manoj.tiwari@company.com", first: "Manoj", last: "Tiwari",
    role: "employee", group: "ADM", desig: "AO", internal: null },
  { username: "leela.krishnan@company.com", first: "Leela", last: "Krishnan",
    role: "employee", group: "ADM", desig: "AO", internal: null },
];

/**
 * Hardware. `holder` is a username from PEOPLE, or null to leave it in the
 * available pool. Anything with a holder is issued to them on the given date.
 */
const ASSETS = [
  // tag,     name,                  brand,    model,      serial,         category,     purchased,    warranty,     holder
  ["AT-0001", 'MacBook Pro 14"',     "Apple",  "M3 Pro",   "C02XK1ABCD01", "Laptop",     "2024-02-11", "2027-02-11", "employee@company.com"],
  ["AT-0002", 'Dell UltraSharp 27"', "Dell",   "U2723QE",  "CN0ABCD1234",  "Monitor",    "2024-03-02", "2026-09-30", "employee@company.com"],
  ["AT-0003", "ThinkPad X1 Carbon",  "Lenovo", "Gen 11",   "LR0ZZ9981X",   "Laptop",     "2023-11-20", "2026-11-20", "kavya.menon@company.com"],
  ["AT-0004", "HP EliteBook 840",    "HP",     "G10",      "HP5514XK92",   "Laptop",     "2025-01-15", "2028-01-15", "imran.qureshi@company.com"],
  ["AT-0005", "Cisco Catalyst 2960", "Cisco",  "WS-C2960", "FOC1932X0AB",  "Networking", "2024-08-05", "2027-08-05", null],
  ["AT-0006", "Dell Latitude 5440",  "Dell",   "5440",     "DL5440X1102",  "Laptop",     "2024-06-18", "2027-06-18", "neha.gupta@company.com"],
  ["AT-0007", 'LG 24" Monitor',      "LG",     "24MK600",  "LG24MK7781",   "Monitor",    "2023-09-12", "2026-09-12", "arjun.pillai@company.com"],
  ["AT-0008", "ThinkPad T14",        "Lenovo", "Gen 4",    "LT14G4R2290",  "Laptop",     "2024-11-03", "2027-11-03", "arun.verma@company.com"],
  ["AT-0009", "Cisco ISR 4331",      "Cisco",  "ISR4331",  "FDO2140A1BX",  "Networking", "2023-05-22", "2026-05-22", "divya.rangan@company.com"],
  ["AT-0010", "Samsung Galaxy Tab",  "Samsung","Tab S9",   "SMX710KQ55",   "Tablet",     "2025-02-08", "2028-02-08", "farhan.ali@company.com"],
  ["AT-0011", "HP ProBook 450",      "HP",     "G10",      "HP450G10ZZ1",  "Laptop",     "2024-04-19", "2027-04-19", "sneha.kulkarni@company.com"],
  ["AT-0012", "Dell Precision 3580", "Dell",   "3580",     "DP3580QW44",   "Laptop",     "2024-09-30", "2027-09-30", "rohit.chandra@company.com"],
  ["AT-0013", 'BenQ 27" Monitor',    "BenQ",   "PD2700U",  "BQ27PD9931",   "Monitor",    "2023-12-01", "2026-12-01", "ananya.das@company.com"],
  ["AT-0014", "Fluke Networks Kit",  "Fluke",  "DSX-8000", "FN8000K221",   "Peripheral", "2024-07-14", "2027-07-14", "vivek.raman@company.com"],
  ["AT-0015", "ThinkPad P16",        "Lenovo", "Gen 2",    "LP16G2M0071",  "Laptop",     "2025-03-05", "2028-03-05", "pooja.shetty@company.com"],
  ["AT-0016", "HP LaserJet Pro",     "HP",     "M404dn",   "HPM404X8812",  "Peripheral", "2023-08-21", "2026-08-21", "geeta.rane@company.com"],
  ["AT-0017", "Dell OptiPlex 7010",  "Dell",   "7010",     "DO7010PL33",   "Laptop",     "2024-01-29", "2027-01-29", "manoj.tiwari@company.com"],
  ["AT-0018", "iPhone 14",           "Apple",  "A2882",    "IP14QRT7781",  "Phone",      "2024-10-11", "2026-10-11", "leela.krishnan@company.com"],
  ["AT-0019", 'Dell UltraSharp 32"', "Dell",   "U3223QE",  "CN3223ZZ01",   "Monitor",    "2025-01-08", "2028-01-08", "itcoordinator1@company.com"],
  ["AT-0020", "ThinkPad X13",        "Lenovo", "Gen 4",    "LX13G4KK55",   "Laptop",     "2024-12-16", "2027-12-16", "itcoordinator2@company.com"],
  ["AT-0021", "HP EliteDesk 800",    "HP",     "G9",       "HPED800M12",   "Laptop",     "2024-05-27", "2027-05-27", "itcoordinator3@company.com"],
  ["AT-0022", "Samsung Monitor 27",  "Samsung","S27A600",  "SM27A6X441",   "Monitor",    "2023-10-04", "2026-10-04", "itcoordinator4@company.com"],
  ["AT-0023", "Netgear Switch 24p",  "Netgear","GS324T",   "NG324TQ118",   "Networking", "2024-03-15", "2027-03-15", null],
  ["AT-0024", "Logitech MX Keys",    "Logitech","MX Keys", "LGMXK55231",   "Peripheral", "2025-04-02", "2027-04-02", null],
  ["AT-0025", "Dell Latitude 7440",  "Dell",   "7440",     "DL7440TT09",   "Laptop",     "2025-05-20", "2028-05-20", null],
  ["AT-0026", "APC UPS 1500VA",      "APC",    "SMT1500",  "APC1500X77",   "Peripheral", "2023-07-09", "2026-07-09", null],
  ["AT-0027", "iPad Air",            "Apple",  "M2",       "IPADM2K901",   "Tablet",     "2025-06-11", "2028-06-11", null],
  ["AT-0028", "Cisco AP 9120",       "Cisco",  "C9120AXI", "FGL2312B4CD",  "Networking", "2024-02-26", "2027-02-26", null],
];

/**
 * Open and resolved requests, so the queue isn't empty during a demo.
 * `asset` must currently be held by `from` for a repair request.
 */
const REQUESTS = [
  { from: "employee@company.com",       type: "repair",    asset: "AT-0002", text: "Display flickers intermittently and the HDMI port is loose.", status: "pending" },
  { from: "kavya.menon@company.com",    type: "new_asset", category: "Monitor",    text: "Second monitor needed for model training comparisons.", status: "pending" },
  { from: "arun.verma@company.com",     type: "repair",    asset: "AT-0008", text: "Battery drains within an hour; needs replacement.", status: "approved" },
  { from: "rohit.chandra@company.com",  type: "new_asset", category: "Tablet",     text: "Tablet required for field trial data capture.", status: "pending" },
  { from: "geeta.rane@company.com",     type: "repair",    asset: "AT-0016", text: "Printer jams repeatedly on duplex printing.", status: "completed" },
  { from: "divya.rangan@company.com",   type: "new_asset", category: "Peripheral", text: "Cable tester for rack commissioning work.", status: "rejected" },
];

const client = new pg.Client({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "eims",
  // Seeding writes directly, which RLS would block for a non-admin session —
  // so it runs as the owner, like migrate does.
  user: process.env.ADMIN_PGUSER || "postgres",
  password: process.env.ADMIN_PGPASSWORD || "postgres",
});

/** id lookup for the small reference tables. */
async function lookupId(table, column, value) {
  if (!value) return null;
  const { rows } = await client.query(
    `select id from public.${table} where ${column} = $1`, [value]
  );
  return rows[0]?.id ?? null;
}

async function employeeId(username) {
  const { rows } = await client.query(
    "select id from public.employees where username = $1", [username]
  );
  return rows[0]?.id ?? null;
}

async function seedPeople() {
  const passwordHash = await bcrypt.hash(password, 10);
  const cadreTech = await lookupId("cadres", "short_name", "TECH");
  const cadreAdmin = await lookupId("cadres", "short_name", "ADMIN");
  let created = 0;

  for (const [index, person] of PEOPLE.entries()) {
    if (await employeeId(person.username)) continue;

    await client.query(
      `insert into public.employees
         (pis_number, first_name, last_name, email, username, password_hash,
          role, group_id, cadre_id, designation_id, internal_designation_id,
          mobile)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        `PIS${String(index + 1).padStart(4, "0")}`,
        person.first,
        person.last,
        person.username,           // email and login are the same string here
        person.username,
        passwordHash,
        person.role,
        await lookupId("groups", "short_name", person.group),
        person.desig === "AO" ? cadreAdmin : cadreTech,
        await lookupId("designations", "short_name", person.desig),
        await lookupId("internal_designations", "short_name", person.internal),
        `98${String(10000000 + index * 137).slice(0, 8)}`,
      ]
    );
    created += 1;
  }

  console.log(`[seed] people: ${created} created, ${PEOPLE.length - created} already present`);
}

async function seedAssets() {
  let created = 0;

  for (const [tag, name, brand, model, serial, category, purchased, warranty] of ASSETS) {
    const { rows } = await client.query(
      "select id from public.assets where asset_tag = $1", [tag]
    );
    if (rows[0]) continue;

    await client.query(
      `insert into public.assets
         (asset_tag, name, brand, model, serial_number, category_id,
          status, purchase_date, warranty_expiry)
       values ($1,$2,$3,$4,$5,$6,'available',$7,$8)`,
      [tag, name, brand, model, serial,
       await lookupId("asset_categories", "name", category), purchased, warranty]
    );
    created += 1;
  }

  console.log(`[seed] assets: ${created} created`);
}

async function seedAssignments() {
  let created = 0;

  for (const row of ASSETS) {
    const [tag] = row;
    const holder = row[8];
    if (!holder) continue;

    const assetId = await lookupId("assets", "asset_tag", tag);
    const empId = await employeeId(holder);
    if (!assetId || !empId) continue;

    // The partial unique index already prevents a second active assignment on
    // the same asset; checking first keeps re-runs quiet instead of noisy.
    const { rows: open } = await client.query(
      "select 1 from public.assignments where asset_id = $1 and status = 'active'", [assetId]
    );
    if (open[0]) continue;

    await client.query(
      `insert into public.assignments (asset_id, employee_id, assigned_date, status, remarks)
       values ($1, $2, $3, 'active', 'Issued at onboarding.')`,
      [assetId, empId, row[6]]   // issued on its purchase date
    );
    await client.query("update public.assets set status = 'assigned' where id = $1", [assetId]);
    created += 1;
  }

  console.log(`[seed] assignments: ${created} created`);
}

async function seedRequests() {
  const admin = await employeeId("admin@company.com");
  let created = 0;

  for (const req of REQUESTS) {
    const empId = await employeeId(req.from);
    if (!empId) continue;

    const assetId = req.asset ? await lookupId("assets", "asset_tag", req.asset) : null;
    const categoryId = req.category
      ? await lookupId("asset_categories", "name", req.category)
      : null;

    const { rows: existing } = await client.query(
      "select 1 from public.asset_requests where employee_id = $1 and description = $2",
      [empId, req.text]
    );
    if (existing[0]) continue;

    const resolved = req.status !== "pending";

    await client.query(
      `insert into public.asset_requests
         (employee_id, request_type, asset_id, category_id, description,
          status, admin_remarks, resolved_at, resolved_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        empId, req.type, assetId, categoryId, req.text, req.status,
        resolved ? "Reviewed by IT." : null,
        resolved ? new Date() : null,
        resolved ? admin : null,
      ]
    );

    // An approved repair takes the asset out of service, the same way
    // resolve_request() does when an admin approves one in the app.
    if (req.type === "repair" && req.status === "approved" && assetId) {
      await client.query(
        "update public.assets set status = 'under_repair' where id = $1 and status = 'assigned'",
        [assetId]
      );
    }

    created += 1;
  }

  console.log(`[seed] requests: ${created} created`);
}

try {
  await client.connect();

  // Identify as an administrator for the rest of this session. Without it the
  // row-level policies reject these inserts — which is the system working as
  // intended; the seed simply has to say who it is.
  await client.query("select set_config('app.role', 'admin', false)");

  await seedPeople();
  await seedAssets();
  await seedAssignments();
  await seedRequests();

  const { rows: summary } = await client.query(`
    select g.short_name as grp,
           count(*) filter (where e.role = 'group_it_coordinator') as coordinators,
           count(*) filter (where e.role = 'employee')             as employees
      from public.employees e
      left join public.groups g on g.id = e.group_id
     where e.role <> 'admin'
     group by g.short_name
     order by g.short_name
  `);

  console.log("\n  Demo accounts — password for all of them:", password);
  console.log("  ┌────────────────────────────────┬──────────────────────┬──────────────────┐");
  console.log("  │ admin@company.com              │ Administrator        │ everything       │");
  console.log("  │ itcoordinator1@company.com     │ Group IT Coordinator │ AI group         │");
  console.log("  │ itcoordinator2@company.com     │ Group IT Coordinator │ NET group        │");
  console.log("  │ itcoordinator3@company.com     │ Group IT Coordinator │ RAD group        │");
  console.log("  │ itcoordinator4@company.com     │ Group IT Coordinator │ ADM group        │");
  console.log("  │ employee@company.com           │ Employee (AI)        │ own assets only  │");
  console.log("  └────────────────────────────────┴──────────────────────┴──────────────────┘");
  console.log("\n  Per group:");
  for (const row of summary) {
    console.log(`    ${row.grp}: ${row.coordinators} coordinator, ${row.employees} employees`);
  }
  console.log("\n  Every employee has an email-style login; see PEOPLE in this file.");
  console.log("  Change these before any real deployment.\n");
} catch (error) {
  console.error("[seed] failed:", error.message);
  process.exit(1);
} finally {
  await client.end();
}
