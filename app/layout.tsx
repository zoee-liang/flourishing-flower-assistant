import type { Metadata } from "next";
import "./globals.css";
import { DeskProvider } from "./providers";

export const metadata: Metadata = {
  title: "Poppy — Flourishing Flowers Front Desk",
  description: "An AI front desk that knows when to get a human.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <DeskProvider>{children}</DeskProvider>
      </body>
    </html>
  );
}
