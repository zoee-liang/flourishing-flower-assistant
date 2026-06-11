import { Center } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  WHITE-LABEL CONFIG  —  the one file a customer (a daycare center) edits.
 *
 *  Everything that makes this "their" front desk lives here: the assistant's
 *  name + voice, branding (color, mascot, tagline), contact info, and hours.
 *  The knowledge base (their handbook/policies) is in `seed.ts` and is also
 *  managed live from the Operator → Policies screen.
 *
 *  In a multi-tenant deployment this object would be loaded per-center from a
 *  database keyed by tenant; for this proof of concept it's a single static
 *  config so a center can fork-and-customize, or Brightwheel can template it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type CenterConfig = {
  center: Center;
  assistant: {
    name: string; // the assistant's display name
    greeting: string; // the first message a parent sees
    persona: string; // steers the assistant's tone/voice (injected into the system prompt)
  };
  brand: {
    color: string; // primary brand color (hex) — buttons & accents
    colorSoft: string; // light tint (hex) — soft backgrounds & hovers
    emoji: string; // simple logo / mascot
    tagline: string;
  };
  settings: {
    minutesSavedPerAnswer: number; // used for the "staff time saved" dashboard metric
  };
};

export const CONFIG: CenterConfig = {
  center: {
    name: "Flourishing Flowers Daycare Center",
    director: "Ms. Elena Rivera",
    phone: "(505) 555-0142",
    email: "frontdesk@flourishingflowers.example",
    hoursLine: "Mon–Fri, 7:00 AM – 5:30 PM",
  },
  assistant: {
    name: "Poppy",
    greeting:
      "Hi there! 👋 I'm Poppy, the front-desk assistant at Flourishing Flowers Daycare Center. Ask me anything about hours, tuition, meals, tours, or our policies. For anything about your child's health or safety, I'll gladly connect you with a person.",
    persona:
      "Warm, friendly, and reassuring — like a caring front-desk person who knows these families by name. Brief and concrete, never bureaucratic or clipped.",
  },
  brand: {
    color: "#5b4ef0",
    colorSoft: "#eef0ff",
    emoji: "🌸",
    tagline: "The front desk that knows when to get a human.",
  },
  settings: {
    minutesSavedPerAnswer: 6,
  },
};

/** Convert a hex color (#5b4ef0) to space-separated RGB channels ("91 78 240")
 *  so it can drive a Tailwind color via a CSS variable. */
export function hexToRgbChannels(hex: string): string {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `${r} ${g} ${b}`;
}
