import { NextResponse } from "next/server";
import { requireUser, stockParam } from "@/lib/guard";
import { fetchPhoto } from "@/lib/photo";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = await requireUser(); if (u instanceof NextResponse) return u;
  const stock = stockParam(req.url);
  if (!stock) return NextResponse.json({ error: "numéro de stock invalide" }, { status: 400 });
  const ph = await fetchPhoto(stock);
  if (!ph) return new NextResponse(null, { status: 404, headers: { "x-photo-source": "none" } });
  return new NextResponse(new Blob([ph.bytes as BlobPart], { type: ph.mime }), { status: 200, headers: {
    "content-type": ph.mime, "cache-control": "private, max-age=3600",
    "x-photo-source": ph.source, "x-photo-page": ph.page,
  } });
}
