"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { Reveal } from "@/components/motion/Reveal";
import { socialLinks } from "@/data/site-config";
import type { SocialPlatform } from "@/types/config";

const LINKS = [
  { href: "/#gallery", label: "Gallery" },
  { href: "/#prizes", label: "Prizes" },
  { href: "/#faq", label: "FAQ" },
  { href: "/#contact", label: "Contact" },
];

// Neither icon set already in this app ships trademarked brand glyphs, so
// these are hand-drawn minimal outlines rather than a new icon dependency.
const SOCIAL_ICON: Record<SocialPlatform, React.ReactNode> = {
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="size-5">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
      <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.45 1.33 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.5 0 9.96-4.46 9.96-9.96S17.54 2 12.04 2zm0 18.2h-.01a8.24 8.24 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.55 3.7-8.24 8.26-8.24 4.55 0 8.24 3.7 8.24 8.25 0 4.55-3.7 8.23-8.24 8.23zm4.52-6.17c-.25-.12-1.46-.72-1.68-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.78.96-.14.16-.29.18-.53.06-.25-.12-1.06-.39-2.01-1.24-.75-.66-1.25-1.48-1.4-1.73-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.66.31-.22.25-.87.85-.87 2.08 0 1.22.89 2.4 1.02 2.57.12.16 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.66-1.17.21-.58.21-1.08.14-1.18-.06-.1-.22-.16-.47-.28z" />
    </svg>
  ),
};

export function Footer() {
  const logosRef = useRef<HTMLDivElement>(null);

  // A quiet closing beat - the three marks pulse once as the footer comes
  // into view, echoing StudioIdent's opening pulse (the "curtain closes").
  useGSAP(
    () => {
      if (!logosRef.current || prefersReducedMotion()) return;

      gsap.fromTo(
        logosRef.current.children,
        { scale: 0.94, filter: "drop-shadow(0 0 0px rgba(201,162,39,0))" },
        {
          scale: 1,
          filter: "drop-shadow(0 0 10px rgba(201,162,39,0.5))",
          duration: 0.7,
          stagger: 0.1,
          ease: "power2.out",
          yoyo: true,
          repeat: 1,
          scrollTrigger: { trigger: logosRef.current, start: "top 90%", once: true },
        },
      );
    },
    { scope: logosRef },
  );

  return (
    <footer className="border-t border-border bg-void px-6 py-14 sm:px-10 lg:px-16">
      <Reveal className="mx-auto flex max-w-7xl flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div ref={logosRef} className="flex items-center gap-4">
            <Image
              src="/assets/brand/gitam-logo.jpeg"
              alt="GITAM"
              width={1212}
              height={532}
              style={{ filter: "url(#logo-key-black)" }}
              className="h-10 w-auto"
            />
            <Image
              src="/assets/brand/tmcg-logo.jpeg"
              alt="TMCG"
              width={601}
              height={216}
              style={{ filter: "url(#logo-key-black)" }}
              className="h-8 w-auto"
            />
            <Image src="/assets/brand/mdc-logo.png" alt="MDC" width={512} height={257} className="h-8 w-auto" />
          </div>
          <p className="mt-4 max-w-sm font-heading text-sm text-ink-muted">
            TMCG IdeaSprint 4.0 - jointly organized by TMCG and Meta Developer Communities (MDC) GITAM Visakhapatnam.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                data-cursor="interactive"
                className="font-heading text-sm text-ink-muted transition-colors hover:text-gold"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div>
            <span className="font-mono text-[11px] tracking-[0.25em] text-ink-faint uppercase">Stay Connected</span>
            <div className="mt-2 flex items-center gap-3">
              {socialLinks.map((s) => (
                <a
                  key={s.platform}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  data-cursor="interactive"
                  className="flex size-9 items-center justify-center rounded-full border border-border text-ink-muted transition-colors hover:border-gold hover:text-gold"
                >
                  {SOCIAL_ICON[s.platform]}
                </a>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      <div className="mx-auto mt-12 flex max-w-7xl flex-col gap-3 border-t border-border pt-6 font-mono text-[11px] text-ink-faint sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} TMCG × MDC GITAM Visakhapatnam. All rights reserved.</span>
        <div className="flex items-center gap-4">
          <span>No Registration Fee · NOC Mandatory</span>
          <Link href="/privacy" data-cursor="interactive" className="underline transition-colors hover:text-gold">
            Privacy Policy
          </Link>
        </div>
      </div>

      <p className="mx-auto mt-3 max-w-7xl font-mono text-[11px] text-ink-faint">Developed by MDC GITAM</p>
    </footer>
  );
}
