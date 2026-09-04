import { NextResponse } from "next/server";
import { auth, isAllowedEmail } from "@/auth";

/** Renvoie le courriel de l'usager connecté, ou une réponse 401 à retourner telle quelle. */
export async function requireUser(): Promise<{ email: string } | NextResponse> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isAllowedEmail(email)) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  return { email };
}

export const STOCK_RE = /^[A-Z]{1,3}-\d{1,7}(?:-\d{1,8})?$/;

export function stockParam(url: string): string | null {
  const s = (new URL(url).searchParams.get("stock") || "").trim().toUpperCase().replace(/\s+/g, "");
  return STOCK_RE.test(s) ? s : null;
}

/** Journal de consultation : qui a regardé quoi (visible dans les logs Vercel). */
export function audit(email: string, action: string, detail: string) {
  console.log(JSON.stringify({ at: new Date().toISOString(), user: email, action, detail }));
}
