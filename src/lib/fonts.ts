import { Bebas_Neue, Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";

// Giant kinetic display type — prize numbers, timeline stage names, hero fragments.
export const display = Bebas_Neue({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

// Headings, nav, UI labels — geometric and technical.
export const heading = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
});

// Body copy.
export const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

// IDs, codes, timestamps, problem statement numbers — data-forward moments.
export const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const fontVariables = `${display.variable} ${heading.variable} ${body.variable} ${mono.variable}`;
