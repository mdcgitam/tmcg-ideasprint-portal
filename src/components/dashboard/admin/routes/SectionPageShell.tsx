import type { ReactNode } from "react";
import type { CampusCode } from "@/types/database";
import { CloseTabButton } from "./CloseTabButton";
import { RefreshOnFocus } from "@/components/dashboard/RefreshOnFocus";

/**
 * Shared header (title + Close-tab button) for every standalone section
 * page opened from the dashboard's card grid. `homeHref` is accepted but
 * deliberately unused for now — every call site already passes it, and a
 * Home button was tried and asked to be removed ("Close is enough for
 * now"), so the prop stays wired in case it comes back later instead of
 * touching every route file to rip it out.
 */
export function SectionPageShell({
  title,
  campus,
  headerExtra,
  children,
}: {
  title: string;
  scope: "spoc" | "admin";
  /** Appends " - <CODE> Campus" to the title when scoped to one campus; omitted (or null, e.g. the Super Admin's "All" view) leaves the title bare. */
  campus?: CampusCode | null;
  /** This viewer's own dashboard grid — dashboardPathForRole(profile.role) at the call site. Currently unused (see doc comment above). */
  homeHref?: string;
  /** Optional bar under the title — used for the Zone Manager venue tabs. */
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  const displayTitle = campus ? `${title} - ${campus} Campus` : title;
  return (
    <main className="min-h-screen bg-void px-6 pt-12 pb-16 sm:px-10 sm:pt-14 lg:px-16">
      <RefreshOnFocus />
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl text-ink sm:text-4xl">{displayTitle}</h1>
          <CloseTabButton />
        </div>
        {headerExtra ? <div className="-mt-2 mb-8">{headerExtra}</div> : null}
        {children}
      </div>
    </main>
  );
}
