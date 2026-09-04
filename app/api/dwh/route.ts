import { NextResponse } from "next/server";
import { requireUser, stockParam, audit } from "@/lib/guard";
import { runSql, dwhSql } from "@/lib/dwh";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = await requireUser(); if (u instanceof NextResponse) return u;
  const stock = stockParam(req.url);
  if (!stock) return NextResponse.json({ error: "numéro de stock invalide" }, { status: 400 });
  audit(u.email, "dwh", stock);
  try { return NextResponse.json({ data: { rows: await runSql(dwhSql(stock)) } }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 502 }); }
}
