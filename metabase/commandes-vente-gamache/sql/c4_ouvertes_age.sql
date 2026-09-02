SELECT tranche AS "Tranche d'âge", count(*) AS "Commandes", sum(totalamt) AS "Montant"
FROM (
  SELECT h.totalamt,
    CASE WHEN current_date - h.orderdate::date <= 7   THEN '1 · 0-7 j'
         WHEN current_date - h.orderdate::date <= 30  THEN '2 · 8-30 j'
         WHEN current_date - h.orderdate::date <= 60  THEN '3 · 31-60 j'
         WHEN current_date - h.orderdate::date <= 90  THEN '4 · 61-90 j'
         WHEN current_date - h.orderdate::date <= 180 THEN '5 · 91-180 j'
         ELSE '6 · plus de 180 j' END AS tranche
  FROM raw_prextra.soheader h
  WHERE h.cieid = 2 AND h.isactive AND NOT h.isvoid
) x
GROUP BY 1
ORDER BY 1
