/**
 * Who holds what, and the history of who held it before.
 *
 * assign/return go through the Postgres functions in 01_schema.sql rather than
 * writing two tables from here — see the comment there for why.
 */

import { Router } from "express";

import { queryAs } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { route, notFound, uuidParam, optionalText, optionalUuid, badRequest } from "../http.js";

export const assignmentRoutes = Router();

assignmentRoutes.use(requireAuth);

// Nested objects rather than flat columns, so the frontend keeps reading
// `row.asset.serial_number` and `row.employee.name` exactly as it did with
// PostgREST's embedded resources.
const ASSIGNMENT_SELECT = `
  select asg.id, asg.assigned_date, asg.returned_date, asg.status, asg.remarks,
         json_build_object(
           'id', a.id, 'asset_tag', a.asset_tag, 'name', a.name,
           'brand', a.brand, 'model', a.model, 'serial_number', a.serial_number,
           'status', a.status, 'purchase_date', a.purchase_date,
           'warranty_expiry', a.warranty_expiry,
           'category', json_build_object('id', c.id, 'name', c.name)
         ) as asset,
         json_build_object(
           'id', e.id,
           'name', public.employee_full_name(e.first_name, e.middle_name, e.last_name),
           'email', e.email, 'pis_number', e.pis_number,
           'group_id', e.group_id, 'group_name', g.full_name
         ) as employee
    from public.assignments asg
    join public.assets    a on a.id = asg.asset_id
    join public.employees e on e.id = asg.employee_id
    left join public.asset_categories c on c.id = a.category_id
    left join public.groups           g on g.id = e.group_id
`;

/**
 * GET /api/assignments            everything the caller may see
 * GET /api/assignments?scope=mine only their own, currently held
 */
assignmentRoutes.get(
  "/",
  route(async (req, res) => {
    const mine = req.query.scope === "mine";

    const { rows } = await queryAs(
      req.user,
      `${ASSIGNMENT_SELECT}
        ${mine ? "where asg.employee_id = $1 and asg.status = 'active'" : ""}
        order by asg.assigned_date desc, asg.created_at desc`,
      mine ? [req.user.id] : []
    );

    res.json(rows);
  })
);

assignmentRoutes.get(
  "/:id",
  route(async (req, res) => {
    const id = uuidParam(req.params.id, "assignment");
    const { rows } = await queryAs(req.user, `${ASSIGNMENT_SELECT} where asg.id = $1`, [id]);
    if (!rows[0]) throw notFound("This asset wasn't found, or you don't have access to it.");
    res.json(rows[0]);
  })
);

assignmentRoutes.post(
  "/",
  requireRole("admin"),
  route(async (req, res) => {
    const assetId = optionalUuid(req.body?.asset_id, "asset");
    const employeeId = optionalUuid(req.body?.employee_id, "employee");
    if (!assetId) throw badRequest("Choose an asset to assign.");
    if (!employeeId) throw badRequest("Choose an employee to assign it to.");

    // `select * from fn(...)` rather than `select fn(...)`: these functions
    // return a composite row, and selecting it as a single value hands back an
    // unparsed "(uuid,uuid,...)" string instead of usable columns.
    const { rows } = await queryAs(
      req.user,
      `select * from public.assign_asset($1, $2, $3)`,
      [assetId, employeeId, optionalText(req.body?.remarks, { max: 500 })]
    );

    const created = await queryAs(
      req.user, `${ASSIGNMENT_SELECT} where asg.id = $1`, [rows[0].id]
    );
    res.status(201).json(created.rows[0]);
  })
);

assignmentRoutes.post(
  "/:id/return",
  requireRole("admin"),
  route(async (req, res) => {
    const id = uuidParam(req.params.id, "assignment");

    await queryAs(req.user, `select * from public.return_assignment($1, $2)`, [
      id, optionalText(req.body?.remarks, { max: 500 }),
    ]);

    const updated = await queryAs(req.user, `${ASSIGNMENT_SELECT} where asg.id = $1`, [id]);
    res.json(updated.rows[0]);
  })
);
