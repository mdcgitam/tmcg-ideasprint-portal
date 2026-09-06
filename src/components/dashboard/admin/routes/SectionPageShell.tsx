import type { ReactNode } from "react";
import { CloseTabButton } from "./CloseTabButton";

/**
 * Shared header (title + close-tab button) for every standalone section page
 * opened from the dashboard's card grid. No "Back to Dashboard" link — each
 * section already opens in its own new tab, so closing the tab is the way
 * back.
 */
export function SectionPageShell({
  title,
  headerExtra,
  children,
}: {
  title: string;
  scope: "spoc" | "admin";
  /** Optional bar under the title — used for the Zone Manager venue tabs. */
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-void px-6 pt-12 pb-16 sm:px-10 sm:pt-14 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl text-ink sm:text-4xl">{title}</h1>
          <CloseTabButton />
        </div>
        {headerExtra ? <div className="-mt-2 mb-8">{headerExtra}</div> : null}
        {children}
      </div>
    </main>
  );
}
