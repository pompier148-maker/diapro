SELECT count(*) AS "Nouvelles commandes (7 j)"
FROM raw_prextra.soheader h
WHERE h.cieid = 2 AND NOT h.isvoid AND h.createddate >= now() - interval '7 days'
