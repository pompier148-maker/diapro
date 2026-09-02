WITH sem AS (
  SELECT generate_series(date_trunc('week', current_date) - interval '25 weeks', date_trunc('week', current_date), interval '1 week')::date AS semaine
),
creees AS (
  SELECT date_trunc('week', h.orderdate)::date AS semaine, count(*) AS n, sum(h.totalamt) AS montant
  FROM raw_prextra.soheader h
  WHERE h.cieid = 2 AND NOT h.isvoid AND h.orderdate >= date_trunc('week', current_date) - interval '25 weeks'
  GROUP BY 1
),
facturees AS (
  SELECT date_trunc('week', f.premiere_facture)::date AS semaine, count(*) AS n
  FROM (
    SELECT i.sonbr, min(i.invdate) AS premiere_facture
    FROM raw_prextra.invheader i
    WHERE i.cieid = 2 AND i.sonbr IS NOT NULL AND i.sonbr <> 0
    GROUP BY 1
  ) f
  WHERE f.premiere_facture >= date_trunc('week', current_date) - interval '25 weeks'
  GROUP BY 1
)
SELECT sem.semaine AS "Semaine",
       coalesce(creees.n, 0) AS "Commandes créées",
       coalesce(facturees.n, 0) AS "Commandes facturées",
       coalesce(creees.montant, 0) AS "Montant créé"
FROM sem
LEFT JOIN creees ON creees.semaine = sem.semaine
LEFT JOIN facturees ON facturees.semaine = sem.semaine
ORDER BY sem.semaine
