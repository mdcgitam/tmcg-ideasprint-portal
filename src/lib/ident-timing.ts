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
 * answer for the whole page lifecycle. Deliberately plays on every full page
 * load/refresh, not just once per browser session — the cinematic open is
 * the point, not a one-time-only splash. Always `false` during SSR (no
 * `window` on the server) — corrected once the client-side module evaluates.
 */
export const WILL_PLAY_IDENT =
  typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
