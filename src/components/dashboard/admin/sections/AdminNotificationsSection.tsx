"use client";

import { useState } from "react";
import type { NotificationRow } from "@/types/database";
import {
  markNotificationRead,
  broadcastNotification,
  DashboardActionError,
  type BroadcastAudience,
} from "@/lib/dashboard/admin-actions";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";

type View = "all" | "by-status";

const AUDIENCE_OPTIONS: { value: BroadcastAudience; label: string }[] = [
  { value: "Member", label: "All Members" },
  { value: "Team Lead", label: "Leads" },
  { value: "SPOC", label: "SPOCs" },
];

/** SPEC §70-72/§75 — SPOC and Super Admin both get notified on new registrations, pending approvals, NOC/Exit Form uploads, etc. Super Admin can additionally broadcast a notification to a chosen audience. */
export function AdminNotificationsSection({
  notifications,
  scope,
}: {
  notifications: NotificationRow[];
  scope: "spoc" | "admin";
}) {
  const [local, setLocal] = useState(notifications);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [view, setView] = useState<View>("all");
  const fadeRef = useTabFade(view);

  const [audience, setAudience] = useState<BroadcastAudience>("Member");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      const count = await broadcastNotification(title.trim(), message.trim(), audience);
      const audienceLabel = AUDIENCE_OPTIONS.find((o) => o.value === audience)?.label ?? audience;
      setSendSuccess(`Sent to ${count} ${audienceLabel.toLowerCase()}.`);
      setTitle("");
      setMessage("");
    } catch (err) {
      setSendError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  async function handleClick(n: NotificationRow) {
    if (n.read) return;
    setPendingId(n.id);
    try {
      await markNotificationRead(n.id);
      setLocal((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    } finally {
      setPendingId(null);
    }
  }

  function renderItem(n: NotificationRow) {
    return (
      <button
        key={n.id}
        type="button"
        onClick={() => handleClick(n)}
        disabled={pendingId === n.id}
        className={`rounded-xl border p-4 text-left transition-colors disabled:opacity-60 ${
          n.read ? "border-border bg-surface" : "border-gold/40 bg-gold/5"
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="font-heading text-sm font-semibold text-ink">{n.title}</p>
          {!n.read && <span className="size-1.5 rounded-full bg-gold" aria-hidden />}
        </div>
        <p className="mt-1 font-heading text-sm text-ink-muted">{n.message}</p>
        <p className="mt-2 font-mono text-xs text-ink-faint">{new Date(n.created_at).toLocaleString()}</p>
      </button>
    );
  }

  const unread = local.filter((n) => !n.read);
  const read = local.filter((n) => n.read);

  return (
    <div className="flex flex-col gap-6">
      {scope === "admin" && (
        <form onSubmit={handleSend} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-6">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Send Notification</span>
          <div className="flex flex-wrap gap-2">
            {AUDIENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAudience(opt.value)}
                className={`rounded-lg border px-3 py-1.5 font-heading text-xs transition-colors ${
                  audience === opt.value
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-border text-ink-muted hover:border-gold hover:text-gold"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            required
            className="rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message"
            rows={3}
            required
            className="rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={sending}
              className="w-fit rounded-full bg-gold px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
            >
              {sending ? "Sending…" : "Send"}
            </button>
            {sendError && <p className="font-heading text-xs text-danger">{sendError}</p>}
            {sendSuccess && <p className="font-heading text-xs text-gitam">{sendSuccess}</p>}
          </div>
        </form>
      )}

      {local.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-heading text-sm text-ink-muted">No notifications yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <ViewToggle
            value={view}
            onChange={setView}
            options={[
              { value: "all", label: "By Date" },
              { value: "by-status", label: "By Status" },
            ]}
          />

          <div ref={fadeRef} className="flex flex-col gap-4">
            {view === "all" ? (
              <div className="flex flex-col gap-2">{local.map(renderItem)}</div>
            ) : (
              <>
                <div>
                  <p className="mb-2 font-heading text-xs tracking-[0.2em] text-gold uppercase">
                    Unread ({unread.length})
                  </p>
                  {unread.length === 0 ? (
                    <p className="font-heading text-sm text-ink-muted">Nothing unread.</p>
                  ) : (
                    <div className="flex flex-col gap-2">{unread.map(renderItem)}</div>
                  )}
                </div>
                <div>
                  <p className="mb-2 font-heading text-xs tracking-[0.2em] text-ink-muted uppercase">
                    Read ({read.length})
                  </p>
                  {read.length === 0 ? (
                    <p className="font-heading text-sm text-ink-muted">Nothing read yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">{read.map(renderItem)}</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
