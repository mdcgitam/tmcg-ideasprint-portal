import Link from "next/link";
import type { ReactNode } from "react";
import { CloseTabButton } from "./CloseTabButton";

/** Shared header (title + back link + close-tab button) for every standalone section page opened from the dashboard's card grid. */
export function SectionPageShell({
  title,
  scope,
  children,
}: {
  title: string;
  scope: "spoc" | "admin";
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-void px-6 pt-12 pb-16 sm:px-10 sm:pt-14 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href={`/dashboard/${scope}`}
              className="font-mono text-xs tracking-[0.3em] text-ink-muted uppercase transition-colors hover:text-gold"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="mt-3 font-display text-3xl text-ink sm:text-4xl">{title}</h1>
          </div>
          <CloseTabButton />
        </div>
        {children}
      </div>
    </main>
  );
}
