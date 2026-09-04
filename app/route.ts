import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth, isAllowedEmail } from "@/auth";

export const dynamic = "force-dynamic";

/**
 * La fiche est une page HTML autonome (lib/fiche360.html), identique au prototype validé dans Claude,
 * servie ici derrière le login. Elle ne parle qu'aux routes /api/* de cette app.
 */
let cached: string | null = null;
export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isAllowedEmail(email)) return NextResponse.redirect(new URL("/login", req.url));
  if (!cached || process.env.NODE_ENV !== "production") cached = await readFile(path.join(process.cwd(), "lib", "fiche360.html"), "utf8");
  const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fiche 360° Stock</title></head><body data-user="${email.replace(/"/g, "&quot;")}">${cached}</body></html>`;
  return new NextResponse(page, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY" } });
}
