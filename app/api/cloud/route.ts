import { NextResponse } from "next/server";
import { requireUser, stockParam, audit } from "@/lib/guard";
import { fetchCloud } from "@/lib/cloud";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = await requireUser(); if (u instanceof NextResponse) return u;
  const stock = stockParam(req.url);
  if (!stock) return NextResponse.json({ error: "numéro de stock invalide" }, { status: 400 });
  audit(u.email, "cloud", stock);
  try { return NextResponse.json(await fetchCloud(stock)); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 502 }); }
}
