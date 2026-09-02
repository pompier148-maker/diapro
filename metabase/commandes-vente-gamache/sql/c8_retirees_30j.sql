WITH fermees AS (
  SELECT h.sonbr, h.soid, h.orderdate::date AS date_commande, h.totalamt, h.custid, h.srid, h.ponbr,
         upper(trim(substring(h.ponbr from '^\s*([A-Za-z]{1,3}-[0-9]{3,})'))) AS stock
  FROM raw_prextra.soheader h
  WHERE h.cieid = 2 AND NOT h.isactive AND NOT h.validcommand AND NOT h.isvoid
    AND NOT EXISTS (SELECT 1 FROM raw_prextra.invheader i WHERE i.cieid = h.cieid AND i.sonbr = h.sonbr)
),
derniere_modif AS (
  -- le journal Prextra (recordlog) donne la dernière action sur la commande = moment approximatif de la fermeture
  SELECT r.identid AS soid, max(r.actiondate) AS modifiee_le
  FROM raw_prextra.recordlog r
  WHERE r.tablename = 'soheader' AND r.cieid = 2 AND r.actiondate >= current_date - 30
  GROUP BY 1
)
SELECT f.sonbr AS "# Commande",
       f.date_commande AS "Date commande",
       dm.modifiee_le AS "Fermée vers le",
       c.name AS "Client",
       s.name AS "Vendeur",
       coalesce(f.stock, f.ponbr) AS "# Stock",
       coalesce(sm.label_fr, p.status) AS "Statut Cloud actuel",
       f.totalamt AS "Montant",
       p.product_url AS "Fiche Cloud"
FROM fermees f
JOIN derniere_modif dm ON dm.soid = f.soid
LEFT JOIN raw_prextra.customers c ON c.custid = f.custid
LEFT JOIN raw_prextra.salesrep s ON s.srid = f.srid
LEFT JOIN dwh.dim_product p ON p.stock_id = f.stock AND p.is_current
LEFT JOIN stg.status_map sm ON sm.cloud_status = p.status
ORDER BY dm.modifiee_le DESC
