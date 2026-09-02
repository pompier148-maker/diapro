-- Commandes de vente Gamache OUVERTES dont l'unité (# stock) n'est plus dans un état « vendu / réservé » au portail Gamache Cloud.
WITH so AS (
  SELECT h.sonbr, h.orderdate::date AS date_commande, h.totalamt, h.custid, h.srid, h.ponbr,
         upper(trim(substring(h.ponbr from '^\s*([A-Za-z]{1,3}-[0-9]{3,})'))) AS stock
  FROM raw_prextra.soheader h
  WHERE h.cieid = 2 AND h.isactive AND NOT h.isvoid
),
cur AS (
  SELECT p.stock_id, p.status, p.valid_from, p.product_url, p.make, p.model, p.model_year, p.sub_category
  FROM dwh.dim_product p WHERE p.is_current
),
chg AS (
  -- ne garder que les vrais changements de statut (l'historique SCD photographie aussi les autres champs)
  SELECT stock_id, status, valid_from,
         row_number() OVER (PARTITION BY stock_id ORDER BY valid_from DESC) AS rn
  FROM (
    SELECT stock_id, status, valid_from,
           lag(status) OVER (PARTITION BY stock_id ORDER BY valid_from) AS prev_status
    FROM dwh.dim_product
  ) x
  WHERE prev_status IS DISTINCT FROM status
),
hist AS (
  SELECT stock_id,
         max(valid_from) FILTER (WHERE status IN ('vendu_non_livre','vendu_livre','commande','en_commande','reserve','reserve_inspecter','reserve_pieces','reserve_en_attente_financement','en_attente_f_and_i')) AS dernier_passage_vendu,
         string_agg(status || ' (' || to_char(valid_from, 'DD Mon') || ')', ' → ' ORDER BY valid_from) FILTER (WHERE rn <= 6) AS trajet
  FROM chg
  GROUP BY stock_id
),
diag AS (
  SELECT so.*, cur.status, cur.valid_from AS statut_depuis, cur.product_url, cur.make, cur.model, cur.model_year, cur.sub_category,
         hist.dernier_passage_vendu, hist.trajet,
    CASE
      WHEN so.stock IS NULL THEN '5 · Sans numéro de stock'
      WHEN cur.stock_id IS NULL THEN '5 · Numéro de stock introuvable au Cloud'
      WHEN cur.status IN ('a_vendre','a_vendre_mecanique','a_vendre_pieces','disponible_offre_client','encan','tente1','tente2','tente3','gx_tpm','preparation_vente')
        THEN CASE WHEN hist.dernier_passage_vendu IS NOT NULL THEN '1 · Retour — unité redevenue à vendre'
                  ELSE '1 · Unité à vendre au Cloud (jamais vue vendue)' END
      WHEN cur.status IN ('annule','ferme','demantele','dementelement','disposition_externe','pieces_entreposage','materiel_roulant') THEN '2 · Unité annulée ou sortie du parc'
      WHEN cur.status IN ('comptabilise','comptabilise_walter','vendu','transfere','materiel_export','split_comptable') THEN '3 · Unité déjà comptabilisée ou transférée'
      WHEN cur.status IN ('vendu_non_livre','vendu_livre','commande','en_commande','reserve','reserve_inspecter','reserve_pieces','reserve_en_attente_financement','accomodation','en_attente_f_and_i','en_attente_finalisation_achat','hold_attente_reglement_achat','en_attente_transport') THEN NULL
      ELSE '4 · Statut Cloud à vérifier'
    END AS diagnostic
  FROM so
  LEFT JOIN cur ON cur.stock_id = so.stock
  LEFT JOIN hist ON hist.stock_id = so.stock
)
SELECT d.diagnostic AS "Diagnostic",
       d.sonbr AS "# Commande",
       d.date_commande AS "Date commande",
       (current_date - d.date_commande) AS "Âge (j)",
       coalesce(d.stock, d.ponbr) AS "# Stock",
       trim(concat_ws(' · ', d.model_year::text, nullif(trim(concat_ws(' ', d.make, d.model)), ''), d.sub_category)) AS "Unité",
       c.name AS "Client",
       s.name AS "Vendeur",
       d.totalamt AS "Montant",
       coalesce(sm.label_fr, d.status) AS "Statut Cloud",
       d.statut_depuis::date AS "Statut depuis",
       d.dernier_passage_vendu::date AS "Dernier passage « vendu »",
       d.trajet AS "Trajet des statuts (6 derniers)",
       d.product_url AS "Fiche Cloud"
FROM diag d
LEFT JOIN raw_prextra.customers c ON c.custid = d.custid
LEFT JOIN raw_prextra.salesrep s ON s.srid = d.srid
LEFT JOIN stg.status_map sm ON sm.cloud_status = d.status
WHERE d.diagnostic IS NOT NULL
ORDER BY d.diagnostic, d.date_commande, d.sonbr
