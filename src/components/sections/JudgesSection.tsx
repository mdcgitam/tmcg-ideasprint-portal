import Image from "next/image";
import { Reveal } from "@/components/motion/Reveal";
import { judges } from "@/data/site-config";

/**
 * Act 5 — The Panel (prompt.md §14). Judges as an accordion of expanding
 * portraits rather than photo+name+designation cards. `judges` is empty
 * until organizers confirm the panel — no fabricated names are shown.
 */
export function JudgesSection() {
  return (
    <section id="judges" className="border-t border-border bg-void px-6 py-28 sm:px-10 lg:px-16">
      <Reveal className="mx-auto mb-14 max-w-7xl">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Act 5 — The Panel</span>
        <h2 className="mt-4 font-display text-6xl tracking-wide text-ink sm:text-8xl">JUDGES</h2>
      </Reveal>

      <div className="mx-auto max-w-7xl">
        {judges.length === 0 ? (
          <Reveal className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong bg-surface/40 px-6 py-24 text-center">
            <span className="font-mono text-xs tracking-[0.3em] text-ink-faint uppercase">Panel to be announced</span>
            <p className="mt-4 max-w-md font-heading text-ink-muted">
              The judging panel will be published here once confirmed by the organizers.
            </p>
          </Reveal>
        ) : (
          <Reveal stagger className="flex h-[28rem] gap-2 overflow-hidden rounded-2xl">
            {judges.map((judge) => (
              <div
                key={judge.id}
                data-cursor="interactive"
                className="group relative flex-1 overflow-hidden rounded-xl transition-[flex-grow] duration-500 ease-out hover:flex-[3]"
              >
                <Image src={judge.photo.src} alt={judge.photo.alt} fill className="object-cover grayscale transition-all duration-500 group-hover:grayscale-0" />
                <div className="absolute inset-0 bg-gradient-to-t from-void via-void/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <p className="font-display text-2xl tracking-wide text-ink opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    {judge.name}
                  </p>
                  <p className="font-heading text-xs text-ink-muted opacity-0 transition-opacity delay-75 duration-300 group-hover:opacity-100">
                    {judge.designation}
                  </p>
                </div>
              </div>
            ))}
          </Reveal>
        )}
      </div>
    </section>
  );
}
