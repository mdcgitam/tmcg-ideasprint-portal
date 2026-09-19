import { Reveal } from "@/components/motion/Reveal";
import { eventConfig } from "@/data/site-config";
import { CAMPUS_OPTIONS, type CampusCode } from "@/lib/registration/schema";

interface CampusSlotInfo {
  registered: number;
  cap: number;
}

/**
 * Act 3 — The Briefing. Event date/venue/reporting-time now lives in the
 * Journey section (Act 2) instead of here — this section is registration
 * logistics + the mandatory NOC notice + (when configured) Terms &
 * Conditions.
 */
export function InstructionsSection({
  tncUrl,
  campusSlots,
}: {
  tncUrl: string | null;
  /** One slot = one team, per campus — from get_team_counts_by_campus (supabase/migrations/0080). Missing entries render as "—". */
  campusSlots: Partial<Record<CampusCode, CampusSlotInfo>>;
}) {
  return (
    <section id="instructions" className="border-t border-border bg-void px-6 py-16 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mb-10">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Act 3 - The Briefing</span>
          <h2 className="mt-4 font-display text-5xl tracking-wide text-ink sm:text-7xl">INSTRUCTIONS</h2>
        </Reveal>

        <Reveal className="overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/15 via-void to-void px-8 py-10 text-center sm:py-12">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Mandatory</span>
          <p className="mt-4 font-display text-3xl tracking-wide text-ink sm:text-5xl">
            NOC SUBMISSION IS COMPULSORY FOR EVERY PARTICIPANT
          </p>
        </Reveal>

        <Reveal className="mt-8 grid gap-8 sm:grid-cols-3">
          <div>
            <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Registration Fee</span>
            <p className="mt-3 font-heading text-2xl text-ink">No Registration Fee</p>
          </div>
          <div>
            <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Registration Status</span>
            <p className="mt-3 font-heading text-2xl text-ink capitalize">{eventConfig.registrationStatus}</p>
          </div>
          <div>
            <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Team Size</span>
            <p className="mt-3 font-heading text-2xl text-ink">3 – 4 Members</p>
          </div>
        </Reveal>

        <Reveal className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface/60 px-6 py-6 sm:px-8">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Available Slots - One Slot Per Team</span>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {CAMPUS_OPTIONS.map((c) => {
              const info = campusSlots[c.code];
              const remaining = info ? Math.max(info.cap - info.registered, 0) : null;
              const full = remaining === 0;
              return (
                <div key={c.code} className="rounded-xl border border-border bg-void/60 px-5 py-4">
                  <span className="font-heading text-sm text-ink-muted">{c.label}</span>
                  <p className={`mt-1 font-display text-3xl tracking-wide ${full ? "text-danger" : "text-ink"}`}>
                    {remaining === null ? "-" : full ? "Full" : remaining}
                  </p>
                  <p className="mt-1 font-mono text-[11px] tracking-wide text-ink-faint uppercase">
                    {info ? `of ${info.cap} slots` : "slots"}
                  </p>
                </div>
              );
            })}
          </div>
        </Reveal>

        <Reveal className="mt-8 grid gap-8 sm:grid-cols-1">
          <div>
            <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Problem Statements</span>
            <p className="mt-3 font-heading text-2xl text-ink">Will be Released on the hackathon day</p>
          </div>
        </Reveal>

        {tncUrl && (
          <Reveal className="mt-8 overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/15 via-void to-void px-8 py-8 text-center">
            <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Terms &amp; Conditions</span>
            <p className="mt-3 font-heading text-sm text-ink-muted">
              Please review the official Terms &amp; Conditions before registering.
            </p>
            <a
              href={tncUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block rounded-full border border-gold/50 px-6 py-2.5 font-heading text-sm font-medium text-gold transition-colors hover:bg-gold/10"
            >
              Read Terms &amp; Conditions
            </a>
            <p className="mt-4 font-heading text-xs text-ink-faint">
              By registering for IdeaSprint 4.0, you agree to these Terms &amp; Conditions.
            </p>
          </Reveal>
        )}
      </div>
    </section>
  );
}
