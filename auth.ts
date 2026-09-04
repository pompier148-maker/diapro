import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

/**
 * Login Microsoft 365 (Entra ID). Un seul fichier à ajuster si recherche-client utilise autre chose.
 * L'accès est limité aux domaines ALLOWED_EMAIL_DOMAINS et, si défini, à la liste ALLOWED_EMAILS.
 */
const domains = (process.env.ALLOWED_EMAIL_DOMAINS || "gamache.net").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const allowList = (process.env.ALLOWED_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  if (allowList.length) return allowList.includes(e);
  const dom = e.split("@")[1] || "";
  return domains.includes(dom);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
  ],
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: "/login" },
  callbacks: {
    signIn({ user, profile }) {
      const email = user.email || (profile as { email?: string; preferred_username?: string } | undefined)?.email || (profile as { preferred_username?: string } | undefined)?.preferred_username;
      return isAllowedEmail(email);
    },
    authorized({ auth }) {
      return !!auth?.user?.email && isAllowedEmail(auth.user.email);
    },
  },
});
