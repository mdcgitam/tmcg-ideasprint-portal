import Image from "next/image";
import { Reveal } from "@/components/motion/Reveal";
import { contacts } from "@/data/site-config";

/**
 * Act 8 — Contact. All 4 organizer contacts (2 TMCG + 2 MDC) as photo
 * cards in a responsive grid (ideasprint_changes.pdf item 7).
 */
export function ContactSection() {
  return (
    <section id="contact" className="border-t border-border bg-void px-6 py-16 sm:px-10 lg:px-16">
      <Reveal className="mx-auto mb-10 max-w-7xl">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Act 8 - Contact</span>
        <h2 className="mt-4 font-display text-6xl tracking-wide text-ink sm:text-7xl">TALK TO US</h2>
      </Reveal>

      <Reveal stagger className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {contacts.map((c) => (
          <ContactCard
            key={c.id}
            name={c.name}
            designation={c.designation}
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
  phone,
  email,
  photo,
  accent = "gold",
}: {
  name: string;
  designation: string;
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
      <div className="mt-3 flex flex-col gap-1 font-mono text-xs text-ink-faint">
        <span>{phone || "Phone pending"}</span>
        <span>{email || "Email pending"}</span>
      </div>
    </div>
  );
}
