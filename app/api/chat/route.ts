import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ASSISTANT_NAME, CENTER, SEED_KB } from "@/lib/seed";
import { enforce, rank } from "@/lib/engine";
import { KBEntry, ModelVerdict } from "@/lib/types";

export const runtime = "nodejs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

function buildSystemPrompt(kb: KBEntry[]): string {
  const kbText = kb
    .map((e) => `[${e.id}] (${e.category}) ${e.title}\n${e.body}\nSource: ${e.source}`)
    .join("\n\n");
  return `You are ${ASSISTANT_NAME}, the friendly AI front-desk assistant for ${CENTER.name}, a daycare/preschool. You answer questions from parents — who are often anxious and deeply caring — using ONLY the knowledge base below. ${CENTER.hoursLine}. Director: ${CENTER.director}.

ABSOLUTE RULES:
1. Ground every answer in the knowledge base. If the answer is not supported by it, do NOT guess — set confidence low and citationIds to [].
2. Always cite the entry id(s) you used in citationIds.
3. You MAY state a general policy, even a health one (e.g. "what is the fever policy?") — that is helpful and safe. But never make a judgment about a SPECIFIC child's health or safety (e.g. "can MY child come in with a fever?"). For a judgment like that, set proposedTier to 3 and let a human decide.
4. Tone is everything. Be genuinely warm, friendly, and reassuring — like a caring front-desk person who knows these families by name. Lead with warmth, keep it brief and concrete, mirror the parent's own words, and never sound robotic, clipped, or bureaucratic. A little kindness goes a long way with an anxious parent.
5. For a sensitive, emotional, or distressing question (a sick or hurt child, bullying, a scared or upset child, anything heavy), write ONE short, warm sentence acknowledging the parent's feelings in the "empathy" field — tone only, NO advice, NO judgment, NO policy. For routine factual questions, leave "empathy" as an empty string.
6. In the "summary" field, write a terse (under 12 words) staff-facing summary of what the parent needs, e.g. "Parent asking if feverish child can attend" or "Tuition question for infants". This is for the front-desk team's triage queue.

TIERS:
- proposedTier 1: a routine factual question, including stating a general policy, fully answered by the knowledge base (hours, holidays, tuition, meals, tours, "what is the X policy").
- proposedTier 2: answerable but consequential/semi-personal (enrollment specifics, billing details) — answer, but a human should confirm.
- proposedTier 3: a judgment about a specific child's health/safety, an emotional/distress message, or anything not covered by the knowledge base — do not resolve it yourself.

KNOWLEDGE BASE:
${kbText}

Respond with ONLY a single compact JSON object, no prose before or after:
{"intent": string, "answer": string, "empathy": string, "summary": string, "citationIds": string[], "confidence": number (0..1), "proposedTier": 1|2|3}`;
}

function fallbackVerdict(question: string, kb: KBEntry[]): ModelVerdict {
  const ranked = rank(question, kb);
  const top = ranked[0];
  const matchedSomething = ranked.some((e) =>
    question.toLowerCase().split(/\W+/).some((w) => w.length > 3 && `${e.title} ${e.body}`.toLowerCase().includes(w))
  );
  // Propose tier 1 when we have a grounded match; the safety guard in enforce()
  // will clamp to tier 3 if this is an emergency, a judgment about a specific
  // child, or ungrounded. (We intentionally don't escalate a mere policy lookup.)
  return {
    intent: top?.category ?? "unknown",
    answer: matchedSomething && top ? top.body : "",
    citationIds: matchedSomething && top ? [top.id] : [],
    confidence: matchedSomething ? 0.6 : 0.2,
    proposedTier: matchedSomething ? 1 : 3,
  };
}

// Claude is instructed to return JSON-only; this defensively extracts the first
// JSON object in case the model adds any stray text around it.
function parseVerdict(raw: string): ModelVerdict | null {
  let obj: any;
  try {
    obj = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      obj = JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
  return {
    intent: String(obj.intent ?? "unknown"),
    answer: String(obj.answer ?? ""),
    empathy: typeof obj.empathy === "string" ? obj.empathy : "",
    summary: typeof obj.summary === "string" ? obj.summary : "",
    citationIds: Array.isArray(obj.citationIds) ? obj.citationIds.map(String) : [],
    confidence: typeof obj.confidence === "number" ? obj.confidence : 0.3,
    proposedTier: [1, 2, 3].includes(obj.proposedTier) ? obj.proposedTier : 3,
  };
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const { question, kb } = await req.json();
  const knowledge: KBEntry[] = Array.isArray(kb) && kb.length ? kb : SEED_KB;
  if (!question || typeof question !== "string") {
    return NextResponse.json({ error: "Missing question" }, { status: 400 });
  }

  let verdict: ModelVerdict;
  const key = process.env.ANTHROPIC_API_KEY;

  if (key) {
    try {
      const client = new Anthropic({ apiKey: key });
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        temperature: 0.2,
        // The knowledge base is a stable prefix → mark it for prompt caching so
        // repeated requests reuse it. (Caching only kicks in once the prefix
        // crosses the model's minimum, ~4K tokens on Haiku — see README.)
        system: [
          {
            type: "text",
            text: buildSystemPrompt(knowledge),
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: question }],
      });
      const textBlock = msg.content.find((b) => b.type === "text");
      const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";
      verdict = parseVerdict(raw) ?? fallbackVerdict(question, knowledge);
    } catch (e) {
      verdict = fallbackVerdict(question, knowledge);
    }
  } else {
    verdict = fallbackVerdict(question, knowledge);
  }

  const response = enforce(question, verdict, knowledge);
  const summary = (verdict.summary && verdict.summary.trim()) || question.slice(0, 80);

  // Structured server-side log — shows up in Vercel → Project → Logs (Runtime Logs).
  // Note: in production you'd redact PII from `question` before logging.
  console.log(
    JSON.stringify({
      evt: "front_desk_query",
      tier: response.tier,
      escalated: response.escalated,
      intent: response.intent,
      confidence: response.confidence,
      citations: response.citations.map((c) => c.id),
      modelUsed: !!key,
      latencyMs: Date.now() - t0,
      question: question.slice(0, 160),
      answer: response.answer.slice(0, 280),
      at: new Date().toISOString(),
    })
  );

  return NextResponse.json({ ...response, summary, modelUsed: !!key });
}
