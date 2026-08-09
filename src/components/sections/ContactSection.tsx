import { Reveal } from "@/components/motion/Reveal";
import { contacts } from "@/data/site-config";

const ORG_LABEL: Record<string, string> = { TMCG: "TMCG", MDC: "Meta Developer Communities" };

/**
 * Act 9 — Contact (prompt.md §17, §43). Real people, not four identical
 * cards — grouped by organizing body. Names/numbers are organizer-provided
 * placeholders (SPEC.md §87) until Admin Configuration is populated.
 */
export function ContactSection() {
  const tmcg = contacts.filter((c) => c.org === "TMCG");
  const mdc = contacts.filter((c) => c.org === "MDC");

  return (
    <section id="contact" className="border-t border-border bg-void px-6 py-28 sm:px-10 lg:px-16">
      <Reveal className="mx-auto mb-14 max-w-7xl">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Act 9 — Contact</span>
        <h2 className="mt-4 font-display text-6xl tracking-wide text-ink sm:text-7xl">TALK TO US</h2>
      </Reveal>

      <div className="mx-auto grid max-w-7xl gap-12 sm:grid-cols-2">
        <Reveal stagger>
          <h3 className="mb-6 font-heading text-xs tracking-[0.3em] text-gold uppercase">{ORG_LABEL.TMCG}</h3>
          <div className="space-y-6">
            {tmcg.map((c) => (
              <ContactRow key={c.id} name={c.name} designation={c.designation} phone={c.phone} email={c.email} />
            ))}
          </div>
        </Reveal>

        <Reveal stagger>
          <h3 className="mb-6 font-heading text-xs tracking-[0.3em] text-mdc uppercase">{ORG_LABEL.MDC}</h3>
          <div className="space-y-6">
            {mdc.map((c) => (
              <ContactRow key={c.id} name={c.name} designation={c.designation} phone={c.phone} email={c.email} accent="mdc" />
            ))}
          </div>
        </Reveal>
      </div>
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
    <div className="border-b border-border pb-6">
      <p className="font-display text-2xl tracking-wide text-ink">{name}</p>
      <p className={accent === "gold" ? "font-heading text-sm text-gold" : "font-heading text-sm text-mdc"}>
        {designation}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-6 font-mono text-xs text-ink-faint">
        <span>{phone || "Phone pending"}</span>
        <span>{email || "Email pending"}</span>
      </div>
    </div>
  );
}
