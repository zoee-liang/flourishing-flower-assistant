import type { Metadata } from "next";
import "./globals.css";
import { DeskProvider } from "./providers";
import { CONFIG, hexToRgbChannels } from "@/lib/config";

export const metadata: Metadata = {
  title: `${CONFIG.assistant.name} — ${CONFIG.center.name}`,
  description: CONFIG.brand.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Brand color comes from the white-label config → CSS variables.
  const brandVars = {
    "--brand": hexToRgbChannels(CONFIG.brand.color),
    "--brand-soft": hexToRgbChannels(CONFIG.brand.colorSoft),
  } as React.CSSProperties;
  return (
    <html lang="en">
      <body className="min-h-screen" style={brandVars}>
        <DeskProvider>{children}</DeskProvider>
      </body>
    </html>
  );
}
