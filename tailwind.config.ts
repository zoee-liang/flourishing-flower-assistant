import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Driven by CSS variables set from the white-label config (lib/config.ts)
        // via app/layout.tsx, so the brand color is customizable without a rebuild.
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          soft: "rgb(var(--brand-soft) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};
export default config;
