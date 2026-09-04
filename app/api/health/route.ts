import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { pingCloud } from "@/lib/cloud";
import { pingDwh } from "@/lib/dwh";
import { aiEnabled } from "@/lib/anthropic";

export const dynamic = "force-dynamic";

/** État des sources pour les voyants de l'entête. */
export async function GET() {
  const u = await requireUser(); if (u instanceof NextResponse) return u;
  const [cloud, dwh] = await Promise.all([pingCloud(), pingDwh()]);
  return NextResponse.json({ user: u.email, cloud, dwh, ai: aiEnabled() });
}
