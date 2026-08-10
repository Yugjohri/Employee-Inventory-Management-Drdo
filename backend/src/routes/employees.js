/**
 * Employee records.
 *
 * Reads are scoped by RLS: an admin sees everyone, a Group IT Coordinator sees
 * only their own group, and an employee sees only themselves. None of the
 * queries below filter by group — they don't need to, and that's the point.
 *
 * Unlike the old Supabase setup, accounts CAN be created here. That needed the
 * service_role key before, which could never ship to a browser; with our own
 * API the password is hashed server-side and never leaves the machine.
 */

import { Router } from "express";

import { queryAs, withUser } from "../db.js";
import { hashPassword, requireAuth, requireRole } from "../auth.js";
import { config } from "../config.js";
import {
  route, notFound, badRequest, uuidParam,
  requireText, optionalText, optionalUuid, optionalDate, oneOf,
} from "../http.js";

export const employeeRoutes = Router();

employeeRoutes.use(requireAuth);

const ROLES = ["admin", "group_it_coordinator", "employee"];

const EMPLOYEE_SELECT = `
  select e.id, e.pis_number,
         e.first_name, e.middle_name, e.last_name,
         public.employee_full_name(e.first_name, e.middle_name, e.last_name) as name,
         e.email, e.mobile, e.tele_no, e.gender, e.dob,
         e.username, e.role, e.is_active, e.is_gazetted, e.created_at,
         e.group_id,                 g.short_name as group_short_name,
                                     g.full_name  as group_name,
         e.cadre_id,                 c.full_name  as cadre_name,
         e.designation_id,           d.full_name  as designation_name,
         e.internal_designation_id,  i.full_name  as internal_designation_name
    from public.employees e
    left join public.groups                g on g.id = e.group_id
    left join public.cadres                c on c.id = e.cadre_id
    left join public.designations          d on d.id = e.designation_id
    left join public.internal_designations i on i.id = e.internal_designation_id
`;

/** Fields an admin may set on create and update. */
function readEmployeeBody(body = {}) {
  const role = oneOf(body.role ?? "employee", ROLES, "Role");
  const groupId = optionalUuid(body.group_id, "group");

  // The database enforces this too; checking here produces a clearer message
  // than a constraint violation.
  if (role === "group_it_coordinator" && !groupId) {
    throw badRequest("A Group IT Coordinator must be assigned to a group.");
  }

  return {
    pis_number: optionalText(body.pis_number, { max: 50 }),
    first_name: requireText(body.first_name, "First name", { max: 50 }),
    middle_name: optionalText(body.middle_name, { max: 50 }),
    last_name: requireText(body.last_name, "Last name", { max: 50 }),
    gender: optionalText(body.gender, { max: 20 }),
    dob: optionalDate(body.dob, "Date of birth"),
    email: requireText(body.email, "Email", { max: 100 }).toLowerCase(),
    mobile: optionalText(body.mobile, { max: 15 }),
    tele_no: optionalText(body.tele_no, { max: 20 }),
    group_id: groupId,
    cadre_id: optionalUuid(body.cadre_id, "cadre"),
    designation_id: optionalUuid(body.designation_id, "designation"),
    internal_designation_id: optionalUuid(body.internal_designation_id, "internal designation"),
    is_gazetted: Boolean(body.is_gazetted),
    role,
    is_active: body.is_active === undefined ? true : Boolean(body.is_active),
  };
}

// --- read -------------------------------------------------------------------

employeeRoutes.get(
  "/",
  route(async (req, res) => {
    const { rows } = await queryAs(req.user, `${EMPLOYEE_SELECT} order by e.first_name, e.last_name`);
    res.json(rows);
  })
);

/** Active employees eligible to receive an asset — powers the assign dropdown. */
employeeRoutes.get(
  "/assignable",
  requireRole("admin"),
  route(async (req, res) => {
    const { rows } = await queryAs(
      req.user,
      `${EMPLOYEE_SELECT} where e.is_active order by e.first_name, e.last_name`
    );
    res.json(rows);
  })
);

employeeRoutes.get(
  "/:id",
  route(async (req, res) => {
    const id = uuidParam(req.params.id, "employee");
    const { rows } = await queryAs(req.user, `${EMPLOYEE_SELECT} where e.id = $1`, [id]);

    // RLS filtered it out, or it doesn't exist. Both are "not found" from
    // here — saying "forbidden" would confirm the record exists.
    if (!rows[0]) throw notFound("That employee wasn't found, or you don't have access to them.");
    res.json(rows[0]);
  })
);

/**
 * Coordinators manage staff, but only their own group's, and only as plain
 * employees. Overwriting these two fields rather than validating them means a
 * coordinator can submit the same form an admin does without being able to
 * grant a role or move someone between groups. The database pins the same
 * fields independently — this is the friendly layer, not the security one.
 */
function applyRoleLimits(user, values) {
  if (user.role === "admin") return values;

  return { ...values, role: "employee", group_id: user.group_id };
}

// --- write (admin, or coordinator within their own group) -------------------

employeeRoutes.post(
  "/",
  requireRole("admin", "group_it_coordinator"),
  route(async (req, res) => {
    const values = applyRoleLimits(req.user, readEmployeeBody(req.body));
    const username = requireText(req.body?.username, "Username", { max: 50 }).toLowerCase();
    const password = optionalText(req.body?.password) || config.defaultPassword;

    if (password.length < 8) throw badRequest("Password must be at least 8 characters.");

    const passwordHash = await hashPassword(password);

    const { rows } = await withUser(req.user, (client) =>
      client.query(
        `insert into public.employees (
           pis_number, first_name, middle_name, last_name, gender, dob,
           email, mobile, tele_no,
           group_id, cadre_id, designation_id, internal_designation_id, is_gazetted,
           username, password_hash, role, is_active
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         returning id`,
        [
          values.pis_number, values.first_name, values.middle_name, values.last_name,
          values.gender, values.dob, values.email, values.mobile, values.tele_no,
          values.group_id, values.cadre_id, values.designation_id,
          values.internal_designation_id, values.is_gazetted,
          username, passwordHash, values.role, values.is_active,
        ]
      )
    );

    const created = await queryAs(req.user, `${EMPLOYEE_SELECT} where e.id = $1`, [rows[0].id]);
    res.status(201).json(created.rows[0]);
  })
);

employeeRoutes.put(
  "/:id",
  requireRole("admin", "group_it_coordinator"),
  route(async (req, res) => {
    const id = uuidParam(req.params.id, "employee");
    const values = applyRoleLimits(req.user, readEmployeeBody(req.body));

    const { rows } = await queryAs(
      req.user,
      `update public.employees set
         pis_number = $2, first_name = $3, middle_name = $4, last_name = $5,
         gender = $6, dob = $7, email = $8, mobile = $9, tele_no = $10,
         group_id = $11, cadre_id = $12, designation_id = $13,
         internal_designation_id = $14, is_gazetted = $15,
         role = $16, is_active = $17
       where id = $1
       returning id`,
      [
        id, values.pis_number, values.first_name, values.middle_name, values.last_name,
        values.gender, values.dob, values.email, values.mobile, values.tele_no,
        values.group_id, values.cadre_id, values.designation_id,
        values.internal_designation_id, values.is_gazetted,
        values.role, values.is_active,
      ]
    );

    if (!rows[0]) throw notFound("That employee wasn't found.");

    const updated = await queryAs(req.user, `${EMPLOYEE_SELECT} where e.id = $1`, [id]);
    res.json(updated.rows[0]);
  })
);

employeeRoutes.post(
  "/:id/reset-password",
  requireRole("admin", "group_it_coordinator"),
  route(async (req, res) => {
    const id = uuidParam(req.params.id, "employee");
    const password = optionalText(req.body?.password) || config.defaultPassword;

    if (password.length < 8) throw badRequest("Password must be at least 8 characters.");

    const passwordHash = await hashPassword(password);
    const { rows } = await queryAs(
      req.user,
      `update public.employees set password_hash = $2 where id = $1 returning id`,
      [id, passwordHash]
    );

    if (!rows[0]) throw notFound("That employee wasn't found.");
    res.json({ message: "Password reset." });
  })
);
