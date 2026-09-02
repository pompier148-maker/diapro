SELECT count(*) AS "Commandes ouvertes"
FROM raw_prextra.soheader h
WHERE h.cieid = 2 AND h.isactive AND NOT h.isvoid
