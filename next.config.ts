import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: __dirname },
  // Le HTML de la fiche est lu sur disque par app/route.ts : il doit être inclus dans le bundle Vercel.
  outputFileTracingIncludes: { "/": ["./lib/fiche360.html"] },
};

export default nextConfig;
