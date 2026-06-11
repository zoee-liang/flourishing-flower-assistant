import Link from "next/link";
import { CENTER } from "@/lib/seed";
import { CONFIG } from "@/lib/config";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-brand">
        <span className="text-lg">{CONFIG.brand.emoji}</span> AI Front Desk · proof of concept
      </div>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        {CONFIG.brand.tagline}
      </h1>
      <p className="mt-4 text-lg text-neutral-600">
        {CONFIG.assistant.name}, an AI front desk for <strong>{CENTER.name}</strong>. It answers routine parent questions
        instantly and with a cited source — and the moment a question touches a child&apos;s health,
        safety, or anything it isn&apos;t sure about, it hands the parent to a real person instead of
        guessing.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/parent"
          className="group rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:border-brand hover:shadow-md"
        >
          <div className="text-2xl">👋</div>
          <div className="mt-3 text-lg font-semibold">Parent</div>
          <p className="mt-1 text-sm text-neutral-600">
            Ask the front desk a question, like you would by phone or text.
          </p>
          <div className="mt-4 text-sm font-medium text-brand group-hover:underline">Open the front desk →</div>
        </Link>

        <Link
          href="/operator"
          className="group rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:border-brand hover:shadow-md"
        >
          <div className="text-2xl">🗂️</div>
          <div className="mt-3 text-lg font-semibold">Operator</div>
          <p className="mt-1 text-sm text-neutral-600">
            Edit the source of truth, see where the desk struggled, and teach it.
          </p>
          <div className="mt-4 text-sm font-medium text-brand group-hover:underline">Open the control center →</div>
        </Link>
      </div>

      <div className="mt-10 rounded-xl bg-brand-soft p-5 text-sm text-neutral-700">
        <div className="font-semibold text-brand">Try the 3-tier design:</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>&ldquo;Are you open on Veterans Day?&rdquo; → Tier 1, answered, with a citation.</li>
          <li>&ldquo;What&apos;s your fever policy?&rdquo; → Tier 2, the policy, grounded.</li>
          <li>
            &ldquo;My child has a fever, can they come in?&rdquo; → Tier 3, it shares the policy but
            refuses to make the call, and gets a human.
          </li>
        </ul>
      </div>
    </main>
  );
}
