# AI Front Desk — design notes

**What it is:** A working prototype of an AI front desk for a daycare. Parents ask it
the everyday things they'd normally call or text about: hours, tuition, meals, tours,
sick-kid policies, and it answers right away with a cited source. The moment a question
touches a child's health, safety, or anything it isn't sure about, it stops answering and
hands the parent to a real person. There's also an operator side, where the center edits
the source of truth, sees every question the bot struggled with, and teaches it a better
answer in a click.

🔗 **Live demo:** https://flourishing-flower-assistant.vercel.app/ ·  **Code:** https://github.com/zoee-liang/flourishing-flower-assistant

## The thoughts behind it
A front desk's real job isn't to answer everything. It's to answer the routine questions perfectly
and know when to get a human. For anxious parents and a safety-critical business, trust
beats coverage. So I optimized for *"never wrong, never traps you,"* not *"answers the most
questions."* Every decision below comes back to that.

## What I built
- **A parent chat** that's grounded in the center's handbook, cites its sources, and always
  gives you a one-tap way to reach a person. (One of my own pet peeves with support bots is
  that you can never escape them - so I made sure the user always can.)
- **A 3-tier trust model.** Every question lands in one of three buckets: answer it
  (grounded + cited), answer it but offer a human to confirm, or don't answer and escalate
  warmly and collect the parent's contact info.
- **An operator control center.** Edit policies, watch the questions the bot couldn't
  handle, see satisfaction / cost / time-saved at a glance, and teach the bot a new answer
  that the next parent immediately benefits from.

## The decision highlights

**The model proposes, the server decides.** I don't let the language model have the final
word on anything involving a child's safety. The model reads the question and *suggests* a
tier; a separate, deterministic guard can override it. If a confident-but-wrong model says
*"Tier 1: sure, bring your feverish kid in!"*, the guard catches it, throws out that answer,
shares the actual written policy instead, and routes to a human. That guard is plain,
testable code, so I unit-tested it, including that exact "confident wrong model" case.

**Grounding + provenance.** Answers come only from the center's handbook, and every answer
cites which policy it used. No made-up answers, and the operator can always see *why* the
bot said what it said.

**A closed loop, not a black box.** The bot's failures aren't dead ends, they're the
to-do list. Whatever it can't answer shows up in the operator's queue; one "Teach" click
turns it into a real policy. I also separated *"taught the bot"* from *"handled this
parent,"* so a family waiting on a callback never gets auto-closed just because the
knowledge gap got filled.

**Built to be one center's, then anyone's.** Everything that makes it "theirs": assistant
name, voice, colors, logo, contact info, etc. lives in one config file, with the handbook
editable live. It's a single static config here, but it's shaped to load per-center from a
database with no rebuild, so Brightwheel could
template across thousands of centers.

**A data-engineering perspective.** This is the part I care most about as a data person. Every interaction is a
structured and enriched event: question, answer, tier, confidence, the policies it
cited, parent feedback, latency, token cost. They stream to logs and export as NDJSON in
the warehouse-ready shape you'd land in a `fact_interactions` table. That one stream feeds
three things at once: the operator analytics, an evals dataset (every thumbs-down and
low-confidence answer is a labeled example, and "Teach" is human-in-the-loop labeling), and
cost/quality monitoring. It's append-only so it doesn't overwrite the truth.

## What I cut on purpose for the PoC scope
No login, one center, text only, browser state instead of a real database, no PDF
ingestion. The point was the trust model and the
loop.

One tradeoff I want to be honest about: because there's no backend, the knowledge base lives
in the browser and gets sent to the API with each request. That's fine for a single-center
demo, but in production the config and knowledge base would live server-side, behind auth,
per center, and the client should never be the source of truth for what the assistant is
allowed to say.

## What I'd do next
- Make the safety guard robust to paraphrasing without losing determinism: add a semantic
  layer (embedding similarity against curated sensitive phrases) on top of the keyword
  floor, combined so the *decision* stays reproducible.
- Move the config and knowledge base to per-center storage for real multi-tenancy.
- Wire the exported events into a warehouse + a small eval harness, so every "Teach"
  measurably improves answer quality over time.

---

*Stack: 
Next.js + TypeScript, Claude (Haiku) via the Anthropic SDK, grounded knowledge base
with prompt caching. `npm install && npm run dev` to run; `npm test` for the safety-guard
suite. See the [README](README.md) for setup and things to try.
Built with Claude Code.*
