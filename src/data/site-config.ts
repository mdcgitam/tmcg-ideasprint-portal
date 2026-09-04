import type {
  Contact,
  EventConfig,
  FAQItem,
  GalleryImage,
  HeroContent,
  Judge,
  PrizeTier,
  RegistrationGuidelines,
  TimelineItem,
} from "@/types/config";

/**
 * Placeholder / seed content for everything the Admin Configuration module
 * (SPEC.md §79-88) will eventually own. Nothing here is fabricated beyond
 * what SPEC.md states as fact — anything the organizers haven't supplied yet
 * (domains, judges, gallery photos, contacts, exact config dates) is marked
 * as a clearly-structured placeholder so it can be swapped for real content
 * without touching component code. See prompt.md "No Fake Data" + "Asset
 * Fallbacks".
 */

export const heroContent: HeroContent = {
  eyebrow: "TMCG × MDC GITAM VISAKHAPATNAM",
  title: "IDEASPRINT 4.0",
  campusImage: {
    src: "/assets/campus/gitam-academic-block-hires.webp",
    alt: "GITAM Visakhapatnam campus — the academic block facade",
  },
  registerCtaLabel: "Register Your Team",
  loginCtaLabel: "Login",
};

export const eventConfig: EventConfig = {
  eventName: "TMCG IdeaSprint 4.0",
  eventDescription:
    "A campus-level innovation event conducted at GITAM Visakhapatnam, Hyderabad, and Bengaluru, culminating in a Grand Finale among top-performing teams from all three campuses.",
  homepageAnnouncement: null,
  registrationStatus: "open",
  // Registration window dates aren't set yet — left as an unconfirmed
  // placeholder, unlike the fields below which come straight from the
  // organizer-supplied Phase-1 schedule.
  registrationStart: "2026-08-08T00:00:00+05:30",
  registrationEnd: "2026-08-08T00:00:00+05:30",
  eventStart: "2026-09-25T16:00:00+05:30",
  eventEnd: "2026-09-26T18:00:00+05:30",
  reportingTime: "04:00 PM",
  venue: "Shivaji Auditorium, GITAM Visakhapatnam",
};

// Round structure + labels are factual (SPEC.md §2). Exact configured
// timestamps (release/selection/build/eval windows) are admin-set and unknown
// pre-launch, so they're left null rather than invented.
export const timeline: TimelineItem[] = [
  {
    id: "round-1",
    stage: "round-1",
    label: "Phase 1 – Round 1",
    duration: "100 Minutes",
    detail: "Naukri Assessment — mandatory for every registered participant.",
  },
  {
    id: "round-2",
    stage: "round-2",
    label: "Phase 1 – Round 2",
    duration: "18 Hours",
    detail: "Build Hackathon — mandatory for every registered participant.",
  },
  {
    id: "grand-finale",
    stage: "grand-finale",
    label: "Grand Finale",
    detail: "Top-performing teams from Visakhapatnam, Hyderabad, and Bengaluru compete for the final cash prizes.",
  },
];

export const prizes: PrizeTier[] = [
  { id: "p1", place: 1, amountInr: 20000, label: "First Prize" },
  { id: "p2", place: 2, amountInr: 15000, label: "Second Prize" },
  { id: "p3", place: 3, amountInr: 8000, label: "Third Prize" },
];

// Previous-year event photography, supplied by the organizers.
export const gallery: GalleryImage[] = Array.from({ length: 10 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return {
    id: `gallery-${n}`,
    src: `/assets/gallery/ideasprint-2025-${n}.jpg`,
    alt: `IdeaSprint — previous year, photo ${i + 1}`,
  };
});

// No judges confirmed/supplied yet.
export const judges: Judge[] = [];

// Sourced directly from SPEC.md facts — not fabricated.
export const faqs: FAQItem[] = [
  {
    id: "f1",
    question: "What is the team size for IdeaSprint 4.0?",
    answer: "Every team must have a minimum of 3 and a maximum of 4 members, including the Team Lead.",
  },
  {
    id: "f2",
    question: "Is there a registration fee?",
    answer: "No — there is no registration fee for IdeaSprint 4.0.",
  },
  {
    id: "f3",
    question: "Who can register?",
    answer: "Only GITAM Visakhapatnam students with a valid @student.gitam.edu or gitam.in account can authenticate and participate.",
  },
  {
    id: "f4",
    question: "Is NOC submission mandatory?",
    answer: "Yes — NOC submission is compulsory for every participant, tracked individually within your team dashboard.",
  },
  {
    id: "f5",
    question: "What rounds does the campus-level event include?",
    answer: "Round 1 is a 100-minute Naukri Assessment and Round 2 is an 18-hour Build Hackathon. Both are mandatory and non-eliminatory — teams progress to the Grand Finale based on overall performance.",
  },
];

export const registrationGuidelines: RegistrationGuidelines = {
  content:
    "Registration guidelines will be published by the organizers before registration opens. This content is fully editable from Admin Configuration.",
  nocNotice: "NOC Submission is COMPULSORY for every participant.",
  // Not yet supplied by organizers — until it is, the guidelines step shows a
  // "provided closer to the event" note instead of a broken/missing link.
  nocFormUrl: null,
};

// Organizer-provided — not yet supplied. Placeholder structure per SPEC.md §87.
export const contacts: Contact[] = [
  { id: "c1", org: "TMCG", name: "TMCG Contact 1", designation: "To be announced", phone: "", email: "" },
  { id: "c2", org: "TMCG", name: "TMCG Contact 2", designation: "To be announced", phone: "", email: "" },
  { id: "c3", org: "TMCG", name: "TMCG Contact 3", designation: "To be announced", phone: "", email: "" },
  { id: "c4", org: "MDC", name: "MDC Contact", designation: "To be announced", phone: "", email: "" },
];
