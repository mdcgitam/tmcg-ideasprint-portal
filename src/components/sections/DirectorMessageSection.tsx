import Image from "next/image";
import { User } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { directorMessage } from "@/data/site-config";

/**
 * Act 6 - A Word From Our Director. Photo + message, a human beat between
 * the hard logistics (Journey/Instructions/Prizes) and the social proof
 * (Judges/Gallery/Contact). `directorMessage` is null until the organizers
 * supply it - renders a clearly-labelled placeholder rather than a
 * fabricated name/quote, same pattern as JudgesSection's empty state.
 */
export function DirectorMessageSection() {
  return (
    <section
      id="directors-message"
      className="flex min-h-screen flex-col justify-center border-t border-border bg-void px-6 py-16 sm:px-10 lg:px-16"
    >
      <div className="mx-auto w-full max-w-5xl">
        <Reveal className="mb-12">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Act 6 - A Word From Our Director</span>
          <h2 className="mt-4 font-display text-5xl tracking-wide text-ink sm:text-7xl">DIRECTOR&apos;S MESSAGE</h2>
        </Reveal>

        {directorMessage ? (
          <Reveal className="flex flex-col items-center gap-10 sm:flex-row sm:items-start">
            <div className="relative size-40 shrink-0 overflow-hidden rounded-2xl border border-gold/40 sm:size-48">
              <Image src={directorMessage.photo.src} alt={directorMessage.photo.alt} fill className="object-cover" />
            </div>
            <div className="text-center sm:text-left">
              <p className="font-heading text-lg leading-relaxed text-ink-muted italic sm:text-xl">
                &ldquo;{directorMessage.message}&rdquo;
              </p>
              <p className="mt-6 font-display text-2xl tracking-wide text-ink">{directorMessage.name}</p>
              <p className="mt-1 font-heading text-sm text-ink-faint">{directorMessage.designation}</p>
            </div>
          </Reveal>
        ) : (
          <Reveal className="flex flex-col items-center gap-10 rounded-2xl border border-dashed border-border-strong bg-surface/40 px-6 py-16 text-center sm:flex-row sm:items-start sm:text-left">
            <div className="flex size-40 shrink-0 items-center justify-center rounded-2xl border border-border-strong bg-surface/60 text-ink-faint sm:size-48">
              <User className="size-16" strokeWidth={1.25} />
            </div>
            <div>
              <span className="font-mono text-xs tracking-[0.3em] text-ink-faint uppercase">Coming soon</span>
              <p className="mt-4 max-w-md font-heading text-ink-muted">
                A message from our Director will be published here soon.
              </p>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
