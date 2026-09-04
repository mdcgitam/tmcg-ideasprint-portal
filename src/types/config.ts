/**
 * Typed shape of everything the Super Admin can configure (SPEC.md §79-88).
 * Components must read through this layer (or the future Supabase-backed
 * equivalent in `src/lib/config.ts`) — never inline event-specific literals.
 */

export interface BrandAsset {
  src: string;
  alt: string;
  /** true when this is a structural placeholder, not a real supplied asset */
  isPlaceholder?: boolean;
}

export interface HeroContent {
  eyebrow: string;
  title: string;
  campusImage: BrandAsset;
  registerCtaLabel: string;
  loginCtaLabel: string;
}

export interface EventConfig {
  eventName: string;
  eventDescription: string;
  homepageAnnouncement: string | null;
  registrationStatus: "open" | "closed";
  registrationStart: string; // ISO
  registrationEnd: string; // ISO
  eventStart: string; // ISO
  eventEnd: string; // ISO
  /** display string, e.g. "4:00 PM" — when participants must have reported in */
  reportingTime: string;
  venue: string;
}

export type TimelineStage = "round-1" | "round-2" | "grand-finale" | "milestone";

export interface TimelineItem {
  id: string;
  stage: TimelineStage;
  label: string;
  duration?: string;
  detail: string;
  at?: string; // ISO, for configurable milestones
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

export interface Contact {
  id: string;
  org: ContactOrg;
  name: string;
  designation: string;
  phone: string;
  email: string;
}

export interface RegistrationGuidelines {
  content: string; // markdown/plain text, admin-editable
  nocNotice: string;
  /** Link to the NOC form (PDF or hosted doc) parents fill out — shown during registration. Null until organizers supply one. */
  nocFormUrl: string | null;
}
