# AI Front Desk — "knows when to get a human"

A proof-of-concept AI front desk for a daycare (fictional *Flourishing Flowers Daycare Center*,
assistant named *Poppy*). Policies are grounded in the public Albuquerque DCFD Family Handbook.

## White-label / customer-implementable
This is built as a **shared, configurable building block**. It can be templatized, allowing
each center to make it their own. Everything that makes it "theirs" lives in **one file, 
[`lib/config.ts`](lib/config.ts)**:

- **Assistant** — name, greeting, and a `persona` string that steers the AI's tone/voice
- **Branding** — primary color + soft tint (drive the whole UI via CSS variables, no rebuild), mascot
  emoji, tagline
- **Center** — name, director, phone, email, hours
- **Settings** — e.g. estimated minutes saved per answer (dashboard metric)

The center's **policies/handbook** are the other half of their customization — seeded in
[`lib/seed.ts`](lib/seed.ts) and editable live from **Operator → Policies** (the "teach" flow). In a
multi-tenant deployment, this config + KB would load per-tenant from a database; here it's a single
static config so a center can fork-and-customize.

## The idea
A front desk's job isn't to answer everything — it's to answer the routine perfectly and
**know when to hand a parent to a human**. For anxious parents and a safety-critical business,
trust beats coverage.

## The design (what to look at)
- **A 3-tier trust model.** Every question is sorted into 🟢 Answer (grounded + cited),
  🟡 Answer + offer a human, or 🔴 Don't answer — escalate warmly.
- **A deterministic safety guard that overrides the model.** The LLM *proposes*; the server
  *enforces*. See `lib/engine.ts`:
  - Emergency language → hard stop, "call 911 + a human."
  - Sensitive topic + a judgment about a specific child (e.g. "can **my** child come in with a
    fever?") → the server shares the *policy* but never makes the call, and escalates.
  - No grounded citation or low confidence → it declines rather than guess.
- **Grounding + provenance.** Answers come only from the knowledge base and cite their source.
- **A closed loop.** The operator sees every question the desk struggled with and can *teach it*
  in one step — and the next parent gets a real answer.

## Run it
```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```
Uses Claude (`claude-haiku-4-5` by default) via `@anthropic-ai/sdk`. The knowledge
base is sent as a cached system prompt; on Haiku, prompt caching only engages once
the prefix passes ~4K tokens, so as the handbook grows it caches for free. Runs
without a key too (deterministic keyword fallback). Cost for a POC is pennies.
Routes: `/` (overview) · `/parent` (front desk) · `/operator` (control center).

## Try it on purpose
- "Are you open on Veterans Day?" → 🟢 answered + citation
- "What's your fever policy?" → 🟢 the policy, grounded
- "My child has a fever, can *they* come in?" → 🔴 policy shared, decision left to a human
- Ask something not in the handbook → 🔴 it declines instead of guessing → appears in the
  operator's "struggled" inbox → teach it → ask again → 🟢

## Testing & safety
The safety-critical path is pure, deterministic logic, so it's unit-tested. Run `npm test`
([`lib/engine.test.ts`](lib/engine.test.ts), Vitest). The suite covers the 3-tier guard —
emergencies, the sensitive-judgment escalation, grounded vs. ungrounded answers — including the
key case: **a confident, wrong model that proposes "Tier 1: Yes, bring her in" is overridden by
the guard and forced to escalate.** The model proposes; the server decides.

**On the keyword guard (a deliberate design choice).** The keyword screen is a *deterministic
floor*, not the classifier — the LLM handles nuance and sets the tier; the guard guarantees the
worst-case behavior regardless of what the model says, with a conservative bias (over-escalate,
never under-escalate). It's cheap, auditable, and testable. To make it robust to paraphrasing
without losing determinism, the next step is a semantic layer (embedding-similarity against
curated "sensitive" seed phrases, or a temperature-0 classifier) combined with the keyword guard
via OR-logic + a conservative default — keeping the *decision* reproducible (pinned model +
fixed threshold) even with a probabilistic input, and growing the seed lists from the escalation
logs we already collect.

## Data collection (a data-engineering view)
Every interaction is a structured, provenance-rich event: question, answer, tier, **confidence +
escalation (uncertainty)**, **cited policies (provenance)**, feedback, contact, urgency, latency,
and **token cost**. These stream to structured server logs (Vercel Runtime Logs) and can be
exported as NDJSON from the operator (**⬇ Export**) — the warehouse-ready shape a pipeline would
land in a `fact_interaction` table. Downstream this powers analytics (the Overview), evals (the
thumbs-down + low-confidence set is a labeled dataset; the "Teach" flow is human-in-the-loop
labeling), and cost/quality monitoring. It's append-only — *store artifacts, don't overwrite truth.*

## Scope (deliberately cut for a POC)
No auth, one center, text only, in-browser state instead of a database, no PDF ingestion.
The point is the trust model and the loop, not a production-grade AI assistant.
