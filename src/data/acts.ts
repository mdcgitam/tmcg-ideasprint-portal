export interface Act {
  id: string;
  number: string;
  label: string;
  /** id of the DOM element (a <section id="...">) this act begins at */
  targetId: string;
  /**
   * id of the DOM element this act's range ends at, when it spans more than
   * one rendered section. Omit to let the rail infer the end from the next
   * act's start.
   */
  endTargetId?: string;
}

/**
 * Mirrors the "Act X" eyebrow labels visible on each homepage section (see
 * each section's own `<span>` eyebrow) — kept in sync by hand since there's
 * no single source of truth in the section components themselves. The
 * ActRail is what finally exposes this structure as one continuous,
 * always-visible chapter list instead of a label you only see once as you
 * scroll past each section header. Every rendered section gets its own
 * entry here, Judges included — if you renumber this list, the eyebrow
 * `<span>` in the matching section component needs the same number.
 */
export const acts: Act[] = [
  { id: "arrival", number: "1", label: "Arrival", targetId: "hero" },
  { id: "challenge", number: "2", label: "The Challenge", targetId: "domains" },
  { id: "journey", number: "3", label: "The Journey", targetId: "journey" },
  { id: "energy", number: "4", label: "The Energy", targetId: "gallery" },
  { id: "panel", number: "5", label: "The Panel", targetId: "judges" },
  { id: "reward", number: "6", label: "The Reward", targetId: "prizes" },
  { id: "briefing", number: "7", label: "The Briefing", targetId: "instructions" },
  { id: "questions", number: "8", label: "Questions", targetId: "faq" },
  { id: "contact", number: "9", label: "Contact", targetId: "contact" },
];
