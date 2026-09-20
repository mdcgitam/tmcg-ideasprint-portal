import Image from "next/image";
import { Reveal } from "@/components/motion/Reveal";
import { contacts } from "@/data/site-config";
import type { ContactScope } from "@/types/config";

/**
 * Act 8 - Contact. All 5 organizer contacts (4 TMCG + 1 MDC) as photo cards
 * in a responsive grid (ideasprint_changes.pdf item 7). This site serves all
 * three campuses at once, so who to reach out to isn't obvious from a name
 * and a title alone - each card gets an explicit scope badge (a campus, "All
 * Campuses", or nothing for a non-campus role) rather than folding that into
 * the designation sentence.
 */
export function ContactSection() {
  return (
    <section id="contact" className="border-t border-border bg-void px-6 py-16 sm:px-10 lg:px-16">
      <Reveal className="mx-auto mb-10 max-w-7xl">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Act 8 - Contact</span>
        <h2 className="mt-4 font-display text-6xl tracking-wide text-ink sm:text-7xl">TALK TO US</h2>
      </Reveal>

      <Reveal stagger className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {contacts.map((c) => (
          <ContactCard
            key={c.id}
            name={c.name}
            designation={c.designation}
            scope={c.scope}
            phone={c.phone}
            email={c.email}
            photo={c.photo}
            accent={c.org === "MDC" ? "mdc" : "gold"}
          />
        ))}
      </Reveal>
    </section>
  );
}

function ContactCard({
  name,
  designation,
  scope,
  phone,
  email,
  photo,
  accent = "gold",
}: {
  name: string;
  designation: string;
  scope: ContactScope;
  phone: string;
  email: string;
  photo: { src: string; alt: string };
  accent?: "gold" | "mdc";
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-surface/60 px-6 py-8 text-center">
      <div
        className={`size-24 overflow-hidden rounded-full border-2 ${accent === "gold" ? "border-gold/50" : "border-mdc/50"}`}
      >
        <Image src={photo.src} alt={photo.alt} width={192} height={192} className="size-full object-cover" />
      </div>
      <p className="mt-4 font-display text-xl tracking-wide text-ink">{name}</p>
      <p className={accent === "gold" ? "font-heading text-sm text-gold" : "font-heading text-sm text-mdc"}>
        {designation}
      </p>
      {scope && (
        <span className="mt-2 rounded-full border border-border-strong px-3 py-0.5 font-mono text-[10px] tracking-[0.2em] text-ink-muted uppercase">
          {scope}
        </span>
      )}
      <div className="mt-3 flex flex-col gap-1 font-mono text-xs text-ink-faint">
        <span>{phone || "Phone pending"}</span>
        <span>{email || "Email pending"}</span>
      </div>
    </div>
  );
}
