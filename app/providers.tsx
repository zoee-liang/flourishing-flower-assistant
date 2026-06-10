"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { SEED_KB } from "@/lib/seed";
import { Contact, DeskResponse, KBEntry, StruggledItem } from "@/lib/types";

type AskLog = {
  id: string;
  question: string;
  answer: string;
  summary?: string; // AI one-liner for the operator queue
  tier: number;
  escalated: boolean;
  intent: string;
  confidence: number;
  guardReason: string | null;
  at: number;
  resolved?: boolean; // "archived" once the operator dismisses it
  feedback?: "up" | "down"; // parent's thumbs up / down on the answer
  humanRequested?: boolean; // parent opted in to reach a person
  contact?: Contact; // collected when the parent connects to staff
};

type Ctx = {
  kb: KBEntry[];
  upsertEntry: (e: KBEntry) => void;
  deleteEntry: (id: string) => void;
  resetKb: () => void;
  log: AskLog[];
  recordAsk: (question: string, r: DeskResponse) => string; // returns the new log id
  setFeedback: (id: string, value: "up" | "down") => void;
  routeToHuman: (id: string, contact: Contact) => void; // parent confirmed + gave details
  resolveItem: (id: string) => void; // archive
  restoreItem: (id: string) => void; // un-archive
  stats: {
    total: number;
    answered: number;
    escalated: number;
    rate: number;
    thumbsUp: number;
    thumbsDown: number;
    humanRequests: number;
  };
};

const DeskContext = createContext<Ctx | null>(null);
const KB_KEY = "fd_kb_v3"; // bump when the seed KB schema/content changes so stale cached copies are dropped
const LOG_KEY = "fd_log_v3";

export function DeskProvider({ children }: { children: React.ReactNode }) {
  const [kb, setKb] = useState<KBEntry[]>(SEED_KB);
  const [log, setLog] = useState<AskLog[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const k = localStorage.getItem(KB_KEY);
      const l = localStorage.getItem(LOG_KEY);
      if (k) setKb(JSON.parse(k));
      if (l) setLog(JSON.parse(l));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(KB_KEY, JSON.stringify(kb));
  }, [kb, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(LOG_KEY, JSON.stringify(log));
  }, [log, ready]);

  const upsertEntry = (e: KBEntry) =>
    setKb((prev) => {
      const i = prev.findIndex((x) => x.id === e.id);
      if (i === -1) return [...prev, e];
      const next = [...prev];
      next[i] = e;
      return next;
    });
  const deleteEntry = (id: string) => setKb((prev) => prev.filter((x) => x.id !== id));
  const resetKb = () => {
    setKb(SEED_KB);
    setLog([]);
  };

  const recordAsk = (question: string, r: DeskResponse): string => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setLog((prev) => [
      {
        id,
        question,
        answer: r.answer,
        summary: r.summary,
        tier: r.tier,
        escalated: r.escalated,
        intent: r.intent,
        confidence: r.confidence,
        guardReason: r.guardReason,
        at: Date.now(),
      },
      ...prev,
    ]);
    return id;
  };

  const setFeedback = (id: string, value: "up" | "down") =>
    setLog((prev) => prev.map((x) => (x.id === id ? { ...x, feedback: value } : x)));

  const routeToHuman = (id: string, contact: Contact) =>
    setLog((prev) => prev.map((x) => (x.id === id ? { ...x, humanRequested: true, contact } : x)));

  const resolveItem = (id: string) =>
    setLog((prev) => prev.map((x) => (x.id === id ? { ...x, resolved: true } : x)));
  const restoreItem = (id: string) =>
    setLog((prev) => prev.map((x) => (x.id === id ? { ...x, resolved: false } : x)));

  const stats = useMemo(() => {
    const total = log.length;
    const escalated = log.filter((x) => x.escalated).length;
    const answered = total - escalated;
    return {
      total,
      answered,
      escalated,
      rate: total ? Math.round((answered / total) * 100) : 0,
      thumbsUp: log.filter((x) => x.feedback === "up").length,
      thumbsDown: log.filter((x) => x.feedback === "down").length,
      humanRequests: log.filter((x) => x.humanRequested).length, // ACTUAL connections only
    };
  }, [log]);

  const value: Ctx = {
    kb,
    upsertEntry,
    deleteEntry,
    resetKb,
    log,
    recordAsk,
    setFeedback,
    routeToHuman,
    resolveItem,
    restoreItem,
    stats,
  };
  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
}

export function useDesk() {
  const c = useContext(DeskContext);
  if (!c) throw new Error("useDesk must be used within DeskProvider");
  return c;
}

export type { AskLog, StruggledItem };
