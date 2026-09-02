import { Reveal } from "@/components/motion/Reveal";
import { contacts } from "@/data/site-config";

/**
 * Act 9 — Contact. All 4 organizer contacts (3 TMCG + 1 MDC) in a single
 * horizontal row (ideasprint_changes.pdf item 7), wrapping only below the
 * `sm` breakpoint. Names/numbers are organizer-provided placeholders
 * (SPEC.md §87) until Admin Configuration is populated.
 */
export function ContactSection() {
  return (
    <section id="contact" className="border-t border-border bg-void px-6 py-16 sm:px-10 lg:px-16">
      <Reveal className="mx-auto mb-10 max-w-7xl">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Act 9 — Contact</span>
        <h2 className="mt-4 font-display text-6xl tracking-wide text-ink sm:text-7xl">TALK TO US</h2>
      </Reveal>

      <Reveal stagger className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:flex-wrap">
        {contacts.map((c) => (
          <ContactRow
            key={c.id}
            name={c.name}
            designation={c.designation}
            phone={c.phone}
            email={c.email}
            accent={c.org === "MDC" ? "mdc" : "gold"}
          />
        ))}
      </Reveal>
    </section>
  );
}

function ContactRow({
  name,
  designation,
  phone,
  email,
  accent = "gold",
}: {
  name: string;
  designation: string;
  phone: string;
  email: string;
  accent?: "gold" | "mdc";
}) {
  return (
    <div className="flex-1 border-b border-border pb-6 sm:min-w-[220px] sm:border-b-0 sm:border-l sm:border-border sm:pb-0 sm:pl-6 sm:first:border-l-0 sm:first:pl-0">
      <p className="font-display text-xl tracking-wide text-ink">{name}</p>
      <p className={accent === "gold" ? "font-heading text-sm text-gold" : "font-heading text-sm text-mdc"}>
        {designation}
      </p>
      <div className="mt-2 flex flex-col gap-1 font-mono text-xs text-ink-faint">
        <span>{phone || "Phone pending"}</span>
        <span>{email || "Email pending"}</span>
      </div>
    </div>
  );
}
