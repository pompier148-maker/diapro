import { NextResponse } from "next/server";
import { requireUser, audit } from "@/lib/guard";
import { runSql, negoSql } from "@/lib/dwh";

export const dynamic = "force-dynamic";
const TTL = 10 * 60 * 1000;
let cache: { at: number; rows: [string, string][] } | null = null;
let inflight: Promise<[string, string][]> | null = null;

/** Repères de négociation 12 mois : requête lourde, partagée entre tous les usagers, cache 10 min. */
export async function GET() {
  const u = await requireUser(); if (u instanceof NextResponse) return u;
  audit(u.email, "nego", "12 mois");
  try {
    if (!cache || Date.now() - cache.at > TTL) {
      if (!inflight) inflight = runSql(negoSql()).finally(() => { inflight = null; });
      cache = { at: Date.now(), rows: await inflight };
    }
    return NextResponse.json({ data: { rows: cache.rows }, storedAt: new Date(cache.at).toISOString() });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 502 }); }
}
