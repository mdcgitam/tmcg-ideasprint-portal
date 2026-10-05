import { Plus_Jakarta_Sans, Geist, JetBrains_Mono } from "next/font/google";

// Clean tech neo-grotesque display type — modern, geometric, zero-gimmick.
export const display = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

// Headings, nav, UI labels — sleek and refined.
export const heading = Geist({
  variable: "--font-heading",
  subsets: ["latin"],
});

// Hero-only eyebrow/location labels — consistent clean neo-grotesque.
export const heroLabel = Geist({
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
