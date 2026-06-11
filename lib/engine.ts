import { DeskResponse, KBEntry, ModelVerdict, Tier } from "./types";
import { CENTER } from "./seed";

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic safety guard.
//
// The core design belief: we do NOT let the language model be the sole decider
// on anything touching a child's health or safety. The model proposes; this
// layer enforces. It runs independently of the LLM so a confident, wrong model
// can't talk its way into giving medical/safety judgment to an anxious parent.
// ─────────────────────────────────────────────────────────────────────────────

const EMERGENCY_TERMS = [
  "not breathing", "can't breathe", "cant breathe", "choking", "choke",
  "unconscious", "unresponsive", "seizure", "bleeding badly", "severe bleeding",
  "anaphylaxis", "anaphylactic", "911", "ambulance", "overdose", "head injury",
  "broke", "broken bone", "drowning",
];

const SENSITIVE_TERMS = [
  "fever", "sick", "ill", "illness", "vomit", "throw up", "throwing up",
  "diarrhea", "rash", "pink eye", "conjunctivitis", "cough", "contagious",
  "chicken pox", "ringworm", "infection", "symptom", "temperature", "covid",
  "flu", "strep", "ear infection",
  "medication", "medicine", "dose", "dosage", "tylenol", "ibuprofen", "antibiotic",
  "allergy", "allergic", "peanut", "nut", "epipen", "epinephrine", "reaction",
  "injury", "injured", "hurt", "fell", "bump", "bruise", "bit", "bite",
  "custody", "court order", "restraining", "lawyer", "abuse", "cps",
];

const JUDGMENT_CUES = [
  "can my", "can i", "should i", "should my", "is it ok", "is it okay",
  "is it safe", "is it fine", "do you think", "would it be", "am i allowed",
  "can they come", "can he come", "can she come", "can my child come",
  "what should i do", "is this normal", "what do you recommend",
];

function hits(text: string, terms: string[]): string[] {
  const t = text.toLowerCase();
  return terms.filter((w) => t.includes(w));
}

export type Screen = {
  emergency: boolean;
  sensitive: boolean;
  judgment: boolean; // asking us to make a call, not just look up a policy
  matched: string[];
};

export function safetyScreen(question: string): Screen {
  const emergencyMatches = hits(question, EMERGENCY_TERMS);
  const sensitiveMatches = hits(question, SENSITIVE_TERMS);
  const judgmentMatches = hits(question, JUDGMENT_CUES);
  return {
    emergency: emergencyMatches.length > 0,
    sensitive: sensitiveMatches.length > 0,
    judgment: judgmentMatches.length > 0,
    matched: Array.from(new Set([...emergencyMatches, ...sensitiveMatches, ...judgmentMatches])),
  };
}

const CONFIDENCE_FLOOR = 0.45;

// Lightweight keyword relevance — used to order the KB we hand the model and to
// keep the demo robust even before the model call.
export function rank(question: string, kb: KBEntry[]): KBEntry[] {
  const words = question.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  return [...kb]
    .map((e) => {
      const hay = `${e.title} ${e.body} ${e.category}`.toLowerCase();
      const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
      return { e, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.e);
}

// The enforcement step. Takes what the model proposed and applies the guard.
export function enforce(
  question: string,
  verdict: ModelVerdict,
  kb: KBEntry[]
): DeskResponse {
  const screen = safetyScreen(question);
  const byId = new Map(kb.map((e) => [e.id, e]));
  const citations = verdict.citationIds
    .map((id) => byId.get(id))
    .filter((e): e is KBEntry => !!e)
    .map((e) => ({ id: e.id, source: e.source }));

  let tier: Tier = verdict.proposedTier;
  let guardReason: string | null = null;
  let answer = verdict.answer;

  // 1) Hard stop: emergencies are never handled by a chatbot.
  if (screen.emergency) {
    tier = 3;
    guardReason = "Emergency language detected — routed to a human immediately.";
    answer =
      "This sounds like it could be an emergency. Please call 911 right away if your child is in danger. " +
      "Then call us at the center so we can help. I'm not able to handle urgent medical situations — a real person needs to.";
    return { tier, intent: verdict.intent, answer, citations: [], confidence: verdict.confidence, escalated: true, guardReason };
  }

  // 2) Sensitive topic + a request for judgment about a specific child →
  //    share the policy (server-composed from the grounded source, NOT the
  //    model's free text), but never make the call. Escalate to a human.
  if (screen.sensitive && screen.judgment) {
    tier = 3;
    guardReason =
      "Sensitive health/safety question asking for a judgment about a specific child — policy shared, decision left to a person.";
    const policy = pickPolicy(question, verdict.citationIds, kb);
    const policyCitations = policy ? [{ id: policy.id, source: policy.source }] : citations;
    const lead = empathyLead(verdict.empathy, "I know questions about your child's health and safety can be stressful.");
    answer = policy
      ? `${lead}Here's what our handbook says:\n\n“${policy.body}”\n\nBecause this is about your child's health and safety, I can't make that decision for you — but a staff member can. I'd be glad to connect you.`
      : `${lead}Because this is about your child's health and safety, I'm not able to make that decision — but a staff member can help. I'd be glad to connect you.`;
    return {
      tier,
      intent: verdict.intent,
      answer,
      citations: policyCitations,
      confidence: verdict.confidence,
      escalated: true,
      guardReason,
      offerConnect: true,
    };
  }

  // 3) Ungrounded or low-confidence → we don't guess.
  if (citations.length === 0 || verdict.confidence < CONFIDENCE_FLOOR) {
    tier = 3;
    guardReason =
      citations.length === 0
        ? "No grounded source matched — declined rather than guess."
        : "Low confidence in the match — declined rather than guess.";
    const lead = empathyLead(verdict.empathy, "I can tell this matters, and I want to make sure you get the right help.");
    answer =
      `${lead}While I don't have a direct answer to that from our handbook, one of our staff can help — and I'd be glad to connect you.`;
    return { tier, intent: verdict.intent, answer, citations, confidence: verdict.confidence, escalated: true, guardReason, offerConnect: true };
  }

  // 4) Otherwise honor the model's tier (1 or 2). Tier 2 is answerable but
  //    consequential, so we both invite a human confirmation in the text AND
  //    surface the connect button (offerConnect) so the offer is actionable.
  if (tier === 2) {
    answer = `${answer}\n\nWant me to have our director, ${CENTER.director}, confirm the details for your family?`;
  }
  return { tier, intent: verdict.intent, answer, citations, confidence: verdict.confidence, escalated: tier === 3, guardReason, offerConnect: tier === 2 };
}

// The model supplies tone (a contextual, empathetic acknowledgment); the server
// supplies safety. If the model gave us nothing usable, fall back to a warm,
// generic line so a sensitive answer is never cold.
function empathyLead(modelEmpathy: string | undefined, fallback: string): string {
  const e = (modelEmpathy || "").trim();
  const line = e.length > 0 && e.length < 220 ? e : fallback;
  return /[.!?]$/.test(line) ? `${line} ` : `${line}. `;
}

// Prefer a model-cited sensitive policy; else the best keyword match. Used to
// compose the safety message server-side from a grounded source.
function pickPolicy(question: string, citationIds: string[], kb: KBEntry[]): KBEntry | null {
  const byId = new Map(kb.map((e) => [e.id, e]));
  for (const id of citationIds) {
    const e = byId.get(id);
    if (e && e.sensitive) return e;
  }
  const ranked = rank(question, kb).filter((e) => e.sensitive);
  return ranked[0] ?? null;
}

export const ENGINE = { CONFIDENCE_FLOOR };
