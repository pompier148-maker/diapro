SELECT coalesce(s.name, '(sans vendeur)') AS "Vendeur",
       count(*) FILTER (WHERE h.orderdate >= current_date - 30) AS "Commandes (30 j)",
       coalesce(sum(h.totalamt) FILTER (WHERE h.orderdate >= current_date - 30), 0) AS "Montant (30 j)",
       count(*) FILTER (WHERE h.isactive) AS "Ouvertes (toutes)",
       coalesce(sum(h.totalamt) FILTER (WHERE h.isactive), 0) AS "Montant ouvert",
       max(h.orderdate)::date AS "Dernière commande"
FROM raw_prextra.soheader h
LEFT JOIN raw_prextra.salesrep s ON s.srid = h.srid
WHERE h.cieid = 2 AND NOT h.isvoid AND (h.orderdate >= current_date - 30 OR h.isactive)
GROUP BY 1
ORDER BY 3 DESC, 2 DESC
