import type {
  CampusSlide,
  Contact,
  DirectorMessage,
  EventConfig,
  FAQItem,
  GalleryImage,
  HeroContent,
  Judge,
  PrizeTier,
  RegistrationGuidelines,
  SocialLink,
  TimelineItem,
} from "@/types/config";

/**
 * Placeholder / seed content for everything the Admin Configuration module
 * (SPEC.md §79-88) will eventually own. Nothing here is fabricated beyond
 * what SPEC.md states as fact - anything the organizers haven't supplied yet
 * (domains, judges, gallery photos, contacts, exact config dates) is marked
 * as a clearly-structured placeholder so it can be swapped for real content
 * without touching component code. See prompt.md "No Fake Data" + "Asset
 * Fallbacks".
 */

export const heroContent: HeroContent = {
  eyebrow: "TMCG × MDC",
  title: "IDEASPRINT 4.0",
  registerCtaLabel: "Register Your Team",
  loginCtaLabel: "Login",
};

// IdeaSprint 4.0 Phase 1 runs independently at all three campuses (SPEC.md
// §2) - the hero's post-reveal carousel cycles through all three, in the
// same VSP -> HYD -> BLR order used everywhere else in the app (see
// CAMPUS_ORDER in src/lib/dashboard/campus-config.ts).
export const campusSlides: CampusSlide[] = [
  { src: "/assets/campus/GITAM_Vizag_Campus.jpg", alt: "GITAM Visakhapatnam campus", label: "Visakhapatnam" },
  { src: "/assets/campus/Gitam_hyd_campus.avif", alt: "GITAM Hyderabad campus", label: "Hyderabad" },
  { src: "/assets/campus/GITAM_blr_Campus.jpg", alt: "GITAM Bangalore campus", label: "Bangalore" },
];

export const eventConfig: EventConfig = {
  eventName: "TMCG IdeaSprint 4.0",
  eventDescription:
    "A campus-level innovation event conducted at GITAM Visakhapatnam, Hyderabad, and Bangalore, culminating in a Grand Finale among top-performing teams from all three campuses.",
  homepageAnnouncement: null,
  registrationStatus: "open",
  registrationStart: "2026-09-26T11:00:00+05:30",
  registrationEnd: "2026-10-05T23:00:00+05:30",
  eventStart: "2026-10-09T16:00:00+05:30",
  eventEnd: "2026-10-10T16:00:00+05:30",
  // VSP -> HYD -> BLR order used everywhere else in the app (see CAMPUS_ORDER
  // in src/lib/dashboard/campus-config.ts).
  venueByCampus: {
    VSP: "Shivaji Auditorium, ICT Bhavan",
    HYD: "Kinnera Auditorium, J Block",
    BLR: "Kojo Hall, SB Bhavan",
  },
  universityLevelStart: "2026-10-17T10:00:00+05:30",
  universityLevelEnd: "2026-10-18T10:00:00+05:30",
  universityLevelVenue: "Shivaji Auditorium, ICT Bhavan, Visakhapatnam Campus",
};

// Round structure + labels are factual (SPEC.md §2). Exact configured
// timestamps (release/selection/build/eval windows) are admin-set and unknown
// pre-launch, so they're left null rather than invented.
export const timeline: TimelineItem[] = [
  {
    id: "round-1",
    stage: "round-1",
    label: "Campus Level – Round 1",
    duration: "100 Minutes",
    detail: "Naukri Assessment - mandatory for every registered participant, with multiple sections assessing different skills.",
    scoreWeight: "20% of Campus Level Score",
    // Not yet supplied by the organizers - shown as a disabled preview button until then.
    detailsUrl: null,
  },
  {
    id: "round-2",
    stage: "round-2",
    label: "Campus Level – Round 2",
    duration: "18 Hours",
    detail:
      "Build Hackathon - mandatory for every registered participant. You'll be given a problem statement and must deliver the expected solution within the time limit.",
    scoreWeight: "80% of Campus Level Score",
    detailsUrl: null,
  },
  {
    id: "grand-finale",
    stage: "grand-finale",
    label: "Grand Finale",
    detail:
      "Shortlisted teams from Visakhapatnam, Hyderabad, and Bangalore compete in a 24-hour hackathon with a fresh set of problem statements for the final cash prizes.",
    detailsUrl: null,
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
    alt: `IdeaSprint - previous year, photo ${i + 1}`,
  };
});

// No judges confirmed/supplied yet.
export const judges: Judge[] = [];

// Not yet supplied by the organizers - null (not a fabricated name/photo/
// quote) so the section can render its own "message coming soon" placeholder
// state, same pattern as `judges` above.
export const directorMessage: DirectorMessage | null = null;

// Organizer-supplied.
export const faqs: FAQItem[] = [
  {
    id: "f1",
    question: "Will food be provided during the event?",
    answer: "No. Meals will not be provided. Refreshments will be provided during the event.",
  },
  {
    id: "f2",
    question: "Will there be a break during the 24-hour hackathon?",
    answer: "Yes. A morning break will be provided. The timings will be communicated to participants accordingly.",
  },
  {
    id: "f3",
    question: "Can team members be from different campuses?",
    answer: "No. All team members must be from the same campus.",
  },
  {
    id: "f4",
    question: "Can I make changes to my team after registration?",
    answer: "Yes. Team changes will be allowed until the hackathon begins. No changes will be accepted once the hackathon starts.",
  },
  {
    id: "f5",
    question: "Is a physical NOC mandatory?",
    answer: "Yes. A physical NOC is mandatory for participation. Digital NOCs or digital signatures will not be accepted.",
  },
  {
    id: "f6",
    question: "What are the NOC requirements for hostellers and day scholars?",
    answer:
      "For hostellers, the NOC must have the required signature and hostel stamp. For day scholars, the concerned authority's signature is sufficient.",
  },
  {
    id: "f7",
    question: "What happens if a team has fewer than three members during the event?",
    answer: "If a team has fewer than three members before the evaluation is completed, the team will be disqualified.",
  },
  {
    id: "f8",
    question: "What should participants bring to the event?",
    answer: "Participants should bring their college ID, physical NOC, laptop, charger, and other required items.",
  },
  {
    id: "f9",
    question: "Will accommodation be provided?",
    answer: "No. Accommodation will not be provided as part of the event.",
  },
  {
    id: "f10",
    question: "Will certificates be provided?",
    answer: "Yes. Certificates will be provided to eligible participants as per the event guidelines.",
  },
];

export const registrationGuidelines: RegistrationGuidelines = {
  content:
    "Registration guidelines will be published by the organizers before registration opens. This content is fully editable from Admin Configuration.",
  nocNotice: "NOC Submission is COMPULSORY for every participant.",
  // Not yet supplied by organizers - until it is, the guidelines step shows a
  // "provided closer to the event" note instead of a broken/missing link.
  nocFormUrl: null,
};

// Organizer-provided (SPEC.md §87). Order: the one all-campus contact first,
// then the three Campus Leads in VSP -> HYD -> BLR order (CAMPUS_ORDER),
// then the non-campus web contact last.
export const contacts: Contact[] = [
  {
    id: "c1",
    org: "TMCG",
    name: "Jothisk Nandan P",
    designation: "Co-University Lead",
    scope: "All Campuses",
    phone: "6304110542",
    email: "jpalla2@gitam.in",
    photo: { src: "/assets/contactphotos/jothisk-nandan.jpg", alt: "Jothisk Nandan P" },
  },
  {
    id: "c2",
    org: "TMCG",
    name: "Raam Sashnak S",
    designation: "Campus Lead",
    scope: "Visakhapatnam",
    phone: "7396096611",
    email: "ssomaya1@student.gitam.edu",
    photo: { src: "/assets/contactphotos/sashank.jpeg", alt: "Raam Sashnak S" },
  },
  {
    id: "c3",
    org: "TMCG",
    name: "Krishnapriya K",
    designation: "Campus Lead",
    scope: "Hyderabad",
    phone: "8142957572",
    email: "kkoppolu@student.gitam.edu",
    photo: { src: "/assets/contactphotos/krishnapriya-koppolu.png", alt: "Krishnapriya K" },
  },
  {
    id: "c4",
    org: "TMCG",
    name: "Sai Roopak Esikala",
    designation: "Co-University Lead",
    scope: "Bangalore",
    phone: "6302158054",
    email: "sesikala@gitam.in",
    // Pre-cropped to head-and-chest (source: sai-roopak.jpg) since the original was a waist-up shot.
    photo: { src: "/assets/contactphotos/sai-roopak-headshot.jpg", alt: "Sai Roopak Esikala" },
  },
  {
    id: "c5",
    org: "MDC",
    name: "Akash Kishan Karri",
    designation: "Website Architect",
    scope: "All Campuses",
    phone: "8374849797",
    email: "akarri4@gitam.in",
    photo: { src: "/assets/contactphotos/akash-kishan.jpg", alt: "Akash Kishan Karri" },
  },
  {
    id: "c6",
    org: "MDC",
    name: "Tanishq K",
    designation: "Website Architect",
    scope: "All Campuses",
    phone: "9652177526",
    email: "tkundrap@student.gitam.edu",
    // Pre-cropped to head-and-chest - the raw waist-up original has been removed.
    photo: { src: "/assets/contactphotos/tanishq-headshot.jpg", alt: "Tanishq K" },
  },
];

// WhatsApp stays `null` until the organizers supply the actual group invite
// (SPEC.md "No Fake Data"). A placeholder invite code isn't a harmless
// stand-in: chat.whatsapp.com answers 200 for any code and then tells the
// visitor the link is invalid, so shipping one gives participants a
// working-looking "Join our WhatsApp Group" button that dead-ends. Both the
// Footer and the Contact section skip entries with no url, so the moment a
// real link is pasted here it appears in both places.
export const socialLinks: SocialLink[] = [
  { platform: "instagram", label: "Instagram", url: "https://www.instagram.com/tmcg_gcgc/" },
  { platform: "whatsapp", label: "WhatsApp Group", url: null },
];
