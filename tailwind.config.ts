import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        garage: {
          bg: "#0d0d0d",
          card: "#1a1a1a",
          border: "#2a2a2a",
          accent: "#f59e0b",
          red: "#ef4444",
          green: "#22c55e",
          muted: "#6b7280",
        },
      },
    },
  },
  plugins: [],
};

export default config;
