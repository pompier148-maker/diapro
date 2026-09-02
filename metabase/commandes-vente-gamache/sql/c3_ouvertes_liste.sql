WITH so AS (
  SELECT h.sonbr, h.orderdate::date AS date_commande, h.totalamt, h.custid, h.srid, h.ishold, h.validcommand, h.qonbr, h.ponbr,
         upper(trim(substring(h.ponbr from '^\s*([A-Za-z]{1,3}-[0-9]{3,})'))) AS stock
  FROM raw_prextra.soheader h
  WHERE h.cieid = 2 AND h.isactive AND NOT h.isvoid
)
SELECT so.sonbr AS "# Commande",
       so.date_commande AS "Date commande",
       (current_date - so.date_commande) AS "Âge (j)",
       c.name AS "Client",
       s.name AS "Vendeur",
       coalesce(so.stock, so.ponbr) AS "# Stock",
       trim(concat_ws(' · ', p.model_year::text, nullif(trim(concat_ws(' ', p.make, p.model)), ''), p.sub_category)) AS "Unité",
       coalesce(sm.label_fr, p.status, CASE WHEN so.stock IS NULL THEN '(sans # stock)' ELSE '(introuvable au Cloud)' END) AS "Statut Cloud",
       p.valid_from::date AS "Statut depuis",
       so.totalamt AS "Montant",
       CASE WHEN so.validcommand THEN 'Oui' ELSE '' END AS "Validée",
       CASE WHEN so.ishold THEN 'Oui' ELSE '' END AS "Hold",
       nullif(so.qonbr, 0) AS "# Soumission",
       p.product_url AS "Fiche Cloud"
FROM so
LEFT JOIN raw_prextra.customers c ON c.custid = so.custid
LEFT JOIN raw_prextra.salesrep s ON s.srid = so.srid
LEFT JOIN dwh.dim_product p ON p.stock_id = so.stock AND p.is_current
LEFT JOIN stg.status_map sm ON sm.cloud_status = p.status
WHERE so.stock IS NOT NULL  -- les commandes sans # stock sont suivies dans les cartes 1 et 7
ORDER BY so.date_commande, so.sonbr
