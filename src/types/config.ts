/**
 * Typed shape of everything the Super Admin can configure (SPEC.md §79-88).
 * Components must read through this layer (or the future Supabase-backed
 * equivalent in `src/lib/config.ts`) - never inline event-specific literals.
 */

import type { CampusCode } from "@/lib/registration/schema";

export interface BrandAsset {
  src: string;
  alt: string;
  /** true when this is a structural placeholder, not a real supplied asset */
  isPlaceholder?: boolean;
}

export interface HeroContent {
  eyebrow: string;
  title: string;
  registerCtaLabel: string;
  loginCtaLabel: string;
}

/** One slide of the hero's post-reveal campus carousel - the photo plus the large faded location watermark shown over it. */
export interface CampusSlide extends BrandAsset {
  label: string;
}

export interface EventConfig {
  eventName: string;
  eventDescription: string;
  homepageAnnouncement: string | null;
  registrationStatus: "open" | "closed";
  registrationStart: string; // ISO
  registrationEnd: string; // ISO
  /** Also the reporting time, shown separately - participants must have reported in by this moment. Same time at every campus, only the venue differs. */
  eventStart: string; // ISO
  eventEnd: string; // ISO
  /** Campus Level reporting venue, one per campus - different at each of the 3 campuses. */
  venueByCampus: Record<CampusCode, string>;
  /** University Level (Grand Finale) - fixed like Campus Level, not admin-configurable (there's no live-changing qualification logic that would need it editable, so it doesn't need its own database round-trip). */
  universityLevelStart: string; // ISO
  universityLevelEnd: string; // ISO
  universityLevelVenue: string;
}

export type TimelineStage = "round-1" | "round-2" | "grand-finale" | "milestone";

export interface TimelineItem {
  id: string;
  stage: TimelineStage;
  label: string;
  duration?: string;
  detail: string;
  at?: string; // ISO, for configurable milestones
  /** Link to the round's full rules/regulations doc - null until the organizers supply one. */
  detailsUrl?: string | null;
}

export interface PrizeTier {
  id: string;
  place: 1 | 2 | 3;
  amountInr: number;
  label: string;
}

export interface GalleryImage extends BrandAsset {
  id: string;
  caption?: string;
}

export interface Judge {
  id: string;
  name: string;
  designation: string;
  photo: BrandAsset;
  bio?: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export type ContactOrg = "TMCG" | "MDC";

/** Which campus(es) this person is the point of contact for - shown as a badge so it's clear at a glance, not buried in the designation sentence. Null for a non-campus-scoped role (e.g. the website architect). */
export type ContactScope = "All Campuses" | "Visakhapatnam" | "Hyderabad" | "Bangalore" | null;

export interface Contact {
  id: string;
  org: ContactOrg;
  name: string;
  designation: string;
  scope: ContactScope;
  phone: string;
  email: string;
  photo: BrandAsset;
}

export interface RegistrationGuidelines {
  content: string; // markdown/plain text, admin-editable
  nocNotice: string;
  /** Link to the NOC form (PDF or hosted doc) parents fill out - shown during registration. Null until organizers supply one. */
  nocFormUrl: string | null;
}

export type SocialPlatform = "instagram" | "whatsapp";

export interface SocialLink {
  platform: SocialPlatform;
  label: string;
  url: string;
}

export interface DirectorMessage {
  name: string;
  designation: string;
  message: string;
  photo: BrandAsset;
}
