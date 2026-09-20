import { GraduationCap, Users, Plane, Trophy, Utensils, Ticket, FileQuestion, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { CAMPUS_OPTIONS, type CampusCode } from "@/lib/registration/schema";

interface CampusSlotInfo {
  registered: number;
  cap: number;
}

interface InfoCard {
  icon: LucideIcon;
  kicker: string;
  title: string;
  detail: string;
}

// The 7-point brief distilled into scannable cards instead of one long
// stacked feed (SPEC.md facts + organizer-supplied clarifications) - NOC and
// Campus Level Slots stay their own prominent blocks below since they're
// the two facts participants most need to act on, everything else groups
// here.
const INFO_CARDS: InfoCard[] = [
  {
    icon: GraduationCap,
    kicker: "Eligibility",
    title: "B.Tech & M.Tech, School of CSE & CE",
    detail: "Open to students of the School of CSE & CE across all three campuses - Visakhapatnam, Hyderabad, and Bangalore.",
  },
  {
    icon: Users,
    kicker: "Team Size",
    title: "3 to 4 Members",
    detail: "Every team must have a minimum of 3 and a maximum of 4 members, including the Team Lead.",
  },
  {
    icon: Trophy,
    kicker: "Prize Money",
    title: "Awarded Only at University Level",
    detail: "Campus Level results are non-monetary. The full prize pool is awarded only to the winners of the Grand Finale.",
  },
  {
    icon: Utensils,
    kicker: "What's Provided",
    title: "Refreshments Only",
    detail: "Food and accommodation are not provided to Campus Level participants - only refreshments are planned.",
  },
  {
    icon: Ticket,
    kicker: "Registration Fee",
    title: "No Registration Fee",
    detail: "There is no registration fee for IdeaSprint 4.0, at either the Campus Level or the University Level.",
  },
  {
    icon: FileQuestion,
    kicker: "Problem Statements",
    title: "Released on the Hackathon Day",
    detail: "Problem statements are not published in advance - they're released to teams on the day of the Campus Level event.",
  },
];

/**
 * Act 4 - The Briefing. Event date/venue/reporting-time lives in the Journey
 * sections (Act 2 - Key Dates, Act 3 - The Rounds) instead of here - this
 * section is registration logistics: eligibility/team/prize/catering facts,
 * the mandatory NOC notice, live campus slot counts, the Grand Finale travel
 * note, and (when configured) Terms & Conditions.
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
    <section id="instructions" className="flex min-h-screen flex-col justify-center border-t border-border bg-void px-6 py-16 sm:px-10 lg:px-16">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal className="mb-10">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Act 4 - The Briefing</span>
          <h2 className="mt-4 font-display text-5xl tracking-wide text-ink sm:text-7xl">INSTRUCTIONS</h2>
        </Reveal>

        <Reveal className="overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/15 via-void to-void px-8 py-8 text-center sm:py-10">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Mandatory</span>
          <p className="mt-4 font-display text-2xl tracking-wide text-ink sm:text-4xl">
            NOC SUBMISSION IS COMPULSORY FOR EVERY PARTICIPANT
          </p>
          <p className="mt-3 font-heading text-sm text-ink-muted">
            A digital signature from a parent or hostel warden is <span className="font-semibold text-ink">not</span> acceptable.
          </p>
        </Reveal>

        <Reveal stagger className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INFO_CARDS.map((card) => (
            <div key={card.kicker} className="rounded-2xl border border-border bg-surface/60 px-5 py-5">
              <span className="flex size-9 items-center justify-center rounded-full bg-gold/15 text-gold">
                <card.icon className="size-4.5" strokeWidth={1.75} />
              </span>
              <span className="mt-3 block font-mono text-[11px] tracking-[0.25em] text-gold uppercase">{card.kicker}</span>
              <p className="mt-2 font-heading text-base font-semibold text-ink">{card.title}</p>
              <p className="mt-2 font-heading text-sm text-ink-muted">{card.detail}</p>
            </div>
          ))}
        </Reveal>

        <Reveal className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface/60 px-6 py-6 sm:px-8">
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

        <Reveal className="mt-6 flex items-start gap-4 rounded-2xl border border-border bg-surface/60 px-6 py-5 sm:px-8">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
            <Plane className="size-4.5" strokeWidth={1.75} />
          </span>
          <div>
            <span className="font-mono text-[11px] tracking-[0.25em] text-gold uppercase">Grand Finale Travel</span>
            <p className="mt-2 font-heading text-sm text-ink-muted">
              Teams shortlisted for the University Level from Hyderabad and Bangalore travel to the Visakhapatnam campus.
              Travel and accommodation for the Grand Finale are covered by the organizing committee.
            </p>
          </div>
        </Reveal>

        {tncUrl && (
          <Reveal className="mt-6 overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/15 via-void to-void px-8 py-8 text-center">
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
