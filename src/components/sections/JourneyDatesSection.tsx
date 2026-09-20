import { CalendarPlus, CalendarDays, Trophy, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { eventConfig, prizes } from "@/data/site-config";
import { CAMPUS_OPTIONS, type CampusCode } from "@/lib/registration/schema";

interface CampusSlotInfo {
  registered: number;
  cap: number;
}

// Zero-padded ("05th", not "5th") per the organizers' preferred date style.
function ordinal(n: number) {
  const padded = String(n).padStart(2, "0");
  if (n % 10 === 1 && n % 100 !== 11) return `${padded}st`;
  if (n % 10 === 2 && n % 100 !== 12) return `${padded}nd`;
  if (n % 10 === 3 && n % 100 !== 13) return `${padded}rd`;
  return `${padded}th`;
}

function formatDate(d: Date) {
  return `${ordinal(d.getDate())} ${d.toLocaleDateString("en-IN", { month: "long" })} ${d.getFullYear()}`;
}

// Zero-padded hour ("04:00 PM", not "4:00 PM") to match the ordinal style above.
function formatTime(d: Date) {
  let h = d.getHours() % 12;
  if (h === 0) h = 12;
  const ampm = d.getHours() < 12 ? "AM" : "PM";
  return `${String(h).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${ampm}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${formatDate(d)}, ${formatTime(d)}`;
}

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN").format(amount);
}

/**
 * A date/venue callout that actually reads as an important fact instead of
 * a caption line - an icon badge + kicker up top, a gold-tinted card so it
 * stands apart from plain text. Carries every fact a participant needs to
 * actually show up: start and end (each with its own time, not just a bare
 * date), a separate "Reporting" line for the one moment that actually
 * matters operationally, and the venue(s) - several rows when they differ
 * by campus (Campus Level), one row otherwise (University Level).
 */
function DateHighlightCard({
  icon: Icon,
  kicker,
  startIso,
  endIso,
  statusNote,
  showReporting = false,
  venues,
}: {
  icon: LucideIcon;
  kicker: string;
  startIso: string;
  endIso: string;
  /** Registration's open/closed line - the only card that doesn't report to a venue. */
  statusNote?: string;
  /** Derives "Reporting: <time>" from startIso's own time-of-day, rather than a separately hand-maintained value that could drift from it. */
  showReporting?: boolean;
  /** One row per venue, in the same VSP -> HYD -> BLR order used everywhere else in the app. */
  venues?: { label: string; venue: string }[];
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/15 via-void to-void px-6 py-6 transition-colors hover:border-gold/70">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <span className="font-mono text-[11px] tracking-[0.25em] text-gold uppercase">{kicker}</span>
      </div>

      <div className="mt-5 flex flex-col gap-0.5">
        <p className="font-display text-lg leading-tight tracking-wide text-ink sm:text-xl">{formatDateTime(startIso)}</p>
        <p className="font-heading text-[11px] tracking-[0.2em] text-ink-faint uppercase">to</p>
        <p className="font-display text-lg leading-tight tracking-wide text-ink sm:text-xl">{formatDateTime(endIso)}</p>
      </div>

      {statusNote && <p className="mt-3 font-heading text-sm text-ink-muted">{statusNote}</p>}
      {showReporting && (
        <p className="mt-3 font-heading text-xs font-semibold text-gold">Reporting: {formatTime(new Date(startIso))}</p>
      )}

      {venues && venues.length > 0 && (
        <dl className="mt-3 flex flex-col gap-1 border-t border-gold/20 pt-3">
          {venues.map((v) => (
            <div key={v.label} className="flex items-center justify-between gap-3 font-heading text-xs">
              <dt className="text-ink-muted">{v.label}</dt>
              <dd className="text-right text-ink">{v.venue}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

const totalPrizeInr = prizes.reduce((sum, p) => sum + p.amountInr, 0);

/**
 * Act 2 - The Journey, Part 1: Key Dates. Split out of what used to be one
 * crowded "Journey" section (date cards + the round-by-round roadmap
 * together) so each half comfortably fits a single screen - this half is
 * purely "when and where do I need to be." The round-by-round roadmap lives
 * in JourneyRoundsSection (Act 3) instead.
 */
export function JourneyDatesSection({
  campusSlots,
}: {
  /** One slot = one team, per campus - from get_team_counts_by_campus (supabase/migrations/0080). Used only for the total-slots stat below. */
  campusSlots: Partial<Record<CampusCode, CampusSlotInfo>>;
}) {
  const totalSlots = CAMPUS_OPTIONS.every((c) => campusSlots[c.code])
    ? CAMPUS_OPTIONS.reduce((sum, c) => sum + (campusSlots[c.code]?.cap ?? 0), 0)
    : null;

  return (
    <section
      id="journey"
      className="flex min-h-screen flex-col justify-center border-t border-border bg-surface px-6 py-16 sm:px-10 lg:px-16"
    >
      <div className="mx-auto w-full max-w-7xl">
        <Reveal>
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Act 2 - The Journey</span>
          <h2 className="mt-4 font-display text-6xl tracking-wide text-ink sm:text-8xl">KEY DATES</h2>
        </Reveal>

        <Reveal stagger className="mt-10 grid gap-4 sm:grid-cols-3">
          <DateHighlightCard
            icon={CalendarPlus}
            kicker="Registration Window"
            startIso={eventConfig.registrationStart}
            endIso={eventConfig.registrationEnd}
            statusNote={eventConfig.registrationStatus === "open" ? "Registration is currently open" : "Registration is now closed"}
          />
          <DateHighlightCard
            icon={CalendarDays}
            kicker="Campus Level"
            startIso={eventConfig.eventStart}
            endIso={eventConfig.eventEnd}
            showReporting
            venues={CAMPUS_OPTIONS.map((c) => ({ label: c.label, venue: eventConfig.venueByCampus[c.code] }))}
          />
          <DateHighlightCard
            icon={Trophy}
            kicker="University Level"
            startIso={eventConfig.universityLevelStart}
            endIso={eventConfig.universityLevelEnd}
            showReporting
            venues={[{ label: "Venue", venue: eventConfig.universityLevelVenue }]}
          />
        </Reveal>

        <Reveal className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 border-t border-border pt-8 text-center">
          <div>
            <p className="font-display text-3xl tracking-wide text-gold sm:text-4xl">3</p>
            <p className="mt-1 font-mono text-[11px] tracking-[0.2em] text-ink-faint uppercase">Campuses</p>
          </div>
          <div>
            <p className="font-display text-3xl tracking-wide text-gold sm:text-4xl">{totalSlots ?? "-"}</p>
            <p className="mt-1 font-mono text-[11px] tracking-[0.2em] text-ink-faint uppercase">Total Slots</p>
          </div>
          <div>
            <p className="font-display text-3xl tracking-wide text-gold sm:text-4xl">₹{formatInr(totalPrizeInr)}</p>
            <p className="mt-1 font-mono text-[11px] tracking-[0.2em] text-ink-faint uppercase">In Prizes</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
