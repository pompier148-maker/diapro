WITH so AS (
  SELECT h.sonbr, h.orderdate::date AS date_commande, h.totalamt, h.custid, h.srid, h.ponbr,
         upper(trim(substring(h.ponbr from '^\s*([A-Za-z]{1,3}-[0-9]{3,})'))) AS stock
  FROM raw_prextra.soheader h
  WHERE h.cieid = 2 AND h.isactive AND NOT h.isvoid
),
dup AS (
  SELECT stock, count(*) AS n, string_agg(sonbr::text, ', ' ORDER BY sonbr) AS commandes
  FROM so WHERE stock IS NOT NULL
  GROUP BY stock HAVING count(*) > 1
),
anom AS (
  SELECT so.*, '1 · Doublon de numéro de stock' AS anomalie,
         'Doublon : ' || dup.n || ' commandes actives sur le même # stock (' || dup.commandes || ')' AS detail
  FROM so JOIN dup ON dup.stock = so.stock
  UNION ALL
  SELECT so.*, '2 · Montant à zéro', 'Montant total de la commande à 0 $'
  FROM so WHERE coalesce(so.totalamt, 0) = 0
  UNION ALL
  SELECT so.*, '3 · Sans numéro de stock', 'Champ « # BC » vide ou sans # stock reconnaissable : ' || coalesce(nullif(so.ponbr, ''), '(vide)')
  FROM so WHERE so.stock IS NULL
  UNION ALL
  SELECT so.*, '4 · Numéro de stock introuvable au Cloud', 'Aucune fiche Gamache Cloud pour ' || so.stock
  FROM so WHERE so.stock IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dwh.dim_product p WHERE p.is_current AND p.stock_id = so.stock)
  UNION ALL
  SELECT so.*, '5 · Vendeur absent, orphelin ou inactif',
         'Vendeur : ' || coalesce(s.name, '(aucun)') || CASE WHEN s.srid IS NOT NULL AND NOT s.isactive THEN ' (inactif dans Prextra)' ELSE '' END
  FROM so LEFT JOIN raw_prextra.salesrep s ON s.srid = so.srid
  WHERE s.srid IS NULL OR NOT s.isactive OR s.srcode IN ('9999', 'S/O', 's/o')
)
SELECT a.anomalie AS "Anomalie",
       a.sonbr AS "# Commande",
       a.date_commande AS "Date commande",
       (current_date - a.date_commande) AS "Âge (j)",
       c.name AS "Client",
       s.name AS "Vendeur",
       coalesce(a.stock, a.ponbr) AS "# Stock",
       a.totalamt AS "Montant",
       a.detail AS "Détail"
FROM anom a
LEFT JOIN raw_prextra.customers c ON c.custid = a.custid
LEFT JOIN raw_prextra.salesrep s ON s.srid = a.srid
ORDER BY a.anomalie, a.date_commande, a.sonbr
