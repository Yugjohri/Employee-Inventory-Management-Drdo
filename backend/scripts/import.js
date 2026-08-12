/**
 * Bulk import from CSV.
 *
 *   npm run import -- employees data/staff.csv
 *   npm run import -- assets    data/hardware.csv
 *   npm run import -- employees data/staff.csv --dry-run
 *
 * Existing paper records are almost always already in a spreadsheet somewhere,
 * or can be got into one far faster than they can be typed into a web form.
 * Export that sheet as CSV and this loads it in one pass.
 *
 * Templates with the expected column names are in backend/templates/.
 *
 * Behaviour worth knowing:
 *   - **Nothing is overwritten.** A row whose employee or asset already exists
 *     is skipped, not updated. Re-running after fixing a few bad rows only adds
 *     the ones that were missing.
 *   - **A bad row doesn't stop the run.** Each is reported with its line number
 *     and the import continues, so one typo in row 400 doesn't cost you the
 *     other 399.
 *   - **--dry-run validates without writing.** Worth doing first on a big file.
 */

import fs from "node:fs/promises";
import path from "node:path";

import bcrypt from "bcryptjs";
import pg from "pg";
import "dotenv/config";

import { ownerConnection } from "../src/dbConfig.js";

const [kind, file, ...flags] = process.argv.slice(2);
const dryRun = flags.includes("--dry-run");

if (!["employees", "assets"].includes(kind) || !file) {
  console.error(`
Usage:
  npm run import -- employees <file.csv>     add people
  npm run import -- assets    <file.csv>     add hardware
  npm run import -- <kind> <file.csv> --dry-run    check the file, write nothing

Column templates: backend/templates/employees.csv and assets.csv
`);
  process.exit(1);
}

// --- CSV ---------------------------------------------------------------------

/**
 * Parse CSV into rows of strings.
 *
 * Hand-written rather than pulling in a library, because the format we need is
 * small and well defined: quoted fields, commas and newlines inside quotes, and
 * "" for a literal quote. That is what Excel and LibreOffice emit.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop blank lines — trailing newlines are common and harmless.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Rows as objects keyed by the header, with a line number for error messages. */
function readTable(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

  return rows.slice(1).map((cells, index) => {
    const record = { __line: index + 2 };            // +2: 1-based, and past the header
    headers.forEach((header, i) => {
      record[header] = (cells[i] ?? "").trim();
    });
    return record;
  });
}

// --- database ----------------------------------------------------------------

const client = new pg.Client(ownerConnection());

/** short_name -> id, for the reference tables a row can refer to by name. */
async function lookupMap(table, column = "short_name") {
  const { rows } = await client.query(`select id, ${column} as key from public.${table}`);
  return new Map(rows.map((r) => [String(r.key).toLowerCase(), r.id]));
}

const results = { added: 0, skipped: 0, failed: 0 };

function fail(row, message) {
  console.error(`  line ${row.__line}: ${message}`);
  results.failed += 1;
}

// --- employees ---------------------------------------------------------------

async function importEmployees(rows) {
  const groups = await lookupMap("groups");
  const designations = await lookupMap("designations");
  const internals = await lookupMap("internal_designations");
  const cadres = await lookupMap("cadres");
  const passwordHash = await bcrypt.hash(process.env.DEFAULT_PASSWORD || "drdo@1234", 10);

  for (const row of rows) {
    const email = (row.email || "").toLowerCase();

    if (!row.first_name || !row.last_name) {
      fail(row, "first_name and last_name are required");
      continue;
    }
    if (!email) {
      fail(row, "email is required — it is also the login");
      continue;
    }

    const role = row.role || "employee";
    if (!["admin", "group_it_coordinator", "employee"].includes(role)) {
      fail(row, `role "${role}" must be admin, group_it_coordinator or employee`);
      continue;
    }

    // Groups are named by their short name in the sheet (AI, NET, ...) because
    // nobody is going to type a uuid into a spreadsheet.
    let groupId = null;
    if (row.group) {
      groupId = groups.get(row.group.toLowerCase()) ?? null;
      if (!groupId) {
        fail(row, `group "${row.group}" doesn't exist — add it first, or check the spelling`);
        continue;
      }
    }
    if (role === "group_it_coordinator" && !groupId) {
      fail(row, "a group_it_coordinator needs a group");
      continue;
    }

    const { rows: existing } = await client.query(
      "select 1 from public.employees where username = $1 or email = $1",
      [email]
    );
    if (existing[0]) {
      results.skipped += 1;
      continue;
    }

    if (dryRun) {
      results.added += 1;
      continue;
    }

    try {
      await client.query(
        `insert into public.employees
           (first_name, middle_name, last_name, email, username, password_hash,
            pis_number, mobile, tele_no, gender, dob,
            role, group_id, cadre_id, designation_id, internal_designation_id)
         values ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          row.first_name, row.middle_name || null, row.last_name, email, passwordHash,
          row.pis_number || null, row.mobile || null, row.tele_no || null,
          row.gender || null, row.dob || null,
          role, groupId,
          cadres.get((row.cadre || "").toLowerCase()) ?? null,
          designations.get((row.designation || "").toLowerCase()) ?? null,
          internals.get((row.internal_designation || "").toLowerCase()) ?? null,
        ]
      );
      results.added += 1;
    } catch (error) {
      fail(row, error.message.split("\n")[0]);
    }
  }
}

// --- assets ------------------------------------------------------------------

async function importAssets(rows) {
  const categories = await lookupMap("asset_categories", "name");

  for (const row of rows) {
    if (!row.asset_tag || !row.name) {
      fail(row, "asset_tag and name are required");
      continue;
    }

    const { rows: existing } = await client.query(
      "select 1 from public.assets where asset_tag = $1",
      [row.asset_tag]
    );
    if (existing[0]) {
      results.skipped += 1;
      continue;
    }

    let categoryId = null;
    if (row.category) {
      categoryId = categories.get(row.category.toLowerCase()) ?? null;
      if (!categoryId) {
        fail(row, `category "${row.category}" doesn't exist — add it first`);
        continue;
      }
    }

    // "Who currently holds it" is the whole point of migrating paper records,
    // so a holder's email in the sheet creates the assignment too.
    let holderId = null;
    if (row.assigned_to) {
      const { rows: holder } = await client.query(
        "select id from public.employees where username = $1",
        [row.assigned_to.toLowerCase()]
      );
      if (!holder[0]) {
        fail(row, `assigned_to "${row.assigned_to}" isn't a known employee — import people first`);
        continue;
      }
      holderId = holder[0].id;
    }

    if (dryRun) {
      results.added += 1;
      continue;
    }

    try {
      const { rows: created } = await client.query(
        `insert into public.assets
           (asset_tag, name, brand, model, serial_number, category_id,
            status, purchase_date, warranty_expiry)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         returning id`,
        [
          row.asset_tag, row.name, row.brand || null, row.model || null,
          row.serial_number || null, categoryId,
          holderId ? "assigned" : row.status || "available",
          row.purchase_date || null, row.warranty_expiry || null,
        ]
      );

      if (holderId) {
        await client.query(
          `insert into public.assignments (asset_id, employee_id, assigned_date, status, remarks)
           values ($1, $2, coalesce($3::date, current_date), 'active', 'Imported from existing records.')`,
          [created[0].id, holderId, row.assigned_date || null]
        );
      }

      results.added += 1;
    } catch (error) {
      fail(row, error.message.split("\n")[0]);
    }
  }
}

// --- run ---------------------------------------------------------------------

try {
  const text = await fs.readFile(path.resolve(file), "utf8");
  const rows = readTable(text);

  if (rows.length === 0) {
    console.error("That file has no data rows.");
    process.exit(1);
  }

  await client.connect();
  // Importing writes people and hardware directly, so it identifies as an
  // administrator — otherwise the access policies reject it, correctly.
  await client.query("select set_config('app.role', 'admin', false)");

  console.log(`\nReading ${rows.length} rows from ${file}${dryRun ? "  (dry run)" : ""}\n`);

  if (kind === "employees") await importEmployees(rows);
  else await importAssets(rows);

  console.log(
    `\n  ${dryRun ? "would add" : "added"}: ${results.added}` +
      `   already present: ${results.skipped}` +
      `   rejected: ${results.failed}\n`
  );

  if (dryRun && results.failed === 0) {
    console.log("  Looks good. Run again without --dry-run to import.\n");
  }
  if (results.failed > 0) {
    console.log("  Fix the lines above and re-run — rows already imported are skipped.\n");
  }
} catch (error) {
  console.error("Import failed:", error.message);
  process.exit(1);
} finally {
  await client.end();
}
