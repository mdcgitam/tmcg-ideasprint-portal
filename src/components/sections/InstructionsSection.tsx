import { Reveal } from "@/components/motion/Reveal";
import { eventConfig } from "@/data/site-config";

/**
 * Act 3 — The Briefing. Event date/venue/reporting-time now lives in the
 * Journey section (Act 2) instead of here — this section is registration
 * logistics + the mandatory NOC notice + (when configured) Terms &
 * Conditions.
 */
export function InstructionsSection({ tncUrl }: { tncUrl: string | null }) {
  return (
    <section id="instructions" className="border-t border-border bg-void px-6 py-16 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mb-10">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Act 3 — The Briefing</span>
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

        <Reveal className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Slots</span>
            <p className="mt-3 font-heading text-2xl text-ink">First 100 teams only</p>
          </div>
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
