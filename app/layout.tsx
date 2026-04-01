import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DIAPRO — Diagnostic Camions Lourds",
  description: "Assistant diagnostic professionnel pour camions lourds — par Mécano, expert diesel",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
