SELECT coalesce(sum(h.totalamt), 0) AS "Montant des commandes ouvertes"
FROM raw_prextra.soheader h
WHERE h.cieid = 2 AND h.isactive AND NOT h.isvoid
