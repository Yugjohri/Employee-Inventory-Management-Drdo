/**
 * Permission tests.
 *
 * These exist because the access rules are the part of this system most likely
 * to be broken by an innocent-looking change, and least likely to show up when
 * you click around as an admin. Every case here is one a person could actually
 * attempt by editing a URL or replaying a request.
 *
 * Run with a database available and seeded:
 *   npm run setup && npm test
 *
 * The server is imported rather than launched, so the suite binds its own
 * ephemeral port and doesn't collide with a running dev server.
 */

import test, { before, after, describe } from "node:test";
import assert from "node:assert/strict";

import { app } from "../src/server.js";
import { pool } from "../src/db.js";

const PASSWORD = process.env.DEFAULT_PASSWORD || "drdo@1234";

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

/** Signs in and returns a fetch bound to that user's session cookie. */
async function signIn(username) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: PASSWORD }),
  });

  assert.equal(response.status, 200, `${username} could not sign in`);
  const cookie = response.headers.getSetCookie().join("; ");
  const { user } = await response.json();

  return {
    user,
    async call(path, options = {}) {
      const res = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
          cookie,
        },
      });
      const body = await res.json().catch(() => null);
      return { status: res.status, body };
    },
  };
}

const rowsOf = async (session, path) => (await session.call(path)).body.length;

const ADMIN = "admin@company.com";
const COORD_AI = "itcoordinator1@company.com";
const COORD_NET = "itcoordinator2@company.com";
const EMPLOYEE_AI = "employee@company.com";

describe("visibility is scoped by role", () => {
  test("admin sees the whole organisation", async () => {
    const admin = await signIn(ADMIN);
    const { body: everyone } = await admin.call("/employees");

    // Every seeded group must be represented, which only the admin can see.
    const groups = new Set(everyone.map((p) => p.group_short_name).filter(Boolean));
    assert.ok(groups.size >= 4, `admin should see every group, saw ${[...groups]}`);
    assert.ok(everyone.length >= 20, `admin should see everyone, saw ${everyone.length}`);
    assert.ok((await rowsOf(admin, "/assets")) >= 25);
  });

  test("coordinator sees their own group, plus admin and fellow coordinators", async () => {
    const coordinator = await signIn(COORD_AI);
    const { body } = await coordinator.call("/employees");
    const usernames = body.map((p) => p.username);

    // Own group.
    assert.ok(usernames.includes(EMPLOYEE_AI), "must see their own group's employee");

    // Leadership stays visible — they need to know their counterparts.
    assert.ok(usernames.includes(ADMIN), "must see the admin");
    assert.ok(usernames.includes(COORD_NET), "must see other coordinators");

    // The actual boundary: rank-and-file of other groups stay hidden.
    assert.ok(
      !usernames.includes("arun.verma@company.com"),
      "must NOT see another group's employee"
    );

    // Everyone they can see is either their own group, or an admin/coordinator.
    const ownGroup = body.find((p) => p.username === COORD_AI)?.group_short_name;
    for (const person of body) {
      const allowed =
        person.group_short_name === ownGroup ||
        person.role === "admin" ||
        person.role === "group_it_coordinator";
      assert.ok(allowed, `leaked ${person.username} (${person.group_short_name})`);
    }
  });

  test("coordinator's inventory stays strictly own-group", async () => {
    const coordinator = await signIn(COORD_AI);
    const { body: assignments } = await coordinator.call("/assignments");

    // Seeing that another coordinator exists must not reveal what their
    // group holds.
    for (const row of assignments) {
      assert.equal(
        row.employee.group_name,
        "Artificial Intelligence Group",
        `leaked inventory for ${row.employee.name}`
      );
    }
    assert.ok(assignments.length > 0, "coordinator should see their own group's inventory");
  });

  test("employee sees only themselves", async () => {
    const employee = await signIn(EMPLOYEE_AI);

    assert.equal(await rowsOf(employee, "/employees"), 1);
    assert.ok((await rowsOf(employee, "/assignments")) >= 1);
  });
});

describe("restrictions cannot be bypassed by direct request", () => {
  test("coordinator cannot read another group's assignment by id", async () => {
    const arun = await signIn("arun.verma@company.com");
    const coordinator = await signIn(COORD_AI);

    const [assignment] = (await arun.call("/assignments?scope=mine")).body;
    const { status } = await coordinator.call(`/assignments/${assignment.id}`);

    assert.equal(status, 404);
  });

  test("employee cannot read a colleague's assignment by id", async () => {
    const arun = await signIn("arun.verma@company.com");
    const employee = await signIn(EMPLOYEE_AI);

    const [assignment] = (await arun.call("/assignments?scope=mine")).body;
    const { status } = await employee.call(`/assignments/${assignment.id}`);

    assert.equal(status, 404);
  });

  // A coordinator maintains people, not equipment. Their write access stops
  // at the inventory — see the "coordinator may manage their own group's
  // staff" suite for what they can do.
  test("coordinator cannot change inventory", async () => {
    const coordinator = await signIn(COORD_AI);

    const asset = await coordinator.call("/assets", {
      method: "POST",
      body: JSON.stringify({ asset_tag: "SHOULD-NOT-EXIST", name: "x" }),
    });
    assert.equal(asset.status, 403);

    const assign = await coordinator.call("/assignments", {
      method: "POST",
      body: JSON.stringify({ asset_id: null, employee_id: null }),
    });
    assert.equal(assign.status, 403);
  });

  test("employee cannot reach admin endpoints", async () => {
    const employee = await signIn(EMPLOYEE_AI);

    assert.equal((await employee.call("/employees/assignable")).status, 403);
    assert.equal(
      (await employee.call("/assignments", {
        method: "POST",
        body: JSON.stringify({ asset_id: null, employee_id: null }),
      })).status,
      403
    );
  });

  test("an unauthenticated request sees nothing", async () => {
    for (const path of ["/employees", "/assets", "/assignments", "/requests"]) {
      const response = await fetch(`${baseUrl}${path}`);
      assert.equal(response.status, 401, `${path} should require a session`);
    }
  });

  test("a forged session cookie is rejected", async () => {
    const response = await fetch(`${baseUrl}/employees`, {
      headers: { cookie: "eims_session=not.a.real.token" },
    });
    assert.equal(response.status, 401);
  });
});

describe("coordinator may manage their own group's staff", () => {
  test("can edit an employee in their own group", async () => {
    const coordinator = await signIn(COORD_AI);
    const { body } = await coordinator.call("/employees");
    const target = body.find((p) => p.username === EMPLOYEE_AI);

    const updated = await coordinator.call(`/employees/${target.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...target, mobile: "9876500001" }),
    });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.mobile, "9876500001");
  });

  test("can add an employee, who lands in their own group as an employee", async () => {
    const coordinator = await signIn(COORD_AI);
    const email = `newstarter${Date.now()}@company.com`;

    const created = await coordinator.call("/employees", {
      method: "POST",
      body: JSON.stringify({
        first_name: "New", last_name: "Starter", email, username: email,
        // Attempt to grant a role and a different group — both must be ignored.
        role: "admin", group_id: null,
      }),
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.role, "employee", "role must be forced to employee");
    assert.equal(
      created.body.group_id, coordinator.user.group_id,
      "must land in the coordinator's own group"
    );
  });

  test("can reset a password in their own group", async () => {
    const coordinator = await signIn(COORD_AI);
    const { body } = await coordinator.call("/employees");
    const target = body.find((p) => p.username === "kavya.menon@company.com");

    const reset = await coordinator.call(`/employees/${target.id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    assert.equal(reset.status, 200);
  });

  test("cannot promote an employee to admin", async () => {
    const coordinator = await signIn(COORD_AI);
    const { body } = await coordinator.call("/employees");
    const target = body.find((p) => p.username === "arjun.pillai@company.com");

    const attempt = await coordinator.call(`/employees/${target.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...target, role: "admin" }),
    });

    // Either refused outright, or accepted with the role left untouched —
    // both are safe, and the database pins it regardless.
    if (attempt.status === 200) {
      assert.equal(attempt.body.role, "employee", "role must not have changed");
    } else {
      assert.ok(attempt.status >= 400);
    }
  });

  test("cannot touch another group's employee", async () => {
    const admin = await signIn(ADMIN);
    const coordinator = await signIn(COORD_AI);

    const { body: everyone } = await admin.call("/employees");
    const other = everyone.find((p) => p.username === "arun.verma@company.com");

    const attempt = await coordinator.call(`/employees/${other.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...other, first_name: "Hacked" }),
    });
    assert.ok(attempt.status >= 400, `expected refusal, got ${attempt.status}`);

    // And it really didn't change.
    const { body: after } = await admin.call(`/employees/${other.id}`);
    assert.equal(after.first_name, "Arun");
  });

  test("cannot edit another coordinator's profile", async () => {
    const admin = await signIn(ADMIN);
    const coordinator = await signIn(COORD_AI);

    const { body: everyone } = await admin.call("/employees");
    const otherCoordinator = everyone.find((p) => p.username === COORD_NET);

    const attempt = await coordinator.call(`/employees/${otherCoordinator.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...otherCoordinator, first_name: "Hacked" }),
    });
    assert.ok(attempt.status >= 400, `expected refusal, got ${attempt.status}`);

    const { body: after } = await admin.call(`/employees/${otherCoordinator.id}`);
    assert.equal(after.first_name, "Anil", "another coordinator's record must be untouched");
  });

  test("cannot reset another coordinator's password", async () => {
    const admin = await signIn(ADMIN);
    const coordinator = await signIn(COORD_AI);

    const { body: everyone } = await admin.call("/employees");
    const otherCoordinator = everyone.find((p) => p.username === COORD_NET);

    const attempt = await coordinator.call(
      `/employees/${otherCoordinator.id}/reset-password`,
      { method: "POST", body: JSON.stringify({}) }
    );
    assert.ok(attempt.status >= 400, `expected refusal, got ${attempt.status}`);

    // The decisive check: their existing password still works.
    const stillWorks = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: COORD_NET, password: PASSWORD }),
    });
    assert.equal(stillWorks.status, 200, "their password must be unchanged");
  });

  test("cannot edit the administrator", async () => {
    const admin = await signIn(ADMIN);
    const coordinator = await signIn(COORD_AI);

    const { body: everyone } = await admin.call("/employees");
    const theAdmin = everyone.find((p) => p.username === ADMIN);

    const attempt = await coordinator.call(`/employees/${theAdmin.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...theAdmin, first_name: "Hacked" }),
    });
    assert.ok(attempt.status >= 400, `expected refusal, got ${attempt.status}`);
  });

  test("still cannot touch assets", async () => {
    const coordinator = await signIn(COORD_AI);

    const create = await coordinator.call("/assets", {
      method: "POST",
      body: JSON.stringify({ asset_tag: "NOPE-1", name: "x" }),
    });
    assert.equal(create.status, 403);

    const { body: assignments } = await coordinator.call("/assignments");
    const ret = await coordinator.call(`/assignments/${assignments[0].id}/return`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    assert.equal(ret.status, 403);
  });
});

describe("requests", () => {
  test("an employee may only raise requests against their own assets", async () => {
    const employee = await signIn(EMPLOYEE_AI);
    const arun = await signIn("arun.verma@company.com");

    const [theirs] = (await arun.call("/assignments?scope=mine")).body;

    const rejected = await employee.call("/requests", {
      method: "POST",
      body: JSON.stringify({
        request_type: "repair",
        asset_id: theirs.asset.id,
        description: "not my machine",
      }),
    });

    assert.equal(rejected.status, 400);
  });

  test("a coordinator cannot raise requests", async () => {
    const coordinator = await signIn(COORD_AI);
    const { body: categories } = await coordinator.call("/categories");

    const { status } = await coordinator.call("/requests", {
      method: "POST",
      body: JSON.stringify({
        request_type: "new_asset",
        category_id: categories[0].id,
        description: "should be refused",
      }),
    });

    assert.equal(status, 403);
  });
});
