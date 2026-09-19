import type { ReactNode } from "react";
import type { CampusCode } from "@/types/database";
import { CloseTabButton } from "./CloseTabButton";
import { HomeButton } from "./HomeButton";
import { RefreshOnFocus } from "@/components/dashboard/RefreshOnFocus";

/**
 * Shared header (title + Home/Close-tab buttons) for every standalone
 * section page opened from the dashboard's card grid.
 */
export function SectionPageShell({
  title,
  campus,
  homeHref,
  headerExtra,
  children,
}: {
  title: string;
  scope: "spoc" | "admin";
  /** Appends " - <CODE> Campus" to the title when scoped to one campus; omitted (or null, e.g. the Super Admin's "All" view) leaves the title bare. */
  campus?: CampusCode | null;
  /** This viewer's own dashboard grid — dashboardPathForRole(profile.role) at the call site. */
  homeHref: string;
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
          <div className="flex items-center gap-2">
            <HomeButton href={homeHref} />
            <CloseTabButton />
          </div>
        </div>
        {headerExtra ? <div className="-mt-2 mb-8">{headerExtra}</div> : null}
        {children}
      </div>
    </main>
  );
}
