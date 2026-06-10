import Link from "next/link";

export default function ExamplePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="text-4xl">🌸</div>
      <h1 className="mt-4 text-xl font-semibold">Demo placeholder</h1>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">
        In a real deployment this link would open the actual resource — e.g. the tour-scheduling form, the enrollment
        portal, or a payment page. For this proof of concept, it just lands here.
      </p>
      <Link href="/parent" className="mt-6 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
        ← Back to the front desk
      </Link>
    </main>
  );
}
