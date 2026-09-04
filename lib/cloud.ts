import { MongoClient, type Db, type Document } from "mongodb";

/**
 * Gamache Cloud (MongoDB Atlas) — port fidèle des requêtes du prototype Retool.
 * Usager Atlas en LECTURE SEULE (rôle read sur la base) : aucune écriture possible depuis ce code.
 */
let clientPromise: Promise<MongoClient> | null = null;
function db(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI manquant");
  if (!clientPromise) clientPromise = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 }).connect();
  return clientPromise.then(c => c.db(process.env.MONGODB_DB || undefined));
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export async function fetchCloud(stock: string) {
  const d = await db();
  let prod = await d.collection("products").findOne({ stockId: stock });
  let via = "stockId";
  if (!prod) { prod = await d.collection("products").findOne({ "specs.transferred_to_c": stock }); via = "transferred_to"; }
  if (!prod) return { found: false };
  const pid = prod._id as unknown as string;

  const [logs, notes, evals, files, statuses, filesTotal] = await Promise.all([
    d.collection("logs").find({ tags: { $in: [stock, pid] } }).sort({ date: 1 }).limit(3000).toArray(),
    d.collection("notes").find({ product: pid }).sort({ dateEntered: 1 }).toArray(),
    d.collection("evaluations").find({ product: pid }).toArray(),
    d.collection("files").aggregate([{ $match: { referrers: stock } }, { $unwind: "$tags" }, { $group: { _id: "$tags", n: { $sum: 1 }, last: { $max: "$time.creation" } } }, { $sort: { n: -1 } }]).toArray(),
    d.collection("status").find({}, { projection: { name: 1, label: 1, category: 1 } }).toArray(),
    d.collection("files").countDocuments({ referrers: stock }),
  ]);
  const uids = [...new Set([...logs.map(l => l.user), ...notes.map(n => n.user)].filter(Boolean))];
  const users = await d.collection("users").find({ _id: { $in: uids } }, { projection: { name: 1 } }).toArray();
  const um: Record<string, string> = Object.fromEntries(users.map(u => [String(u._id), String(u.name || "").trim()]));

  const slim = (l: Document) => {
    const pl = l.payload;
    if (l.event === "offer" || l.event === "quotation") {
      // Offre multi-unités : le prix de CETTE unité est dans payload.offers[<id produit>], son prix de liste
      // au moment de l'offre dans payload.products[].specs.c_prixvente_c. prix_offert_c ne vaut que pour l'unité principale.
      const offers = isObj(pl) && isObj(pl.offers) ? pl.offers : {};
      const prods = isObj(pl) && Array.isArray(pl.products) ? (pl.products as Record<string, unknown>[]) : [];
      const me = prods.find(x => x && (x.id === pid || (isObj(x.specs) && x.specs.stockId === prod!.stockId))) || null;
      const meId = me && me.id ? String(me.id) : pid;
      const mainStock = isObj(pl) ? (pl.stock_num_c as string | undefined) || null : null;
      const isMain = !mainStock || mainStock === prod!.stockId;
      const prixUnit = offers[meId] != null ? offers[meId] : (offers[pid] != null ? offers[pid] : (isMain && isObj(pl) ? (pl.prix_offert_c || pl.prix_offer_c || null) : null));
      const meSpecs = me && isObj(me.specs) ? me.specs : null;
      const listeUnit = meSpecs && meSpecs.c_prixvente_c ? meSpecs.c_prixvente_c : (isMain && isObj(pl) ? (pl.c_prixvente_c || null) : null);
      const ci = isObj(pl) && isObj(pl.contactInfo) ? pl.contactInfo : null;
      return { date: l.date, user: um[l.user] || l.user, event: l.event, offer: {
        vendeur: isObj(pl) ? (pl.create_cloud_c || um[l.user] || null) : null,
        client: isObj(pl) ? (pl.nom_client_c || pl.account_name || (ci && (ci.name || ci.nom)) || null) : null,
        prix: prixUnit, liste: listeUnit, principal: mainStock, isMain,
        prixPrincipal: isObj(pl) ? (pl.prix_offert_c || null) : null,
        statut: isObj(pl) ? (pl.statut_opportunite_c || null) : null,
        stocks: prods.map(x => x && isObj(x.specs) && x.specs.stockId).filter(Boolean) } };
    }
    let ch: unknown = pl;
    if (isObj(pl)) { const o: Record<string, unknown> = {}; for (const k of Object.keys(pl)) { const v = pl[k]; if (typeof v === "string" && v.length > 300) o[k] = v.slice(0, 300) + "…"; else if (isObj(v) || Array.isArray(v)) o[k] = JSON.stringify(v).slice(0, 300); else o[k] = v; } ch = o; }
    else if (Array.isArray(pl)) ch = { _array: pl.length + " éléments" };
    return { date: l.date, user: um[l.user] || l.user, event: l.event, changes: ch };
  };

  const s = (prod.specs || {}) as Record<string, unknown>;
  return { found: true, via, product: {
      id: pid, stockId: prod.stockId, status: prod.status, statusAssurance: prod.statusAssurance, dateEntered: prod.dateEntered, dateModified: prod.dateModified, cached: prod.cached || {},
      specs: { cat: s.c_categorie_c, sub: s.c_souscategorie_c, marque: s.c_marque_c || s.cons_marque_c || s.r_trailermake_c, modele: s.c_modeles_c || s.cons_model_c || s.r_trailermodel_c, annee: s.c_annee_c || s.r_traileryears_c,
        vin: s.c_serialnumbertruck_c || s.r_trailerseriel_c, fournisseur: s.fournisseur_c, acheteur: s.acheteur_c, prixAchat: s.c_prixdachat_c, prixVente: s.c_prixvente_c, notePub: s.note_publication_c, banniere: s.commentaire_pub_c,
        location: s.c_location_c, priorite: s.priorite_c, preparation: s.preparation_c, vendeur: s.c_vendeur_c, client: s.nom_compagnie_c || s.nom_client_c, prixVendu: s.prix_vente_c, fi: s.f_and_i_c, contact: s.nom_client_c, km: s.c_milagestruck_c, hrs: s.c_hrsengine_c,
        moteur: s.c_engine_c, moteurModele: s.c_enginemodel_c, transmission: s.c_transmission_c, essieux: s.type_c, descFr: s.suffix_description_fr_c, youtube: s.youtube_id_c, gamache: s.is_gamache_c, transfere: s.transferred_to_c,
        published: Object.keys(s).filter(k => k.startsWith("is_published_") && s[k] === true).map(k => k.replace("is_published_", "").replace(/_c$/, "")) } },
    logs: logs.map(slim), notes: notes.map(n => ({ date: n.dateEntered, user: um[n.user] || n.user, type: n.type, importance: n.importance, note: n.note })),
    evals: evals.map(e => ({ status: e.status, hours: e.hours, parts: e.partsPrice, material: e.materialPrice, remarks: e.remarks || [] })),
    files: { total: filesTotal, byTag: files }, statuses };
}

export async function pingCloud(): Promise<boolean> {
  try { const d = await db(); await d.command({ ping: 1 }); return true; } catch { return false; }
}
