import Link from "next/link";

/**
 * Back to this role's own dashboard grid. Close Tab alone isn't reliable —
 * window.close() silently no-ops on a tab the browser didn't consider
 * script-opened (a bookmark, a typed URL, a link shared outside the app,
 * or a tab that outlived the one that opened it) — so this is the fallback
 * that always works.
 */
export function HomeButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-border px-4 py-2 font-heading text-xs font-medium text-ink-muted transition-colors hover:border-gold hover:text-gold"
    >
      Home
    </Link>
  );
}
