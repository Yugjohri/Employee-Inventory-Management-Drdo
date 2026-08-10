/**
 * Asset requests — repairs and new-item requests raised by employees.
 *
 * Employees file and track their own; admins see everything and resolve;
 * coordinators see their group's, read-only. All three come out of the same
 * query, because RLS decides which rows exist for the caller.
 */

import { Router } from "express";

import { queryAs, withUser } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import {
  route, notFound, badRequest, forbidden, uuidParam,
  requireText, optionalText, optionalUuid, oneOf,
} from "../http.js";

export const requestRoutes = Router();

requestRoutes.use(requireAuth);

const REQUEST_SELECT = `
  select r.id, r.request_type, r.description, r.status,
         r.admin_remarks, r.created_at, r.resolved_at,
         r.asset_id, r.category_id,
         c.name as category_name,
         case when a.id is null then null else json_build_object(
           'id', a.id, 'asset_tag', a.asset_tag, 'name', a.name,
           'brand', a.brand, 'model', a.model,
           'serial_number', a.serial_number, 'status', a.status
         ) end as asset,
         json_build_object(
           'id', e.id,
           'name', public.employee_full_name(e.first_name, e.middle_name, e.last_name),
           'email', e.email, 'group_name', g.full_name
         ) as employee,
         case when rb.id is null then null else
           public.employee_full_name(rb.first_name, rb.middle_name, rb.last_name)
         end as resolved_by_name
    from public.asset_requests r
    join public.employees e on e.id = r.employee_id
    left join public.assets           a  on a.id  = r.asset_id
    left join public.asset_categories c  on c.id  = r.category_id
    left join public.groups           g  on g.id  = e.group_id
    left join public.employees        rb on rb.id = r.resolved_by
`;

/**
 * GET /api/requests             everything the caller may see
 * GET /api/requests?scope=mine  only the ones they raised
 */
requestRoutes.get(
  "/",
  route(async (req, res) => {
    const mine = req.query.scope === "mine";
    const { rows } = await queryAs(
      req.user,
      `${REQUEST_SELECT}
        ${mine ? "where r.employee_id = $1" : ""}
        order by
          case r.status when 'pending' then 0 else 1 end,
          r.created_at desc`,
      mine ? [req.user.id] : []
    );
    res.json(rows);
  })
);

/**
 * Raise a request. Employees only — a coordinator is view-only by design, and
 * an admin edits inventory directly rather than requesting it.
 */
requestRoutes.post(
  "/",
  route(async (req, res) => {
    if (req.user.role !== "employee") {
      throw forbidden("Only employees can raise requests.");
    }

    const requestType = oneOf(req.body?.request_type, ["repair", "new_asset"], "Request type");
    const description = requireText(req.body?.description, "Description", { max: 1000 });

    let assetId = null;
    let categoryId = null;

    if (requestType === "repair") {
      assetId = optionalUuid(req.body?.asset_id, "asset");
      if (!assetId) throw badRequest("Choose which asset needs repair.");

      // Confirm the asset is actually theirs. RLS would let them read an asset
      // assigned to them, but nothing stops a hand-crafted request naming an
      // id they can see for some other reason — so check ownership explicitly.
      const { rows } = await queryAs(
        req.user,
        `select 1 from public.assignments
          where asset_id = $1 and employee_id = $2 and status = 'active'`,
        [assetId, req.user.id]
      );
      if (!rows[0]) throw badRequest("That asset isn't currently assigned to you.");
    } else {
      categoryId = optionalUuid(req.body?.category_id, "category");
      if (!categoryId) throw badRequest("Choose the kind of item you need.");
    }

    const { rows } = await withUser(req.user, (client) =>
      client.query(
        `insert into public.asset_requests
           (employee_id, request_type, asset_id, category_id, description, status)
         values ($1, $2, $3, $4, $5, 'pending')
         returning id`,
        [req.user.id, requestType, assetId, categoryId, description]
      )
    );

    const created = await queryAs(req.user, `${REQUEST_SELECT} where r.id = $1`, [rows[0].id]);
    res.status(201).json(created.rows[0]);
  })
);

requestRoutes.post(
  "/:id/resolve",
  requireRole("admin"),
  route(async (req, res) => {
    const id = uuidParam(req.params.id, "request");
    const status = oneOf(req.body?.status, ["approved", "rejected", "completed"], "Status");

    await queryAs(req.user, `select * from public.resolve_request($1, $2, $3)`, [
      id, status, optionalText(req.body?.admin_remarks, { max: 1000 }),
    ]);

    const updated = await queryAs(req.user, `${REQUEST_SELECT} where r.id = $1`, [id]);
    if (!updated.rows[0]) throw notFound("That request wasn't found.");
    res.json(updated.rows[0]);
  })
);
