const IDENT_KEY = "ideasprint-ident-seen";

/**
 * When the ident's own fade-out begins, in seconds — this is when Hero's
 * curtain should start parting (they cross-fade rather than running fully
 * serially). Must track StudioIdent.tsx's GSAP timeline exactly: fade-in
 * (stagger 0.15 × 3, duration 0.5) ends at 0.8s, pulse ("+=0.1", duration
 * 0.3 yoyo×1) ends at 1.5s, fade-out starts "+=0.05" after that = 1.55s.
 */
export const IDENT_DURATION = 1.55;

/**
 * Whether the studio ident is about to play on THIS page load — computed
 * once at module evaluation time (client-side) so every consumer (the ident
 * itself, Hero's curtain timing, NavBar's reveal delay) agrees on the same
 * answer for the whole page lifecycle, regardless of exactly when each
 * component's effects happen to run relative to `markIdentSeen()` being
 * called. Always `false` during SSR (no sessionStorage on the server) —
 * corrected once the client-side module evaluates.
 */
export const WILL_PLAY_IDENT =
  typeof window !== "undefined" &&
  !sessionStorage.getItem(IDENT_KEY) &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function markIdentSeen() {
  if (typeof window !== "undefined") sessionStorage.setItem(IDENT_KEY, "1");
}
