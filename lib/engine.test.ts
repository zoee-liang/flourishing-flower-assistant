import { describe, it, expect } from "vitest";
import { safetyScreen, enforce } from "./engine";
import { SEED_KB } from "./seed";
import { ModelVerdict } from "./types";

// Build a model "proposal" to feed the guard. The whole point of these tests is
// that the SERVER (enforce) gets the final say, no matter what the model proposes.
function verdict(p: Partial<ModelVerdict> = {}): ModelVerdict {
  return { intent: "test", answer: "model answer", citationIds: [], confidence: 0.6, proposedTier: 1, ...p };
}

describe("safetyScreen", () => {
  it("flags emergencies", () => {
    expect(safetyScreen("my child is choking").emergency).toBe(true);
    expect(safetyScreen("she's not breathing").emergency).toBe(true);
  });
  it("flags sensitive health topics", () => {
    expect(safetyScreen("she has a fever").sensitive).toBe(true);
    expect(safetyScreen("can he take his medication here").sensitive).toBe(true);
  });
  it("flags judgment requests about a specific child", () => {
    expect(safetyScreen("can my child come in?").judgment).toBe(true);
    expect(safetyScreen("is it ok for her to attend").judgment).toBe(true);
  });
  it("leaves routine factual questions clean", () => {
    const s = safetyScreen("what are your hours on monday?");
    expect(s.emergency).toBe(false);
    expect(s.sensitive).toBe(false);
    expect(s.judgment).toBe(false);
  });
});

describe("enforce — the deterministic safety guard", () => {
  it("hard-stops emergencies to a human, with no citations", () => {
    const r = enforce("my child is choking", verdict({ proposedTier: 1, citationIds: ["medication"] }), SEED_KB);
    expect(r.tier).toBe(3);
    expect(r.escalated).toBe(true);
    expect(r.citations).toHaveLength(0);
    expect(r.guardReason).toMatch(/emergency/i);
    expect(r.answer).toMatch(/911/);
  });

  it("shares the policy but refuses the call on a sensitive judgment", () => {
    const r = enforce("My child has a fever, can they come in?", verdict({ proposedTier: 3, citationIds: ["illness"] }), SEED_KB);
    expect(r.tier).toBe(3);
    expect(r.escalated).toBe(true);
    expect(r.offerConnect).toBe(true);
    expect(r.citations.map((c) => c.id)).toContain("illness");
    expect(r.answer).toMatch(/100\.4/); // server composed the answer from the grounded policy
    expect(r.answer.toLowerCase()).toContain("can't make that decision");
  });

  it("OVERRIDES a confident-wrong model that tries to answer a sensitive judgment", () => {
    // The model says "tier 1, Yes!" — the guard must NOT let that through.
    const r = enforce(
      "can my child come in with a fever?",
      verdict({ proposedTier: 1, citationIds: ["illness"], confidence: 0.95, answer: "Yes, bring her in!" }),
      SEED_KB
    );
    expect(r.tier).toBe(3);
    expect(r.escalated).toBe(true);
    expect(r.answer).not.toContain("Yes, bring her in!");
  });

  it("answers a general policy lookup (no judgment) without escalating", () => {
    const r = enforce("what is your fever policy?", verdict({ proposedTier: 1, citationIds: ["illness"], answer: "Here is the policy." }), SEED_KB);
    expect(r.tier).toBe(1);
    expect(r.escalated).toBe(false);
  });

  it("declines (does not guess) when nothing is grounded", () => {
    const r = enforce("do you offer mandarin immersion?", verdict({ proposedTier: 1, citationIds: [], confidence: 0.2 }), SEED_KB);
    expect(r.tier).toBe(3);
    expect(r.escalated).toBe(true);
    expect(r.offerConnect).toBe(true);
    expect(r.citations).toHaveLength(0);
  });

  it("declines on low confidence even with a citation", () => {
    const r = enforce("something vague", verdict({ proposedTier: 1, citationIds: ["hours"], confidence: 0.2 }), SEED_KB);
    expect(r.tier).toBe(3);
    expect(r.escalated).toBe(true);
  });

  it("answers a routine, grounded question cleanly", () => {
    const r = enforce("are you open on veterans day?", verdict({ proposedTier: 1, citationIds: ["holidays"], confidence: 0.85, answer: "We're closed." }), SEED_KB);
    expect(r.tier).toBe(1);
    expect(r.escalated).toBe(false);
    expect(r.answer).toBe("We're closed.");
  });
});
