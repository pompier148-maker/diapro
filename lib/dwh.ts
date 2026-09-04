/**
 * Gamache DWH (Postgres) via l'API Metabase — usager metabase_ro, lecture seule.
 * Le SQL vit ici, côté serveur : le navigateur n'envoie qu'un numéro de stock.
 */
const MB = () => (process.env.METABASE_URL || "").replace(/\/$/, "");
const DB_ID = () => Number(process.env.METABASE_DATABASE_ID || 3);

export type DwhRows = Record<string, Record<string, unknown>[]>;

export async function runSql(sql: string): Promise<[string, string][]> {
  const key = process.env.METABASE_API_KEY;
  if (!MB() || !key) throw new Error("METABASE_URL / METABASE_API_KEY manquant");
  const r = await fetch(MB() + "/api/dataset", {
    method: "POST", headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify({ database: DB_ID(), type: "native", native: { query: sql } }),
    signal: AbortSignal.timeout(60000), cache: "no-store",
  });
  if (!r.ok) throw new Error("Metabase HTTP " + r.status);
  const j = await r.json() as { data?: { rows?: [string, string][] }; error?: string; status?: string };
  if (j.error) throw new Error(String(j.error).slice(0, 300));
  return j.data?.rows || [];
}

export function groupRows(rows: [string, string][]): DwhRows {
  const out: DwhRows = {};
  for (const [src, j] of rows) (out[src] ||= []).push(typeof j === "string" ? JSON.parse(j) : j);
  return out;
}

export async function pingDwh(): Promise<boolean> {
  try { await runSql("select 1"); return true; } catch { return false; }
}

export function dwhSql(stock: string): string {
  const k = `'${stock}'`; // validé par STOCK_RE, pas de quote possible
  return `
with s as (select ${k}::text as k)
select 'dimp' src, row_to_json(t)::text j from (select stock_id, status, status_assurance, category, sub_category, make, model, model_year, vin, odometer, asking_price, total_cost, open_wo_count, parent_stock_id, date_entered, date_modified, product_url from dwh.dim_product, s where stock_id = k and is_current) t
union all select 'xref', row_to_json(t)::text from (select stock_id, prextra_itemid, cloud_product_id, sugar_product_id, in_prextra, in_cloud, in_sugar, last_verified_at from stg.product_xref, s where stock_id = k) t
union all select 'item', row_to_json(t)::text from (select item_code, descr, item_type, item_subtype, status, is_active, cieid, created_date from stg.prextra_items, s where item_code = k) t
union all select 'wo', row_to_json(t)::text from (select wonbr, wo_type, statut, status_code, priority_code, order_date, closed_date, customer_name, wodescr, hold_reason, is_active from stg.prextra_work_orders, s where item_code = k) t
union all select 'peval', row_to_json(t)::text from (select qonbr, quality, priority, status, budget, sales_price, creation_date, last_updated from stg.prextra_product_evaluations, s where item_code = k) t
union all select 'po', row_to_json(t)::text from (select pono, po_date, vendor_name, qty, unit_price, amount, qty_received from stg.prextra_po_lines, s where item_code = k) t
union all select 'rcpt', row_to_json(t)::text from (select receive_date, vendor_name, qty_received, vend_price, freight_cost from stg.prextra_receipt_lines, s where item_code = k) t
union all select 'ap', row_to_json(t)::text from (select inv_date, vendor_name, vendor_invnbr, po_no, qty, unit_price, amount from stg.prextra_ap_invoice_lines, s where item_code = k) t
union all select 'so', row_to_json(t)::text from (select sonbr, order_date, date_shipped, customer_name, qty_ordered, qty_shipped, qty_invoiced, unit_price, amount, so_status, is_active from stg.prextra_sales_order_lines, s where item_code = k) t
union all select 'inv', row_to_json(t)::text from (select invnbr, inv_date, customer_name, qty, unit_price, amount, unit_cost, is_posted, is_paid, invoice_type from stg.prextra_invoice_lines, s where item_code = k) t
union all select 'onhand', row_to_json(t)::text from (select site_code, qty_onhand, qty_alloc, unit_cost from stg.prextra_inventory_onhand, s where item_code = k) t
union all select 'mov', row_to_json(t)::text from (select tr_date, tr_timestamp, tr_type, qty_change, unit_cost, avg_cost, wonbr, pono, sonbr, invnbr, src_program from stg.prextra_inventory_movements, s where item_code = k) t
union all select 'evcount', row_to_json(t)::text from (select count(*)::int as n from stg.cloud_product_events, s where stock_id = k) t
union all select 'jobcost', row_to_json(t)::text from (
  select lower(trim(ic.costype)) ct, max(z.descr) libelle, sum(ic.itemcost) montant
  from s cross join raw_prextra.itemscost ic join raw_prextra.items i on i.itemid = ic.itemid
  left join raw_prextra.zcodedescr z on lower(trim(z.syskeycode)) = lower(trim(ic.costype)) and z.fieldname = 'costtype' and z.langid = 2
  where i.itemcode = s.k group by 1) t
union all select 'woops', row_to_json(t)::text from (
  select w.wonbr, w.statut, w.order_date, w.closed_date, w.is_active, count(o.wooperid) ops,
         sum(o.est_prod_hours) est_h, sum(o.real_prod_hours) real_h, sum(o.real_labor_cost) labor,
         sum(o.real_burden_cost + o.real_burden_v_cost) burden, sum(o.real_sc_cost) sc,
         string_agg(distinct o.workcenter, ', ') filter (where o.real_prod_hours > 0) workcenters
  from s cross join stg.prextra_work_orders w left join stg.prextra_wo_operations o on o.wonbr = w.wonbr and o.cieid = w.cieid
  where w.item_code = s.k group by 1,2,3,4,5) t
union all select 'labor', row_to_json(t)::text from (
  select w.wonbr, count(distinct l.emplid) mecanos, sum(l.labor_hours) hours
  from s cross join stg.prextra_work_orders w join stg.prextra_wo_operations o on o.wonbr = w.wonbr and o.cieid = w.cieid join stg.prextra_labor_time l on l.wooperid = o.wooperid
  where w.item_code = s.k group by 1) t`;
}

export function negoSql(): string {
  return `
WITH o AS (
  -- une ligne par UNITÉ contenue dans l'offre : prix de l'unité = payload.offers[id], liste = products[].specs.c_prixvente_c
  SELECT e.event_id, e.event_date, p.stock_id AS stock,
         NULLIF(btrim(e.payload->>'create_cloud_c'),'') AS vendeur,
         lower(NULLIF(btrim(e.payload->>'account_name'),'')) AS client,
         NULLIF(regexp_replace(kv.value,'[^0-9.]','','g'),'')::numeric AS prix_offert,
         NULLIF(regexp_replace(pr.x->'specs'->>'c_prixvente_c','[^0-9.]','','g'),'')::numeric AS prix_liste
  FROM dwh.fact_cloud_event e
  CROSS JOIN LATERAL jsonb_each_text(CASE WHEN jsonb_typeof(e.payload->'offers')='object' THEN e.payload->'offers' ELSE '{}'::jsonb END) kv
  JOIN dwh.dim_product p ON p.product_id = kv.key AND p.is_current
  LEFT JOIN LATERAL (SELECT x FROM jsonb_array_elements(CASE WHEN jsonb_typeof(e.payload->'products')='array' THEN e.payload->'products' ELSE '[]'::jsonb END) x WHERE x->>'id' = kv.key LIMIT 1) pr ON true
  WHERE e.event_type::text = 'offer' AND e.event_date >= now() - interval '12 months'
    AND p.stock_id ~ '^[A-Z]{1,3}-[0-9]+'
), u AS (
  SELECT stock, min(event_date) AS first_offer, max(event_date) AS last_offer, count(*) AS n_offers,
         count(DISTINCT client) FILTER (WHERE client NOT IN ('.','0','-')) AS n_clients,
         -- fautes de frappe (ex. 949 950 $ pour une liste à 79 000 $) : un prix > 2,5 x la liste est ignoré
         max(prix_offert) FILTER (WHERE prix_offert > 0 AND (prix_liste IS NULL OR prix_liste <= 0 OR prix_offert <= prix_liste * 2.5)) AS best_offer,
         (array_agg(prix_liste ORDER BY event_date DESC) FILTER (WHERE prix_liste > 0))[1] AS prix_liste,
         (array_agg(vendeur ORDER BY event_date DESC) FILTER (WHERE vendeur IS NOT NULL))[1] AS vendeur
  FROM o GROUP BY stock
), inv AS (
  SELECT xr.stock_id AS stock, min(il.inv_date) AS first_inv, sum(il.amount) AS amt
  FROM dwh.fact_invoice_line il JOIN stg.product_xref xr ON xr.prextra_itemid = il.itemid
  WHERE il.inv_date >= now() - interval '13 months' AND il.glaccid <> 561
  GROUP BY 1 HAVING sum(il.amount) <> 0
), j AS (
  SELECT u.*, p.category, p.status, p.total_cost, p.date_entered, inv.first_inv, inv.amt,
         (inv.first_inv IS NOT NULL AND inv.first_inv >= u.first_offer::date) AS sold,
         CASE WHEN inv.first_inv >= u.first_offer::date THEN inv.first_inv - u.first_offer::date END AS days_to_sale,
         CASE WHEN inv.first_inv >= u.first_offer::date AND u.best_offer > 0 AND inv.amt > 0 THEN inv.amt / u.best_offer END AS inv_over_offer,
         CASE WHEN u.best_offer > 0 AND u.prix_liste > 0 THEN u.best_offer / u.prix_liste END AS offer_over_liste
  FROM u LEFT JOIN dwh.dim_product p ON p.stock_id = u.stock AND p.is_current LEFT JOIN inv ON inv.stock = u.stock
)
SELECT 'cat' AS src, row_to_json(t)::text AS j FROM (
  SELECT category, count(*) units, sum(n_offers) offers, count(*) FILTER (WHERE sold) sold,
         round(100.0 * count(*) FILTER (WHERE sold) / count(*), 1) conv_pct,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY days_to_sale) FILTER (WHERE sold) med_days,
         round((percentile_cont(0.5) WITHIN GROUP (ORDER BY inv_over_offer) FILTER (WHERE inv_over_offer IS NOT NULL))::numeric, 4) med_inv_over_offer,
         round((percentile_cont(0.5) WITHIN GROUP (ORDER BY offer_over_liste) FILTER (WHERE offer_over_liste IS NOT NULL))::numeric, 4) med_offer_over_liste,
         count(*) FILTER (WHERE inv_over_offer IS NOT NULL) n_ratio
  FROM j WHERE category IS NOT NULL GROUP BY 1 HAVING count(*) >= 3 ORDER BY 2 DESC) t
UNION ALL
SELECT 'vend', row_to_json(t)::text FROM (
  SELECT vendeur, count(*) units, sum(n_offers) offers, count(*) FILTER (WHERE sold) sold,
         round(100.0 * count(*) FILTER (WHERE sold) / count(*), 1) conv_pct,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY days_to_sale) FILTER (WHERE sold) med_days,
         round((percentile_cont(0.5) WITHIN GROUP (ORDER BY inv_over_offer) FILTER (WHERE inv_over_offer IS NOT NULL))::numeric, 4) med_inv_over_offer,
         round((percentile_cont(0.5) WITHIN GROUP (ORDER BY offer_over_liste) FILTER (WHERE offer_over_liste IS NOT NULL))::numeric, 4) med_offer_over_liste,
         count(*) FILTER (WHERE inv_over_offer IS NOT NULL) n_ratio, max(last_offer)::date last_offer
  FROM j WHERE vendeur IS NOT NULL GROUP BY 1 HAVING count(*) >= 3 ORDER BY 2 DESC) t
UNION ALL
SELECT 'unsold', row_to_json(t)::text FROM (
  SELECT stock, category, status, vendeur, n_offers, n_clients, first_offer::date first_offer, last_offer::date last_offer,
         best_offer, prix_liste, total_cost, (CURRENT_DATE - date_entered::date) AS age_days
  FROM j WHERE NOT sold AND n_offers >= 3 AND status !~ '^(vendu|comptabi|annul|ferme|transf)'
  ORDER BY n_offers DESC, last_offer DESC LIMIT 60) t
UNION ALL
SELECT 'kpi', row_to_json(t)::text FROM (
  SELECT count(*) units, sum(n_offers) offers, count(*) FILTER (WHERE sold) sold, count(DISTINCT vendeur) vendeurs,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY days_to_sale) FILTER (WHERE sold) med_days,
         round((percentile_cont(0.5) WITHIN GROUP (ORDER BY inv_over_offer) FILTER (WHERE inv_over_offer IS NOT NULL))::numeric, 4) med_inv_over_offer,
         count(*) FILTER (WHERE NOT sold AND n_offers >= 3 AND status !~ '^(vendu|comptabi|annul|ferme|transf)') stuck
  FROM j) t
UNION ALL
SELECT 'month', row_to_json(t)::text FROM (
  SELECT to_char(date_trunc('month', event_date), 'YYYY-MM') m, count(*) offers, count(DISTINCT stock) units FROM o GROUP BY 1 ORDER BY 1) t`;
}
