import { IDENT_DURATION, WILL_PLAY_IDENT } from "./ident-timing";

/**
 * Shared timing so the NavBar's logo/link fade-in stays locked to the
 * Hero's blueprint-to-reality reveal even though they're separate
 * components — names kept as CURTAIN_* since that's still the conceptual
 * role (the thing hiding the photo until it's time to reveal it). The
 * sequence starts at CURTAIN_START and the whole "building constructs
 * itself" arc takes CURTAIN_DURATION seconds, so nothing outside the scene
 * itself may appear before REVEAL_AT.
 *
 * CURTAIN_START is pushed back by the studio ident's runway on loads where
 * it's about to play (see ident-timing.ts) — the sequence must not start
 * while the ident is still on screen. WILL_PLAY_IDENT is a stable,
 * module-eval-time snapshot, so this shift is consistent for the whole page
 * lifecycle without Hero/NavBar needing to coordinate with StudioIdent directly.
 */
export const CURTAIN_START = (WILL_PLAY_IDENT ? IDENT_DURATION : 0) + 0.15;
export const CURTAIN_DURATION = 2.6;
export const REVEAL_AT = CURTAIN_START + CURTAIN_DURATION;
