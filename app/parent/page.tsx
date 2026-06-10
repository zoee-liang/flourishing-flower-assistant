"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDesk } from "../providers";
import { ASSISTANT_NAME, CENTER } from "@/lib/seed";
import { CONFIG } from "@/lib/config";
import { Contact, DeskResponse, KBEntry, Urgency } from "@/lib/types";

type Msg =
  | { role: "parent"; text: string }
  | { role: "desk"; data: DeskResponse; logId: string }
  | { role: "note"; text: string };

const SUGGESTIONS = [
  "Are you open on Veterans Day?",
  "What is the tuition for infants?",
  "What's your fever policy?",
  "My child has a fever, can they come in?",
  "I forgot to pack lunch — can you provide one?",
  "How do I schedule a tour?",
];

const TIER: Record<number, { label: string; cls: string; dot: string }> = {
  1: { label: "Answered", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  2: { label: "Answered · staff can confirm", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  3: { label: "Needs a person", cls: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
};

const CONSENT_KEY = "fd_consent_v1";

export default function ParentPage() {
  const { kb, log, recordAsk, setFeedback, routeToHuman } = useDesk();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [policy, setPolicy] = useState<KBEntry | null>(null);
  const [connectForm, setConnectForm] = useState<{ logId: string } | null>(null);
  const [remaining, setRemaining] = useState<string[]>(SUGGESTIONS);
  const [consented, setConsented] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setConsented(localStorage.getItem(CONSENT_KEY) === "1");
    } catch {
      setConsented(true);
    }
  }, []);
  function agree() {
    try { localStorage.setItem(CONSENT_KEY, "1"); } catch {}
    setConsented(true);
  }

  const scroll = () => setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

  async function ask(raw: string) {
    const question = raw.trim();
    if (!question || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "parent", text: question }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, kb }),
      });
      const data: DeskResponse = await res.json();
      const logId = recordAsk(question, data);
      setMsgs((m) => [...m, { role: "desk", data, logId }]);
    } catch {
      const data: DeskResponse = {
        tier: 3, intent: "error", answer: "Something went wrong — please call the front desk at " + CENTER.phone + ".",
        citations: [], confidence: 0, escalated: true, guardReason: "Network error",
      };
      const logId = recordAsk("(network error)", data);
      setMsgs((m) => [...m, { role: "desk", data, logId }]);
    } finally {
      setBusy(false);
      scroll();
    }
  }

  function pickSuggestion(s: string) {
    setRemaining((r) => r.filter((x) => x !== s));
    ask(s);
  }

  function submitConnect(contact: Contact) {
    if (!connectForm) return;
    routeToHuman(connectForm.logId, contact);
    const first = contact.name.trim().split(/\s+/)[0] || "there";
    const prioritize = contact.urgency === "high" ? " We'll do our best to prioritize this." : "";
    setMsgs((m) => [
      ...m,
      {
        role: "note",
        text:
          `Thanks, ${first}! I've shared your request with our team and our director, ${CENTER.director}.${prioritize} ` +
          `Because we're getting a lot of requests right now, it may take us a little time to get back to you — but we will. ` +
          `You can also reach the front desk directly at ${CENTER.phone}.`,
      },
    ]);
    setConnectForm(null);
    scroll();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col overflow-x-hidden">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 px-5 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{CENTER.name}</div>
            <div className="truncate text-xs text-neutral-500">Chat with {ASSISTANT_NAME} · {CENTER.hoursLine}</div>
          </div>
          <Link href="/" className="shrink-0 text-xs font-medium text-brand hover:underline">Home</Link>
        </div>
      </header>

      {/* Persistent disclaimer */}
      <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-[11px] leading-snug text-amber-800">
        ⚠️ I&apos;m an AI assistant — I can make mistakes and I&apos;m not a substitute for our staff. In an
        emergency, call 911. Please avoid sharing medical details; I&apos;ll connect you with a person for anything sensitive.
      </div>

      <div className="flex-1 space-y-4 px-5 py-5">
        {msgs.length === 0 && (
          <div className="rounded-2xl bg-white p-4 text-sm text-neutral-600 shadow-sm">
            {CONFIG.assistant.greeting}
          </div>
        )}

        {msgs.map((m, i) => {
          if (m.role === "parent") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-4 py-2 text-white">{m.text}</div>
              </div>
            );
          }
          if (m.role === "note") {
            return (
              <div key={i} className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-[15px] leading-relaxed text-neutral-700 shadow-sm">
                  {m.text}
                </div>
              </div>
            );
          }
          const entry = log.find((l) => l.id === m.logId);
          const fb = entry?.feedback;
          const connected = entry?.humanRequested;
          const canConnect = m.data.intent !== "error" && !connected && (m.data.offerConnect || fb === "down");
          const actions = m.data.citations
            .map((c) => kb.find((e) => e.id === c.id)?.action)
            .filter((a): a is { label: string; href: string } => !!a)
            .filter((a, idx, arr) => arr.findIndex((b) => b.href === a.href) === idx);
          return (
            <div key={i} className="group flex justify-start">
              <div className="max-w-[90%] space-y-1">
                <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-[15px] leading-relaxed text-neutral-800 shadow-sm">
                  <div className={`mb-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TIER[m.data.tier].cls}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${TIER[m.data.tier].dot}`} />
                    {TIER[m.data.tier].label}
                  </div>
                  <div className="whitespace-pre-wrap">{m.data.answer}</div>

                  {m.data.citations.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {m.data.citations.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setPolicy(kb.find((e) => e.id === c.id) ?? null)}
                          className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600 transition hover:bg-brand-soft hover:text-brand"
                          title="View the source policy"
                        >
                          📎 {c.source}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Linked resources (e.g. Schedule a tour) */}
                  {actions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {actions.map((a) => (
                        <a
                          key={a.href}
                          href={a.href}
                          target={a.href.startsWith("http") ? "_blank" : undefined}
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-brand bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand transition hover:bg-brand hover:text-white"
                        >
                          {a.label} →
                        </a>
                      ))}
                    </div>
                  )}

                  {canConnect && (
                    <button
                      onClick={() => setConnectForm({ logId: m.logId })}
                      className="mt-3 inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                    >
                      🧑 Talk to a staff member →
                    </button>
                  )}
                </div>

                {m.data.intent !== "error" && (
                  <div className="flex items-center gap-2 px-1 text-xs text-neutral-500">
                    {!fb ? (
                      <>
                        <span>Did this help?</span>
                        <button onClick={() => setFeedback(m.logId, "up")} className="rounded-md px-1.5 py-0.5 hover:bg-emerald-50" aria-label="Yes">👍</button>
                        <button onClick={() => setFeedback(m.logId, "down")} className="rounded-md px-1.5 py-0.5 hover:bg-rose-50" aria-label="No">👎</button>
                      </>
                    ) : fb === "up" ? (
                      <span className="text-emerald-600">Thanks — glad that helped. 💚</span>
                    ) : (
                      <span className="text-neutral-400">Thanks for the feedback.</span>
                    )}
                    <CopyButton text={m.data.answer} />
                  </div>
                )}

                {connected && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                    ✓ Connected — our team will follow up. You can also call{" "}
                    <a href={`tel:${CENTER.phone.replace(/[^0-9]/g, "")}`} className="font-semibold underline">{CENTER.phone}</a> anytime.
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {busy && <div className="text-sm text-neutral-400">{ASSISTANT_NAME} is thinking…</div>}
        <div ref={endRef} />
      </div>

      {/* Persistent suggestions — clicking removes only that one */}
      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-2 px-5 pb-2">
          {remaining.map((s) => (
            <button
              key={s}
              onClick={() => pickSuggestion(s)}
              disabled={busy}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 transition hover:border-brand hover:text-brand disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); ask(input); }}
        className="sticky bottom-0 border-t border-neutral-200 bg-white px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the front desk…"
            className="min-w-0 flex-1 rounded-full border border-neutral-300 px-4 py-2.5 text-[15px] outline-none focus:border-brand"
          />
          <button disabled={busy || !input.trim()} className="shrink-0 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40">
            Send
          </button>
        </div>
      </form>

      {/* Source-policy viewer */}
      {policy && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-6" onClick={() => setPolicy(null)}>
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-[11px] font-medium uppercase tracking-wide text-brand">{policy.source}</div>
            <div className="mt-1 text-base font-semibold">{policy.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-700">{policy.body}</p>
            <div className="mt-4 text-right">
              <button onClick={() => setPolicy(null)} className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Connect-to-staff contact form */}
      {connectForm && <ContactForm onCancel={() => setConnectForm(null)} onSubmit={submitConnect} />}

      {/* First-visit consent */}
      {consented === false && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <div className="text-base font-semibold">Before we start</div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              {ASSISTANT_NAME} is an AI assistant for general questions about {CENTER.name}. To help our team follow up and
              improve the front desk, we keep the questions you ask and any contact details you choose to share. We
              don&apos;t sell your information, and you can ask for a person at any time. By continuing, you agree to this.
            </p>
            <div className="mt-4 flex justify-end">
              <button onClick={agree} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">I agree — let&apos;s go</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="group/copy relative inline-flex">
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {}
        }}
        aria-label="Copy text"
        className="rounded-md px-1.5 py-0.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
      >
        {copied ? "✓" : "📋"}
      </button>
      {/* visible tooltip on hover (accessibility + clarity) */}
      <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition group-hover/copy:opacity-100">
        {copied ? "Copied!" : "Copy text"}
      </span>
    </span>
  );
}

const URGENCY: { value: Urgency; label: string }[] = [
  { value: "low", label: "Not urgent" },
  { value: "normal", label: "Sometime soon" },
  { value: "high", label: "Urgent" },
];

function ContactForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (c: Contact) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("normal");
  const valid = name.trim().length > 1 && phone.trim().length >= 7;
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-6" onClick={onCancel}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-base font-semibold">Let&apos;s get you to a person</div>
        <p className="mt-1 text-sm text-neutral-600">Share a few details so our team can follow up with you directly.</p>
        <div className="mt-4 space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" inputMode="tel" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" inputMode="email" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand" />
          <div>
            <div className="mb-1.5 text-xs font-medium text-neutral-600">How urgent is this?</div>
            <div className="flex gap-2">
              {URGENCY.map((u) => (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => setUrgency(u.value)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                    urgency === u.value
                      ? u.value === "high"
                        ? "border-rose-300 bg-rose-50 text-rose-700"
                        : "border-brand bg-brand-soft text-brand"
                      : "border-neutral-200 text-neutral-500 hover:border-neutral-300"
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-neutral-500">Cancel</button>
          <button
            disabled={!valid}
            onClick={() => onSubmit({ name: name.trim(), phone: phone.trim(), email: email.trim(), urgency })}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Connect me
          </button>
        </div>
      </div>
    </div>
  );
}
