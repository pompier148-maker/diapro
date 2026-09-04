/**
 * Photo de l'unité : d'abord la fiche du site web (photo retouchée, 1000 px), sinon Gamache Cloud (moyenne, puis vignette).
 * Le serveur va chercher l'image et la sert lui-même : aucun appel externe depuis le navigateur.
 */
const WEB = (process.env.WEBSITE_BASE || "https://groupegamache.com").replace(/\/$/, "");
const CLOUD = (process.env.CLOUD_BASE || "https://gestion.gamache.cloud").replace(/\/$/, "");
const MAX_BYTES = 3 * 1024 * 1024;

export type Photo = { bytes: Uint8Array; mime: string; source: "web" | "moyenne" | "vignette"; page: string };

async function getImage(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { "user-agent": "fiche360/1.0" } });
    const ct = r.headers.get("content-type") || "";
    if (!r.ok || ct.indexOf("image/") !== 0) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.byteLength < 2000 || buf.byteLength > MAX_BYTES) return null;
    return { bytes: buf, mime: ct.split(";")[0] };
  } catch { return null; }
}

export async function fetchPhoto(stock: string): Promise<Photo | null> {
  const listing = `${WEB}/en/inventory/detail/x/${encodeURIComponent(stock)}.html`;
  try {
    const r = await fetch(listing, { signal: AbortSignal.timeout(10000), headers: { "user-agent": "fiche360/1.0" } });
    if (r.ok) {
      const html = await r.text();
      const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (m && m[1]) {
        let u = m[1].replace(/&amp;/g, "&");
        u = u.replace(/([?&])width=\d+/, "$1width=1000").replace(/[?&]height=\d+/, "");
        const img = await getImage(u);
        if (img) return { ...img, source: "web", page: listing };
      }
    }
  } catch { /* site indisponible : repli Cloud */ }
  const md = await getImage(`${CLOUD}/product/photo/md/1/${encodeURIComponent(stock)}.jpg`);
  if (md) return { ...md, source: "moyenne", page: `${CLOUD}/product/${encodeURIComponent(stock)}` };
  const th = await getImage(`${CLOUD}/product-image/${encodeURIComponent(stock)}/thumb.jpg`);
  if (th) return { ...th, source: "vignette", page: `${CLOUD}/product/${encodeURIComponent(stock)}` };
  return null;
}
