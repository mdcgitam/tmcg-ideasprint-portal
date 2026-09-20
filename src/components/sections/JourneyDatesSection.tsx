import { CalendarPlus, CalendarDays, Trophy, MapPin, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { eventConfig } from "@/data/site-config";
import { CAMPUS_OPTIONS } from "@/lib/registration/schema";

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

/**
 * A date callout that actually reads as an important fact instead of a
 * caption line - an icon badge + kicker up top, a gold-tinted card so it
 * stands apart from plain text. Carries start and end (each with its own
 * time, not just a bare date) and a separate "Reporting" line for the one
 * moment that actually matters operationally. Venues live in their own
 * dedicated, larger block below (VenuesBlock) instead of being crammed into
 * these cards - that made them unreadable and left the three cards uneven
 * in height.
 */
function DateHighlightCard({
  icon: Icon,
  kicker,
  startIso,
  endIso,
  statusNote,
  showReporting = false,
}: {
  icon: LucideIcon;
  kicker: string;
  startIso: string;
  endIso: string;
  /** Registration's open/closed line - the only card without a reporting time. */
  statusNote?: string;
  /** Derives "Reporting: <time>" from startIso's own time-of-day, rather than a separately hand-maintained value that could drift from it. */
  showReporting?: boolean;
}) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/15 via-void to-void px-6 py-5 transition-colors hover:border-gold/70">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
          <Icon className="size-4.5" strokeWidth={1.75} />
        </span>
        <span className="font-mono text-[11px] tracking-[0.25em] text-gold uppercase">{kicker}</span>
      </div>

      <div className="mt-4 flex flex-col gap-0.5">
        <p className="font-display text-lg leading-tight tracking-wide text-ink sm:text-xl">{formatDateTime(startIso)}</p>
        <p className="font-heading text-[11px] tracking-[0.2em] text-ink-faint uppercase">to</p>
        <p className="font-display text-lg leading-tight tracking-wide text-ink sm:text-xl">{formatDateTime(endIso)}</p>
      </div>

      {statusNote && <p className="mt-2 font-heading text-sm text-ink-muted">{statusNote}</p>}
      {showReporting && (
        <p className="mt-2 font-heading text-xs font-semibold text-gold">Reporting: {formatTime(new Date(startIso))}</p>
      )}
    </div>
  );
}

/**
 * Venues, given their own large, clearly-labelled block instead of a small
 * text row buried inside a date card - Campus Level gets one badge per
 * campus (VSP -> HYD -> BLR), University Level gets a single wide banner.
 */
function VenuesBlock() {
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-2xl border border-border bg-surface/60 px-6 py-5 sm:px-8">
        <span className="font-mono text-[11px] tracking-[0.25em] text-gold uppercase">Campus Level Venues</span>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {CAMPUS_OPTIONS.map((c) => (
            <div key={c.code} className="flex items-start gap-3 rounded-xl border border-border bg-void/60 px-6 py-5">
              <MapPin className="mt-0.5 size-6 shrink-0 text-gold" strokeWidth={1.75} />
              <div>
                <p className="font-heading text-xs tracking-wide text-ink-faint uppercase">{c.label}</p>
                <p className="mt-1 font-heading text-sm font-semibold text-ink">{eventConfig.venueByCampus[c.code]}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col justify-center rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/15 via-void to-void px-6 py-5 sm:px-8">
        <span className="font-mono text-[11px] tracking-[0.25em] text-gold uppercase">University Level Venue</span>
        <div className="mt-3 flex items-start gap-3">
          <MapPin className="mt-0.5 size-5 shrink-0 text-gold" strokeWidth={1.75} />
          <p className="font-heading text-lg font-semibold text-ink">{eventConfig.universityLevelVenue}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Act 2 - The Journey, Part 1: Key Dates. Split out of what used to be one
 * crowded "Journey" section (date cards + the round-by-round roadmap
 * together) so each half comfortably fits a single screen - this half is
 * purely "when and where do I need to be." The round-by-round roadmap lives
 * in JourneyRoundsSection (Act 3) instead.
 */
export function JourneyDatesSection() {
  return (
    <section
      id="journey"
      className="min-h-[90svh] border-t border-border bg-surface px-6 pt-6 pb-6 sm:px-10 sm:pt-8 sm:pb-8 lg:px-16"
    >
      <div className="mx-auto w-full max-w-7xl">
        <Reveal>
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Act 2 - The Journey</span>
          <h2 className="mt-2 font-display text-4xl tracking-wide text-ink sm:text-6xl">KEY DATES</h2>
        </Reveal>

        <Reveal stagger className="mt-6 grid gap-4 sm:grid-cols-3">
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
          />
          <DateHighlightCard
            icon={Trophy}
            kicker="University Level"
            startIso={eventConfig.universityLevelStart}
            endIso={eventConfig.universityLevelEnd}
            showReporting
          />
        </Reveal>

        <VenuesBlock />
      </div>
    </section>
  );
}
