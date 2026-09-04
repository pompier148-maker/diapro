export { auth as proxy } from "@/auth";

// Les pages sont protégées ici (redirection vers /login). Les routes /api/* vérifient elles-mêmes la session
// (lib/guard.ts) et répondent 401 en JSON, ce que la page sait gérer.
export const config = {
  matcher: ["/((?!api/|login|_next/static|_next/image|favicon.ico).*)"],
};
