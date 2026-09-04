import type { ReactNode } from "react";

export const metadata = { title: "Fiche 360° Stock" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
