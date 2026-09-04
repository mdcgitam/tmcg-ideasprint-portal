"use client";

import { useState, useSyncExternalStore } from "react";

const SESSION_KEY = "ideasprint-registrations-closed-seen";

function subscribe() {
  return () => {};
}
function getSnapshot() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}
function getServerSnapshot() {
  return false;
}

/** Shown once per browser session when all 100 team slots are filled — informational only, doesn't block the registration form itself. */
export function RegistrationClosedPopup({ isFull }: { isFull: boolean }) {
  // useSyncExternalStore, not an effect+setState — this is a one-shot read of
  // an external store (sessionStorage), with a server snapshot that matches
  // what SSR renders, so there's no hydration mismatch to work around.
  const alreadySeen = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [dismissed, setDismissed] = useState(false);

  const open = isFull && !alreadySeen && !dismissed;

  function handleClose() {
    setDismissed(true);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Nothing to do — worst case it shows again next reload.
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onClick={handleClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-md rounded-2xl border border-gold/40 bg-surface p-8 text-center"
      >
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Registrations Closed</span>
        <p className="mt-4 font-display text-2xl text-ink">All 100 Team Slots Are Full</p>
        <p className="mt-3 font-heading text-sm text-ink-muted">
          IdeaSprint 4.0 has reached its registration cap. Thanks for your interest — follow our socials for updates
          on future events.
        </p>
        <button
          type="button"
          onClick={handleClose}
          className="mt-6 rounded-full bg-gold px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
