import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#5b4ef0",
          dark: "#4a3fd6",
          soft: "#eef0ff",
        },
      },
    },
  },
  plugins: [],
};
export default config;
