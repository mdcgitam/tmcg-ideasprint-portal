import Image from "next/image";
import { Mail, User } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { SOCIAL_ICON } from "@/components/motion/SocialIcon";
import { contacts, socialLinks } from "@/data/site-config";
import type { ContactScope } from "@/types/config";

const SOCIAL_CTA_LABEL: Record<string, string> = {
  whatsapp: "Join our WhatsApp Group",
  instagram: "Follow us on Instagram",
};

const CONTACT_EMAIL = "tmcg_gcgc@gitam.edu";
const SOCIAL_CTA_CLASS =
  "inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface/60 px-4 py-2 font-heading text-sm font-medium text-ink transition-colors hover:border-gold/60 hover:text-gold";

/**
 * Act 10 - Contact. All organizer contacts as photo cards in a responsive
 * grid (ideasprint_changes.pdf item 7). This site serves all three campuses
 * at once, so who to reach out to isn't obvious from a name and a title
 * alone - each card gets an explicit scope badge (a campus, "All Campuses",
 * or nothing for a non-campus role) rather than folding that into the
 * designation sentence.
 *
 * The WhatsApp/Instagram links also live in the Footer, but participants
 * often never scroll that far - joining the group and following for updates
 * matters enough that it gets its own visible row here too, not just a
 * pair of small icons at the very bottom of the page.
 */
export function ContactSection() {
  return (
    <section id="contact" className="min-h-[89svh] border-t border-border bg-void px-6 pt-6 pb-8 sm:px-10 sm:pt-8 sm:pb-10 lg:px-16">
      <Reveal className="mx-auto mb-6 max-w-7xl">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Act 10 - Contact</span>
        <h2 className="mt-3 font-display text-5xl tracking-wide text-ink sm:text-7xl">TALK TO US</h2>
      </Reveal>

      <Reveal className="mx-auto mb-6 flex max-w-7xl flex-col items-center gap-3 rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-void to-void px-6 py-4 text-center sm:flex-row sm:justify-center sm:gap-6">
        <span className="font-mono text-xs tracking-[0.25em] text-gold uppercase">Stay In The Loop</span>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {socialLinks.filter((s) => s.url).map((s) => (
            <a
              key={s.platform}
              href={s.url!}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor="interactive"
              className={SOCIAL_CTA_CLASS}
            >
              {SOCIAL_ICON[s.platform]}
              {SOCIAL_CTA_LABEL[s.platform] ?? s.label}
            </a>
          ))}
          <a href={`mailto:${CONTACT_EMAIL}`} data-cursor="interactive" className={SOCIAL_CTA_CLASS}>
            <Mail className="size-5" strokeWidth={1.75} />
            Email Us
          </a>
        </div>
      </Reveal>

      <Reveal stagger className="mx-auto grid max-w-7xl gap-5 sm:grid-cols-2 lg:grid-cols-6">
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
  photo: { src: string; alt: string; isPlaceholder?: boolean };
  accent?: "gold" | "mdc";
}) {
  // The @student.gitam.edu addresses run noticeably longer than @gitam.in -
  // one size down keeps every card's email on a tidy single line instead of
  // stretching edge-to-edge.
  const isLongEmail = email.length > 20;

  return (
    <div className="flex h-full flex-col items-center rounded-2xl border border-border bg-surface/60 px-5 py-8 text-center">
      <div
        className={`flex size-24 items-center justify-center overflow-hidden rounded-full border-2 ${accent === "gold" ? "border-gold/50" : "border-mdc/50"}`}
      >
        {photo.isPlaceholder ? (
          <User className="size-10 text-ink-faint" strokeWidth={1.5} />
        ) : (
          <Image src={photo.src} alt={photo.alt} width={192} height={192} className="size-full object-cover" />
        )}
      </div>
      <p className="mt-4 font-display text-xl tracking-wide text-ink">{name}</p>
      <p className={accent === "gold" ? "font-heading text-sm text-gold" : "font-heading text-sm text-mdc"}>
        {designation}
      </p>
      {scope && (
        <span className="mt-3 rounded-full border border-border-strong px-3 py-0.5 font-mono text-[10px] tracking-[0.2em] text-ink-muted uppercase">
          {scope}
        </span>
      )}
      {/* Rendered as real tel:/mailto: links rather than plain text - these are
          the only way to reach an organizer directly, and on a phone (where
          most participants read this) flat text means copying a number by
          hand. Falls back to plain text when a detail hasn't been supplied. */}
      <div className="mt-auto flex flex-col gap-1.5 pt-4 font-mono text-xs text-ink-faint">
        {phone ? (
          <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} data-cursor="interactive" className="transition-colors hover:text-gold">
            {phone}
          </a>
        ) : (
          <span>Phone pending</span>
        )}
        {email ? (
          <a
            href={`mailto:${email}`}
            data-cursor="interactive"
            className={`transition-colors hover:text-gold ${isLongEmail ? "text-[11px]" : ""}`}
          >
            {email}
          </a>
        ) : (
          <span className={isLongEmail ? "text-[11px]" : undefined}>Email pending</span>
        )}
      </div>
    </div>
  );
}
