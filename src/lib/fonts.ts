import { Bebas_Neue, Space_Grotesk, Geist, JetBrains_Mono } from "next/font/google";

// Giant kinetic display type — prize numbers, timeline stage names, hero fragments.
export const display = Bebas_Neue({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

// Headings, nav, UI labels — refined and premium, everywhere except the Hero.
export const heading = Geist({
  variable: "--font-heading",
  subsets: ["latin"],
});

// Hero-only eyebrow/location labels — kept pinned to the original typeface so
// the Hero's typography stays untouched while `heading` moves on elsewhere.
export const heroLabel = Space_Grotesk({
  variable: "--font-hero-label",
  subsets: ["latin"],
});

// Body copy.
export const body = Geist({
  variable: "--font-body",
  subsets: ["latin"],
});

// IDs, codes, timestamps, problem statement numbers — data-forward moments.
export const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const fontVariables = `${display.variable} ${heading.variable} ${heroLabel.variable} ${body.variable} ${mono.variable}`;
