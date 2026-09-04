"use client";

/** Closes this tab — works because the dashboard's card grid links here without noopener/noreferrer, so window.opener (and thus window.close permission) is preserved. */
export function CloseTabButton() {
  return (
    <button
      type="button"
      onClick={() => window.close()}
      className="rounded-full border border-gold/50 px-4 py-2 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
    >
      Close Tab
    </button>
  );
}
