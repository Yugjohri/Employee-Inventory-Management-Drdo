/**
 * Read-only reference data: groups, cadres, designations, categories.
 *
 * Every signed-in role needs these to render dropdowns and labels, and RLS
 * already allows any authenticated session to read them.
 */

import { Router } from "express";

import { queryAs } from "../db.js";
import { requireAuth } from "../auth.js";
import { route } from "../http.js";

export const lookupRoutes = Router();

// requireAuth is attached per-route rather than with router.use(). This router
// is mounted on bare "/api", so a blanket .use() would also intercept paths
// meant for the other routers — and turn a typo'd endpoint into a confusing
// 401 instead of a 404.
const list = (sql) => [
  requireAuth,
  route(async (req, res) => {
    const { rows } = await queryAs(req.user, sql);
    res.json(rows);
  }),
];

lookupRoutes.get(
  "/groups",
  ...list(`select id, short_name, full_name, is_active
          from public.groups
         where is_active
         order by short_name`)
);

lookupRoutes.get(
  "/categories",
  ...list(`select id, name from public.asset_categories order by name`)
);

lookupRoutes.get(
  "/cadres",
  ...list(`select id, short_name, full_name from public.cadres order by short_name`)
);

lookupRoutes.get(
  "/designations",
  ...list(`select d.id, d.short_name, d.full_name, d.cadre_id, c.full_name as cadre_name
          from public.designations d
          left join public.cadres c on c.id = d.cadre_id
         order by d.short_name`)
);

lookupRoutes.get(
  "/internal-designations",
  ...list(`select id, short_name, full_name from public.internal_designations order by short_name`)
);
