"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { Reveal } from "@/components/motion/Reveal";
import { SOCIAL_ICON } from "@/components/motion/SocialIcon";
import { socialLinks } from "@/data/site-config";

const LINKS = [
  { href: "/#gallery", label: "Gallery" },
  { href: "/#prizes", label: "Prizes" },
  { href: "/#faq", label: "FAQ" },
  { href: "/#contact", label: "Contact" },
];

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
      <Reveal className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-3">
        <div>
          <div ref={logosRef} className="flex items-center gap-4">
            <Image src="/assets/brand/gitam-logo.png" alt="GITAM" width={1212} height={532} className="h-10 w-auto" />
            <Image src="/assets/brand/tmcg-logo.png" alt="TMCG" width={601} height={216} className="h-8 w-auto" />
            <Image src="/assets/brand/mdc-logo.png" alt="MDC" width={512} height={257} className="h-8 w-auto" />
          </div>
          <p className="mt-4 max-w-sm font-heading text-sm text-ink-muted">
            TMCG IdeaSprint 4.0 - jointly organized by TMCG and Meta Developer Communities (MDC) GITAM Visakhapatnam.
          </p>
        </div>

        <div>
          <span className="font-mono text-[11px] tracking-[0.25em] text-ink-faint uppercase">Quick Links</span>
          <nav aria-label="Footer" className="mt-3 flex flex-col gap-3">
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
        </div>

        <div>
          <span className="font-mono text-[11px] tracking-[0.25em] text-ink-faint uppercase">Stay Connected</span>
          <div className="mt-3 flex items-center gap-3">
            {socialLinks.filter((s) => s.url).map((s) => (
              <a
                key={s.platform}
                href={s.url!}
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
          <p className="mt-6 font-mono text-[11px] tracking-[0.2em] text-ink-faint uppercase">No Registration Fee · NOC Mandatory</p>
        </div>
      </Reveal>

      <div className="mx-auto mt-12 flex max-w-7xl flex-col gap-3 border-t border-border pt-6 font-mono text-[11px] text-ink-faint sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} TMCG × MDC GITAM Visakhapatnam. All rights reserved.</span>
        <div className="flex items-center gap-4">
          <Link href="/privacy" data-cursor="interactive" className="underline transition-colors hover:text-gold">
            Privacy Policy
          </Link>
          <span>Developed by MDC GITAM</span>
        </div>
      </div>
    </footer>
  );
}
