import { Reveal } from "@/components/motion/Reveal";
import { GalleryCarousel } from "@/components/sections/GalleryCarousel";
import { gallery } from "@/data/site-config";

/**
 * Act 4 — The Energy (prompt.md §13, §43). Previous-year photography as a
 * single-photo carousel — smooth auto-advancing crossfade — rather than a
 * plain grid. `gallery` is empty until organizers supply real photos
 * (prompt.md "No Fake Data") — this renders a structurally-complete empty
 * state until then.
 */
export function GallerySection() {
  return (
    <section id="gallery" className="border-t border-border bg-surface px-6 py-28 sm:px-10 lg:px-16">
      <Reveal className="mx-auto mb-14 max-w-7xl">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Act 4 — The Energy</span>
        <h2 className="mt-4 font-display text-6xl tracking-wide text-ink sm:text-8xl">LAST YEAR</h2>
      </Reveal>

      <div className="mx-auto max-w-4xl">
        {gallery.length === 0 ? (
          <Reveal className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong bg-void/40 px-6 py-24 text-center">
            <span className="font-mono text-xs tracking-[0.3em] text-ink-faint uppercase">Gallery pending</span>
            <p className="mt-4 max-w-md font-heading text-ink-muted">
              Previous-year event photography will appear here as soon as the organizers publish it through Admin
              Configuration — no placeholder images are shown in their place.
            </p>
          </Reveal>
        ) : (
          <Reveal>
            <GalleryCarousel images={gallery} />
          </Reveal>
        )}
      </div>
    </section>
  );
}
