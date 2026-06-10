"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useDesk, AskLog } from "../providers";
import { CENTER } from "@/lib/seed";
import { CONFIG } from "@/lib/config";
import { KBEntry } from "@/lib/types";

const MIN_PER_AUTO = CONFIG.settings.minutesSavedPerAnswer; // est. staff minutes saved per resolved question
const URGENCY_LABEL: Record<string, string> = { low: "Not urgent", normal: "Sometime soon", high: "Urgent" };
const NAV = [
  { id: "dashboard", label: "Overview", icon: "📊" },
  { id: "policies", label: "Policies", icon: "📄" },
  { id: "archived", label: "Archived", icon: "🗂️" },
  { id: "support", label: "Brightwheel Support", icon: "🛟" },
] as const;
type NavId = (typeof NAV)[number]["id"];

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || `entry-${Date.now()}`;
}
function reasonFor(x: AskLog): string {
  if (x.humanRequested) return "🧑 Parent connected to a person";
  if (x.feedback === "down") return "👎 Parent marked this answer unhelpful";
  return x.guardReason || "Escalated";
}
function ago(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function urgRank(x: AskLog) {
  return x.contact?.urgency === "high" ? 0 : x.contact?.urgency === "normal" ? 1 : x.contact?.urgency === "low" ? 2 : 3;
}

const BLANK: KBEntry = { id: "", category: "General", title: "", body: "", source: "Operator-added", sensitive: false };

export default function OperatorPage() {
  const { kb, upsertEntry, deleteEntry, resetKb, log, resolveItem, restoreItem, stats } = useDesk();
  const [nav, setNav] = useState<NavId>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [draft, setDraft] = useState<KBEntry | null>(null);
  const [detail, setDetail] = useState<AskLog | null>(null);
  // policy filters
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [onlySensitive, setOnlySensitive] = useState(false);

  const active = useMemo(
    () => log.filter((x) => (x.escalated || x.feedback === "down" || x.humanRequested) && !x.resolved),
    [log]
  );
  const queue = useMemo(() => [...active].sort((a, b) => urgRank(a) - urgRank(b) || a.at - b.at), [active]);
  const archived = useMemo(() => log.filter((x) => x.resolved), [log]);
  const negatives = useMemo(() => log.filter((x) => x.feedback === "down"), [log]);
  const categories = useMemo(() => Array.from(new Set(kb.map((e) => e.category))), [kb]);
  const policies = useMemo(
    () =>
      kb.filter((e) => {
        if (onlySensitive && !e.sensitive) return false;
        if (category !== "all" && e.category !== category) return false;
        if (query.trim()) {
          const q = query.toLowerCase();
          if (!`${e.title} ${e.body} ${e.category} ${e.source}`.toLowerCase().includes(q)) return false;
        }
        return true;
      }),
    [kb, onlySensitive, category, query]
  );
  const minutesSaved = stats.answered * MIN_PER_AUTO;
  const fbTotal = stats.thumbsUp + stats.thumbsDown;
  const positiveRate = fbTotal ? Math.round((stats.thumbsUp / fbTotal) * 100) : 0;
  const negativeRate = fbTotal ? Math.round((stats.thumbsDown / fbTotal) * 100) : 0;

  function startTeach(question: string) {
    setDraft({ ...BLANK, id: slug(question), title: question });
  }
  function save() {
    if (!draft) return;
    const e = { ...draft, id: draft.id || slug(draft.title) };
    if (!e.title.trim() || !e.body.trim()) return;
    upsertEntry(e);
    setDraft(null);
  }

  // Export every interaction as newline-delimited JSON (NDJSON) — the warehouse-
  // friendly shape a data pipeline would land in a `fact_interaction` table.
  function exportData() {
    const rows = log.map((x) =>
      JSON.stringify({
        event_at: new Date(x.at).toISOString(),
        question: x.question,
        answer: x.answer,
        summary: x.summary ?? null,
        tier: x.tier,
        escalated: x.escalated,
        intent: x.intent,
        confidence: x.confidence,
        guard_reason: x.guardReason ?? null,
        feedback: x.feedback ?? null,
        human_requested: !!x.humanRequested,
        urgency: x.contact?.urgency ?? null,
        cost_usd: x.costUsd ?? 0,
        input_tokens: x.inputTokens ?? 0,
        output_tokens: x.outputTokens ?? 0,
      })
    );
    const blob = new Blob([rows.join("\n")], { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interactions-${new Date().toISOString().slice(0, 10)}.ndjson`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const navTitle = NAV.find((n) => n.id === nav)?.label ?? "";

  return (
    <div className="flex min-h-screen">
      {/* Foldable side panel */}
      <aside className={`sticky top-0 h-screen shrink-0 border-r border-neutral-200 bg-white transition-all ${collapsed ? "w-14" : "w-14 md:w-56"}`}>
        <div className="flex items-center justify-between px-3 py-3">
          {!collapsed && <div className="hidden text-sm font-semibold md:block">Control Center</div>}
          <button onClick={() => setCollapsed((c) => !c)} className="hidden rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 md:inline-flex" title={collapsed ? "Expand" : "Collapse"}>
            {collapsed ? "»" : "«"}
          </button>
        </div>
        <nav className="space-y-1 px-2">
          {NAV.map((n) => {
            const activeNav = nav === n.id;
            const badge = n.id === "dashboard" ? active.length : n.id === "archived" ? archived.length : 0;
            return (
              <button
                key={n.id}
                onClick={() => setNav(n.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${activeNav ? "bg-brand-soft font-medium text-brand" : "text-neutral-600 hover:bg-neutral-100"}`}
                title={n.label}
              >
                <span>{n.icon}</span>
                {!collapsed && <span className="hidden flex-1 text-left md:inline">{n.label}</span>}
                {!collapsed && badge > 0 && <span className="hidden rounded-full bg-rose-100 px-1.5 text-[10px] font-semibold text-rose-700 md:inline">{badge}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1 px-4 py-5 md:px-6 md:py-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">{navTitle}</div>
            <div className="text-xs text-neutral-500">{CENTER.name}</div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link href="/parent" className="font-medium text-brand hover:underline">Parent view</Link>
            <button onClick={exportData} className="text-neutral-500 hover:text-brand">⬇ Export</button>
            <button onClick={resetKb} className="text-neutral-400 hover:text-rose-500">Reset demo</button>
          </div>
        </header>

        {/* DASHBOARD (tiles → requests → charts) */}
        {nav === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Questions handled" value={String(stats.total)} />
              <Stat label="Auto-answered" value={`${stats.rate}%`} sub={`${stats.answered}/${stats.total || 0} resolved`} tone="emerald" />
              <Stat label="Staff time saved" value={`~${minutesSaved}m`} sub={`${MIN_PER_AUTO} min/answer`} tone="emerald" />
              <Stat label="Connected to staff" value={String(stats.humanRequests)} tone="rose" />
            </div>

            {/* Requests (inline) */}
            <div>
              <div className="mb-1 text-sm font-semibold">Requests</div>
              <p className="mb-3 text-xs text-neutral-500">
                Sorted by urgency, then longest-waiting first. Click a row for the parent&apos;s info and full conversation.
              </p>
              {queue.length === 0 ? (
                <Empty>Nothing waiting. Ask something the bot can&apos;t answer in the parent view.</Empty>
              ) : (
                <div className="space-y-2">
                  {queue.map((x) => (
                    <div key={x.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <button onClick={() => setDetail(x)} className="min-w-0 flex-1 text-left">
                          <div className="flex items-center gap-2">
                            {x.contact?.urgency === "high" && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">URGENT</span>}
                            <span className="truncate text-sm font-medium">{x.summary || x.question}</span>
                          </div>
                          <div className="mt-1 text-xs text-neutral-500">
                            {reasonFor(x)}
                            {x.contact && <span className="text-neutral-400"> · {x.contact.name}</span>}
                            <span className="text-neutral-400"> · {ago(x.at)}</span>
                            <span className="text-brand"> · view →</span>
                          </div>
                        </button>
                        <div className="flex shrink-0 gap-2">
                          <button onClick={() => startTeach(x.question)} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white">Teach the answer</button>
                          <button onClick={() => resolveItem(x.id)} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50">Archive</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Feedback */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-neutral-200 bg-white p-5">
                <div className="text-sm font-semibold">Parent satisfaction</div>
                <div className="mt-2 flex items-end gap-6">
                  <div>
                    <div className="text-3xl font-semibold text-emerald-600">{positiveRate}%</div>
                    <div className="text-xs text-neutral-500">positive</div>
                  </div>
                  <div>
                    <div className="text-3xl font-semibold text-rose-500">{negativeRate}%</div>
                    <div className="text-xs text-neutral-500">negative</div>
                  </div>
                </div>
                <div className="mt-1 text-xs text-neutral-400">{stats.thumbsUp}👍 / {stats.thumbsDown}👎</div>
                <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-neutral-100">
                  <div className="bg-emerald-500" style={{ width: `${fbTotal ? (stats.thumbsUp / fbTotal) * 100 : 0}%` }} />
                  <div className="bg-rose-500" style={{ width: `${fbTotal ? (stats.thumbsDown / fbTotal) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-white p-5">
                <div className="text-sm font-semibold">Resolution mix</div>
                <div className="mt-3 space-y-2">
                  <Bar label="Auto-answered" value={stats.answered} total={stats.total} color="bg-emerald-500" />
                  <Bar label="Needed a person" value={stats.escalated} total={stats.total} color="bg-rose-400" />
                </div>
              </div>
            </div>

            {/* Cost monitoring */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <div className="text-sm font-semibold">AI cost (estimated)</div>
              <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-xl font-semibold">${stats.totalCostUsd.toFixed(4)}</div>
                  <div className="text-xs text-neutral-500">total</div>
                </div>
                <div>
                  <div className="text-xl font-semibold">${stats.avgCostUsd.toFixed(4)}</div>
                  <div className="text-xs text-neutral-500">avg / query</div>
                </div>
                <div>
                  <div className="text-xl font-semibold">${(stats.avgCostUsd * 1000).toFixed(2)}</div>
                  <div className="text-xs text-neutral-500">per 1,000 queries</div>
                </div>
                <div>
                  <div className="text-xl font-semibold">{stats.totalTokens.toLocaleString()}</div>
                  <div className="text-xs text-neutral-500">tokens</div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-neutral-400">claude-haiku-4-5 · ~$1 / $5 per 1M tokens (in/out) · prompt caching enabled</div>
            </div>

            {/* Negative feedback to review */}
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <div className="mb-1 text-sm font-semibold">Negative feedback to review</div>
              <p className="mb-3 text-xs text-neutral-500">Answers parents marked unhelpful — your best signal for what to teach next.</p>
              {negatives.length === 0 ? (
                <div className="text-sm text-neutral-400">No negative feedback yet.</div>
              ) : (
                <div className="space-y-2">
                  {negatives.map((x) => (
                    <button key={x.id} onClick={() => setDetail(x)} className="block w-full rounded-lg border border-neutral-200 p-3 text-left hover:border-brand">
                      <div className="text-sm font-medium">“{x.question}”</div>
                      {x.summary && <div className="mt-0.5 text-xs text-neutral-500">{x.summary}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* POLICIES */}
        {nav === "policies" && (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search policies…" className="w-48 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-brand" />
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-brand">
                <option value="all">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                <input type="checkbox" checked={onlySensitive} onChange={(e) => setOnlySensitive(e.target.checked)} />
                Sensitive only
              </label>
              <div className="ml-auto flex items-center gap-2 text-xs text-neutral-400">
                {policies.length} of {kb.length}
                <button onClick={() => setDraft({ ...BLANK })} className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-brand hover:bg-brand-soft">+ Add policy</button>
              </div>
            </div>
            {policies.length === 0 ? (
              <Empty>No policies match your filters.</Empty>
            ) : (
              <div className="space-y-2">
                {policies.map((e) => (
                  <div key={e.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{e.title}</span>
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">{e.category}</span>
                          {e.sensitive && <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-600">sensitive</span>}
                        </div>
                        <div className="mt-1 text-xs leading-relaxed text-neutral-600">{e.body}</div>
                        <div className="mt-1.5 text-[11px] text-neutral-400">📎 {e.source}</div>
                      </div>
                      <div className="flex shrink-0 gap-2 text-xs">
                        <button onClick={() => setDraft(e)} className="text-brand hover:underline">Edit</button>
                        <button onClick={() => deleteEntry(e.id)} className="font-medium text-rose-600 hover:text-rose-700 hover:underline">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ARCHIVED */}
        {nav === "archived" && (
          <div>
            <p className="mb-3 text-xs text-neutral-500">Conversations you&apos;ve handled and archived. Click to review; restore to send back to the queue.</p>
            {archived.length === 0 ? (
              <Empty>Nothing archived yet. Archive a request from the queue to see it here.</Empty>
            ) : (
              <div className="space-y-2">
                {archived.map((x) => (
                  <div key={x.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <button onClick={() => setDetail(x)} className="min-w-0 flex-1 text-left">
                        <div className="truncate text-sm font-medium">{x.summary || x.question}</div>
                        <div className="mt-1 text-xs text-neutral-500">{reasonFor(x)}{x.contact && ` · ${x.contact.name}`} · {ago(x.at)}</div>
                      </button>
                      <button onClick={() => restoreItem(x.id)} className="shrink-0 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50">Restore</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BRIGHTWHEEL SUPPORT */}
        {nav === "support" && (
          <div className="max-w-md rounded-xl border border-neutral-200 bg-white p-6">
            <div className="text-2xl">🛟</div>
            <div className="mt-2 text-base font-semibold">Brightwheel Support</div>
            <p className="mt-1 text-sm text-neutral-600">Help for you and your staff with the Brightwheel platform.</p>
            <div className="mt-4 space-y-2 text-sm">
              <a href="mailto:support@mybrightwheel.com" className="flex items-center gap-2 text-brand hover:underline">✉️ support@mybrightwheel.com</a>
              <a href="https://help.mybrightwheel.com" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-brand hover:underline">📚 help.mybrightwheel.com</a>
              <a href="tel:18889010252" className="flex items-center gap-2 text-brand hover:underline">📞 (888) 901-0252</a>
            </div>
          </div>
        )}
      </main>

      {/* Editor */}
      {draft && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-6" onClick={() => setDraft(null)}>
          <div className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 text-sm font-semibold">{kb.some((x) => x.id === draft.id) ? "Edit policy" : "Teach a new policy"}</div>
            <Field label="Title (or the parent's question)">
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand" />
            </Field>
            <Field label="Answer / policy text">
              <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={4} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand" />
              </Field>
              <Field label="Source / citation">
                <input value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand" />
              </Field>
            </div>
            <label className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
              <input type="checkbox" checked={!!draft.sensitive} onChange={(e) => setDraft({ ...draft, sensitive: e.target.checked })} />
              Mark as sensitive (health / safety / legal — the desk shares it but never makes the call)
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDraft(null)} className="rounded-lg px-4 py-2 text-sm text-neutral-500">Cancel</button>
              <button onClick={save} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">Save policy</button>
            </div>
          </div>
        </div>
      )}

      {/* Conversation detail */}
      {detail && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" onClick={() => setDetail(null)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold">{detail.summary || "Conversation detail"}</div>
                <div className="mt-0.5 text-xs text-neutral-500">{reasonFor(detail)} · {ago(detail.at)}</div>
              </div>
              <button onClick={() => setDetail(null)} className="text-xs text-neutral-400 hover:text-neutral-700">Close</button>
            </div>

            <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">Parent</div>
              {detail.contact ? (
                <div className="space-y-0.5 text-neutral-700">
                  <div className="font-medium">
                    {detail.contact.name}
                    {detail.contact.urgency === "high" && <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">URGENT</span>}
                  </div>
                  <div>📞 <a href={`tel:${detail.contact.phone.replace(/[^0-9+]/g, "")}`} className="text-brand hover:underline">{detail.contact.phone}</a></div>
                  {detail.contact.email && <div>✉️ <a href={`mailto:${detail.contact.email}`} className="text-brand hover:underline">{detail.contact.email}</a></div>}
                  <div className="text-neutral-500">⏱ {URGENCY_LABEL[detail.contact.urgency] ?? detail.contact.urgency}</div>
                </div>
              ) : (
                <div className="text-neutral-400">No contact on file — the parent didn&apos;t connect to a person.</div>
              )}
            </div>

            <div className="mt-4">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">Full conversation</div>
              <div className="space-y-3">
                {[...log].reverse().map((t) => (
                  <div key={t.id} className={`rounded-lg p-2 ${t.id === detail.id ? "ring-1 ring-brand" : ""}`}>
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-3 py-1.5 text-xs text-white">{t.question}</div>
                    </div>
                    <div className="mt-1.5 flex justify-start">
                      <div className="max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-neutral-100 px-3 py-1.5 text-xs text-neutral-700">{t.answer}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { startTeach(detail.question); setDetail(null); }} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">Teach the answer</button>
              {detail.resolved ? (
                <button onClick={() => { restoreItem(detail.id); setDetail(null); }} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50">Restore</button>
              ) : (
                <button onClick={() => { resolveItem(detail.id); setDetail(null); }} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50">Archive</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "emerald" | "rose" }) {
  const color = tone === "emerald" ? "text-emerald-600" : tone === "rose" ? "text-rose-600" : "text-neutral-900";
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="mt-0.5 text-xs text-neutral-500">{label}{sub ? ` · ${sub}` : ""}</div>
    </div>
  );
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-neutral-600">
        <span>{label}</span>
        <span className="text-neutral-400">{value} · {pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-400">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-xs font-medium text-neutral-600">{label}</div>
      {children}
    </div>
  );
}
