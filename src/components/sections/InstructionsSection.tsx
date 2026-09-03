import { Reveal } from "@/components/motion/Reveal";
import { registrationGuidelines, eventConfig } from "@/data/site-config";

function ordinal(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return `${n}st`;
  if (n % 10 === 2 && n % 100 !== 12) return `${n}nd`;
  if (n % 10 === 3 && n % 100 !== 13) return `${n}rd`;
  return `${n}th`;
}

function formatEventDateRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const day = (d: Date) => ordinal(d.getDate());
  const month = (d: Date) => d.toLocaleDateString("en-IN", { month: "long" });
  const year = (d: Date) => d.getFullYear();
  if (month(start) === month(end) && year(start) === year(end)) {
    return `${day(start)}–${day(end)} ${month(start)} ${year(start)}`;
  }
  return `${day(start)} ${month(start)} ${year(start)} – ${day(end)} ${month(end)} ${year(end)}`;
}

/**
 * Important Instructions + the NOC notice (SPEC.md §39, "highly visible
 * throughout the registration period" — not a footnote).
 */
export function InstructionsSection() {
  return (
    <section id="instructions" className="border-t border-border bg-void px-6 py-16 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mb-10">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Act 7 — The Briefing</span>
          <h2 className="mt-4 font-display text-5xl tracking-wide text-ink sm:text-7xl">GOOD TO KNOW</h2>
        </Reveal>

        <Reveal className="grid gap-10 rounded-2xl border border-border bg-surface px-8 py-10 text-center sm:grid-cols-3 sm:py-12">
          <div>
            <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Event Dates</span>
            <p className="mt-3 font-heading text-2xl text-ink">
              {formatEventDateRange(eventConfig.eventStart, eventConfig.eventEnd)}
            </p>
          </div>
          <div>
            <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Reporting Time</span>
            <p className="mt-3 font-heading text-2xl text-ink">{eventConfig.reportingTime}</p>
          </div>
          <div>
            <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Venue</span>
            <p className="mt-3 font-heading text-2xl text-ink">{eventConfig.venue}</p>
          </div>
        </Reveal>

        <Reveal className="mt-8 overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/15 via-void to-void px-8 py-10 text-center sm:py-12">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Mandatory</span>
          <p className="mt-4 font-display text-3xl tracking-wide text-ink sm:text-5xl">
            NOC SUBMISSION IS COMPULSORY FOR EVERY PARTICIPANT
          </p>
        </Reveal>

        <Reveal className="mt-8 overflow-hidden rounded-2xl border border-mdc/40 bg-mdc/10 px-8 py-6 text-center">
          <span className="font-mono text-xs tracking-[0.3em] text-mdc uppercase">Special Mention</span>
          <p className="mt-3 font-heading text-base leading-relaxed text-ink sm:text-lg">{eventConfig.breakfastNotice}</p>
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
            <p className="mt-3 font-heading text-2xl text-ink">Released on the hackathon day</p>
          </div>
        </Reveal>

        <Reveal className="mt-10">
          <h3 className="font-heading text-sm tracking-[0.3em] text-ink-muted uppercase">Important Instructions</h3>
          <p className="mt-4 max-w-3xl font-heading leading-relaxed text-ink-muted">{registrationGuidelines.content}</p>
        </Reveal>
      </div>
    </section>
  );
}
