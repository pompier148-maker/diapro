# Surveillance des commandes de vente Prextra — Gamache

Dashboard Metabase de surveillance quotidienne des commandes de vente Prextra du
Centre du Camion Gamache (`cieid = 2`), croisées avec le statut des unités au
portail Gamache Cloud. Créé le 2026-09-02 via Claude Code.

| | |
|---|---|
| Collection | « Commandes de vente — Gamache » (id 22) — https://metabase.groupegamache.com/collection/22 |
| Dashboard | « Commandes de vente Gamache — Surveillance quotidienne » (id 20) — https://metabase.groupegamache.com/dashboard/20 |
| Base | « Gamache DWH » (`database_id = 3`, Postgres) |
| Périmètre | Gamache seulement. Gamex (`cieid = 3`) volontairement exclu. |
| Fréquence visée | Abonnement courriel lun-ven 8 h (à configurer dans Metabase, voir plus bas) |

Le SQL de chaque carte est dans `sql/`. Ces fichiers sont la référence : si une
carte est modifiée dans Metabase, reporter le changement ici.

## Le cas d'affaires

Une unité vendue non-livrée dont la vente tombe à l'eau redevient « À vendre »
au portail Gamache Cloud, mais la commande de vente Prextra reste ouverte. Il
faut la voir pour la retirer. C'est la carte 1. Le reste du dashboard couvre le
suivi opérationnel (carnet ouvert, âge), le flux d'affaires (créées vs
facturées, par vendeur) et la qualité de saisie.

## Cartes

| # | Question Metabase | Fichier SQL | Rôle |
|---|---|---|---|
| 138 | KPI · Commandes ouvertes | `k1_ouvertes.sql` | compteur |
| 139 | KPI · Montant des commandes ouvertes | `k2_montant_ouvert.sql` | compteur |
| 140 | KPI · Retours et incohérences à traiter | `k3_a_traiter.sql` | compteur de la carte 1 (0 = rien à faire) |
| 141 | KPI · Nouvelles commandes (7 j) | `k4_nouvelles_7j.sql` | compteur |
| 142 | 1 · Retours et incohérences Cloud — commandes à retirer ou fermer | `c1_retours.sql` | **la carte prioritaire** |
| 143 | 2 · Nouvelles commandes — 3 derniers jours | `c2_nouvelles_3j.sql` | flux (72 h pour couvrir le lundi) |
| 144 | 3 · Commandes ouvertes — liste complète | `c3_ouvertes_liste.sql` | suivi opérationnel |
| 145 | 4 · Commandes ouvertes par tranche d'âge | `c4_ouvertes_age.sql` | suivi opérationnel |
| 146 | 5 · Flux hebdomadaire — créées vs facturées (26 semaines) | `c5_flux_hebdo.sql` | flux |
| 147 | 6 · Par vendeur — 30 derniers jours et carnet ouvert | `c6_par_vendeur.sql` | flux |
| 148 | 7 · Anomalies de saisie sur les commandes ouvertes | `c7_anomalies.sql` | qualité |
| 149 | 8 · Commandes retirées récemment (fermées sans facture, 30 j) | `c8_retirees_30j.sql` | trace des retours traités |

## Sources et fraîcheur

| Table | Contenu | Rafraîchissement |
|---|---|---|
| `raw_prextra.soheader` | entêtes de commandes (flags `isactive`, `validcommand`, `ishold`, `isvoid`) | toutes les 5 min en journée, rechargement complet à 2 h |
| `raw_prextra.customers`, `salesrep` | client, vendeur de la commande | idem |
| `raw_prextra.invheader` | factures ; `invheader.sonbr` relie une facture à sa commande | idem |
| `raw_prextra.recordlog` | journal d'audit Prextra (insert / modify / delete sur `soheader`, avec `userid` et heure, sans le champ modifié) | idem |
| `dwh.dim_product` | fiche Cloud de l'unité, **avec historique SCD** (`valid_from`, `is_current`) | chaque heure à :45 ; historique depuis le 2026-07-30 |
| `stg.status_map` | libellés français des statuts Cloud | statique |

Le `dwh.fact_sales_order_line` n'est PAS utilisé : il n'est rechargé qu'à 3 h 30.

### Modèle de statut d'une commande Prextra

Le champ `status` de `soheader` est vide. Tout passe par les flags :

| `isactive` | `validcommand` | Lecture |
|---|---|---|
| vrai | (peu importe) | commande ouverte |
| faux | vrai | fermée et facturée (une facture existe dans `invheader` dans 99 % des cas) |
| faux | faux | fermée sans facture = retirée / annulée |

### Numéro de stock

Le # stock est lu dans le champ « # BC » (`ponbr`) de la commande, avec le motif
`^\s*([A-Za-z]{1,3}-[0-9]{3,})` puis mis en majuscules. Préfixes rencontrés sur
un an : C, R, A, V, GX, B. Tous trouvés dans `dim_product.stock_id`. Les
libellés parasites (« C-37612 OPTION 1 … ») sont tolérés.

## Logique de diagnostic de la carte 1

Pour chaque commande ouverte, le statut Cloud actuel de l'unité tombe dans un
des groupes ci-dessous. Les groupes « cohérents » sont exclus de la carte.

| Groupe | Statuts Cloud | Action |
|---|---|---|
| 1 · Retour — unité redevenue à vendre | `a_vendre`, `a_vendre_mecanique`, `a_vendre_pieces`, `disponible_offre_client`, `encan`, `tente1-3`, `gx_tpm`, `preparation_vente` **et** un passage « vendu / réservé » observé dans l'historique | retirer la commande |
| 1 · Unité à vendre au Cloud (jamais vue vendue) | mêmes statuts, mais aucun passage « vendu » dans l'historique (commande antérieure au 2026-07-30, ou portail jamais mis à jour) | vérifier, probablement retirer |
| 2 · Unité annulée ou sortie du parc | `annule`, `ferme`, `demantele`, `dementelement`, `disposition_externe`, `pieces_entreposage`, `materiel_roulant` | retirer la commande |
| 3 · Unité déjà comptabilisée ou transférée | `comptabilise`, `comptabilise_walter`, `vendu`, `transfere`, `materiel_export`, `split_comptable` | fermer la commande (la vente est passée ailleurs) |
| 4 · Statut Cloud à vérifier | tout le reste (`hold_*`, `mecanique*`, `preparation`, `en_attente_*` non listés…) | regarder |
| 5 · Sans # stock / introuvable au Cloud | `ponbr` vide ou sans motif, ou aucune fiche `dim_product` | corriger la saisie |
| Cohérent (exclu) | `vendu_non_livre`, `vendu_livre`, `commande`, `en_commande`, `reserve*`, `accomodation`, `en_attente_f_and_i`, `en_attente_finalisation_achat`, `hold_attente_reglement_achat`, `en_attente_transport` | rien |

Les colonnes « Dernier passage « vendu » » et « Trajet des statuts (6 derniers) »
viennent de l'historique SCD de `dim_product`, filtré sur les vrais changements
de statut (`lag(status)`), car le SCD photographie aussi les autres champs.

Validé le 2026-09-02 : R-36188 (vendu non-livré 30 juil. → à vendre 25 août),
C-36556 et C-37853 (→ à vendre 24 août), R-37625 (→ à vendre mécanique 26 août)
sont des retours confirmés ; C-35729 portait deux commandes actives.

## Abonnement courriel et alerte (à faire dans l'interface Metabase)

Le connecteur MCP ne crée pas d'abonnements. Deux minutes dans l'interface :

1. **Dashboard 20 → icône Abonnements → Courriel** : destinataires, lun-ven, 8 h 00
   (fuseau America/Montreal). Le DWH est rafraîchi toutes les 5 min, pas de
   contrainte d'heure côté données. Cocher « Ne pas envoyer si aucun résultat »
   n'est pas souhaitable ici (les compteurs ont toujours un résultat).
2. **Question 142 → icône Alertes** : « Envoyer une alerte quand cette question
   renvoie des résultats », quotidienne ou horaire. C'est l'alerte ciblée
   « il y a un retour à traiter ». Metabase n'affiche que les 20 premières
   lignes d'une table dans un courriel ; la carte est triée pour que les
   retours (groupe 1) passent en premier.

## Limites connues

- **Historique Cloud depuis le 2026-07-30 seulement.** Pour une commande plus
  ancienne, on ne peut pas prouver qu'elle a déjà été « vendue » : elle sort en
  « jamais vue vendue ». Le problème disparaît avec le temps.
- **Usagers Prextra non résolus.** `raw_prextra.recordlog.userid` et
  `soheader.loguserid` renvoient à la table Prextra `zuser`, absente du DWH ;
  seuls 3 usagers sur 23 se résolvent via `employee.userid`. Ajouter `zuser` au
  pipeline permettrait des cartes « qui a créé / modifié / supprimé ».
- **Le journal Prextra ne dit pas quel champ a changé**, seulement qui et quand.
  Pas de détection de changement de prix ou de client sans historique dans le
  DWH (compte Metabase en lecture seule, pas de table d'instantanés possible).
- **Date d'échéance ignorée** : `duedate` = date de commande dans 40 % des cas,
  champ non géré. L'âge se calcule depuis `orderdate`.
- **Statuts « cohérents » = décision du 2026-09-02.** Si l'équipe des ventes
  considère par exemple qu'un « Hold (Walter) » avec commande ouverte est
  normal, déplacer le statut dans la liste des cohérents de `c1_retours.sql`
  et de `k3_a_traiter.sql`, puis mettre à jour les questions 142 et 140.

## Mise à jour d'une carte

1. Modifier le fichier SQL ici.
2. Recoller le SQL dans la question Metabase (éditeur natif) ou, via le
   connecteur MCP, `update_question` avec le JSON MBQL natif encodé en base64 :
   `{"lib/type":"mbql/query","database":3,"stages":[{"lib/type":"mbql.stage/native","native":"<SQL>"}]}`.
3. `k3_a_traiter.sql` est `c1_retours.sql` enveloppé dans un `count(*)` : les
   deux doivent rester synchronisés.
