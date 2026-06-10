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

## Scope (deliberately cut for a POC)
No auth, one center, text only, in-browser state instead of a database, no PDF ingestion.
The point is the trust model and the loop, not a production-grade AI assistant.
