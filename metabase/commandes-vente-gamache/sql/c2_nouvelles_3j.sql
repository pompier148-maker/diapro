WITH so AS (
  SELECT h.sonbr, h.createddate, h.totalamt, h.custid, h.srid, h.qonbr, h.isactive, h.validcommand, h.ponbr,
         upper(trim(substring(h.ponbr from '^\s*([A-Za-z]{1,3}-[0-9]{3,})'))) AS stock
  FROM raw_prextra.soheader h
  WHERE h.cieid = 2 AND NOT h.isvoid AND h.createddate >= now() - interval '3 days'
)
SELECT so.sonbr AS "# Commande",
       so.createddate AS "Créée le",
       c.name AS "Client",
       s.name AS "Vendeur",
       coalesce(so.stock, so.ponbr) AS "# Stock",
       trim(concat_ws(' · ', p.model_year::text, nullif(trim(concat_ws(' ', p.make, p.model)), ''), p.sub_category)) AS "Unité",
       coalesce(sm.label_fr, p.status, CASE WHEN so.stock IS NULL THEN '(sans # stock)' ELSE '(introuvable au Cloud)' END) AS "Statut Cloud",
       so.totalamt AS "Montant",
       CASE WHEN NOT so.isactive THEN 'Déjà fermée' WHEN so.validcommand THEN 'Validée' ELSE 'Ouverte' END AS "État Prextra",
       nullif(so.qonbr, 0) AS "# Soumission",
       p.product_url AS "Fiche Cloud"
FROM so
LEFT JOIN raw_prextra.customers c ON c.custid = so.custid
LEFT JOIN raw_prextra.salesrep s ON s.srid = so.srid
LEFT JOIN dwh.dim_product p ON p.stock_id = so.stock AND p.is_current
LEFT JOIN stg.status_map sm ON sm.cloud_status = p.status
ORDER BY so.createddate DESC
