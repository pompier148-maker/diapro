import { NextResponse } from "next/server";
import { requireUser, audit } from "@/lib/guard";
import { aiEnabled, analyse } from "@/lib/anthropic";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const u = await requireUser(); if (u instanceof NextResponse) return u;
  if (!aiEnabled()) return NextResponse.json({ error: "analyse désactivée (ANTHROPIC_API_KEY absent)" }, { status: 503 });
  const body = await req.json().catch(() => null) as { stock?: string; compact?: unknown } | null;
  if (!body?.compact) return NextResponse.json({ error: "données manquantes" }, { status: 400 });
  audit(u.email, "analyse", String(body.stock || ""));
  try { return NextResponse.json({ text: await analyse(body.compact) }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 502 }); }
}
