export type Tier = 1 | 2 | 3;

export type Urgency = "low" | "normal" | "high";
export type Contact = { name: string; phone: string; email: string; urgency: Urgency };

export type KBEntry = {
  id: string;
  category: string;
  title: string;
  body: string;
  source: string; // human-readable citation, e.g. "Parent Handbook → Illness Policy"
  sensitive?: boolean; // policy itself touches health/safety/legal
  action?: { label: string; href: string }; // optional CTA shown when this entry is cited (e.g. "Schedule a tour")
};

export type Center = {
  name: string;
  director: string;
  phone: string;
  email: string;
  hoursLine: string;
};

// What the model proposes, before the server's safety enforcement.
export type ModelVerdict = {
  intent: string;
  answer: string;
  citationIds: string[];
  confidence: number; // 0..1
  proposedTier: Tier;
  empathy?: string; // a brief, warm acknowledgment for sensitive/uncertain questions (tone only, no advice)
  summary?: string; // one-line, staff-facing summary of what the parent needs (for the operator queue)
};

// What the parent actually receives, after enforcement.
export type DeskResponse = {
  tier: Tier;
  intent: string;
  answer: string;
  citations: { id: string; source: string }[];
  confidence: number;
  escalated: boolean;
  guardReason: string | null; // why the server overrode/clamped, if it did
  offerConnect?: boolean; // true when the message ends by offering to connect to staff (parent must opt in)
  summary?: string; // staff-facing one-liner for the operator queue
  // operational metadata (cost monitoring)
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
};

export type StruggledItem = {
  id: string;
  question: string;
  tier: Tier;
  reason: string;
  confidence: number;
  at: number;
  resolved?: boolean;
};
