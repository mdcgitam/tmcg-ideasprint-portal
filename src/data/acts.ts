export interface Act {
  id: string;
  number: string;
  label: string;
  /** id of the DOM element (a <section id="...">) this act begins at */
  targetId: string;
  /**
   * id of the DOM element this act's range ends at, when it spans more than
   * one rendered section (Gallery + Judges share "The Energy"). Omit to let
   * the rail infer the end from the next act's start.
   */
  endTargetId?: string;
}

/**
 * Mirrors the "Act 0X" eyebrow labels already visible on each homepage
 * section (see each section's own `<span>` eyebrow) — kept in sync by hand
 * since there's no single source of truth in the section components
 * themselves. The ActRail is what finally exposes this structure as one
 * continuous, always-visible chapter list instead of a label you only see
 * once as you scroll past each section header.
 */
export const acts: Act[] = [
  { id: "arrival", number: "01", label: "Arrival", targetId: "hero" },
  { id: "challenge", number: "02", label: "The Challenge", targetId: "domains" },
  { id: "journey", number: "03", label: "The Journey", targetId: "journey" },
  { id: "energy", number: "04", label: "The Energy", targetId: "gallery", endTargetId: "judges" },
  { id: "reward", number: "05", label: "The Reward", targetId: "prizes" },
  { id: "briefing", number: "06", label: "The Briefing", targetId: "instructions" },
  { id: "questions", number: "07", label: "Questions", targetId: "faq" },
  { id: "contact", number: "08", label: "Contact", targetId: "contact" },
];
