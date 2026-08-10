/**
 * Inventory.
 *
 * Reads are scoped by RLS: an admin sees the whole inventory, an employee sees
 * only what is actively assigned to them, and a coordinator sees what their
 * group holds.
 */

import { Router } from "express";

import { queryAs } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import {
  route, notFound, uuidParam, requireText, optionalText, optionalUuid, optionalDate, oneOf,
} from "../http.js";

export const assetRoutes = Router();

assetRoutes.use(requireAuth);

const STATUSES = ["available", "assigned", "under_repair", "retired"];

const ASSET_SELECT = `
  select a.id, a.asset_tag, a.name, a.brand, a.model, a.serial_number,
         a.status, a.purchase_date, a.warranty_expiry, a.created_at,
         a.category_id, c.name as category_name
    from public.assets a
    left join public.asset_categories c on c.id = a.category_id
`;

function readAssetBody(body = {}) {
  return {
    asset_tag: requireText(body.asset_tag, "Asset tag", { max: 50 }),
    name: requireText(body.name, "Name", { max: 120 }),
    brand: optionalText(body.brand, { max: 60 }),
    model: optionalText(body.model, { max: 60 }),
    serial_number: optionalText(body.serial_number, { max: 100 }),
    category_id: optionalUuid(body.category_id, "category"),
    status: oneOf(body.status ?? "available", STATUSES, "Status"),
    purchase_date: optionalDate(body.purchase_date, "Purchase date"),
    warranty_expiry: optionalDate(body.warranty_expiry, "Warranty expiry"),
  };
}

assetRoutes.get(
  "/",
  route(async (req, res) => {
    const { rows } = await queryAs(req.user, `${ASSET_SELECT} order by a.asset_tag`);
    res.json(rows);
  })
);

/** Assets free to hand out — powers the Assign Asset dropdown. */
assetRoutes.get(
  "/available",
  requireRole("admin"),
  route(async (req, res) => {
    const { rows } = await queryAs(
      req.user,
      `${ASSET_SELECT} where a.status = 'available' order by a.asset_tag`
    );
    res.json(rows);
  })
);

assetRoutes.get(
  "/:id",
  route(async (req, res) => {
    const id = uuidParam(req.params.id, "asset");
    const { rows } = await queryAs(req.user, `${ASSET_SELECT} where a.id = $1`, [id]);
    if (!rows[0]) throw notFound("That asset wasn't found, or you don't have access to it.");
    res.json(rows[0]);
  })
);

assetRoutes.post(
  "/",
  requireRole("admin"),
  route(async (req, res) => {
    const v = readAssetBody(req.body);
    const { rows } = await queryAs(
      req.user,
      `insert into public.assets
         (asset_tag, name, brand, model, serial_number, category_id, status, purchase_date, warranty_expiry)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning id`,
      [v.asset_tag, v.name, v.brand, v.model, v.serial_number, v.category_id,
       v.status, v.purchase_date, v.warranty_expiry]
    );

    const created = await queryAs(req.user, `${ASSET_SELECT} where a.id = $1`, [rows[0].id]);
    res.status(201).json(created.rows[0]);
  })
);

assetRoutes.put(
  "/:id",
  requireRole("admin"),
  route(async (req, res) => {
    const id = uuidParam(req.params.id, "asset");
    const v = readAssetBody(req.body);

    const { rows } = await queryAs(
      req.user,
      `update public.assets set
         asset_tag = $2, name = $3, brand = $4, model = $5, serial_number = $6,
         category_id = $7, status = $8, purchase_date = $9, warranty_expiry = $10
       where id = $1
       returning id`,
      [id, v.asset_tag, v.name, v.brand, v.model, v.serial_number, v.category_id,
       v.status, v.purchase_date, v.warranty_expiry]
    );

    if (!rows[0]) throw notFound("That asset wasn't found.");

    const updated = await queryAs(req.user, `${ASSET_SELECT} where a.id = $1`, [id]);
    res.json(updated.rows[0]);
  })
);

assetRoutes.delete(
  "/:id",
  requireRole("admin"),
  route(async (req, res) => {
    const id = uuidParam(req.params.id, "asset");
    const { rows } = await queryAs(
      req.user,
      `delete from public.assets where id = $1 returning id`,
      [id]
    );
    if (!rows[0]) throw notFound("That asset wasn't found.");
    res.status(204).end();
  })
);
