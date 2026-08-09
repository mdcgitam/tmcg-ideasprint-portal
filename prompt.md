# TMCG IdeaSprint 4.0 — Master Creative & Build Brief

> This file is the persisted source of the creative direction given for this project.
> The functional source of truth is `TMCG IdeaSprint 4.0.pdf` (condensed into `SPEC.md` for quick reference during implementation).
> This document defines the WOW — the PDF defines the WHAT.

---

## 0. Creative Freedom — Very Important

Full creative freedom over the visual design and user experience.

The attached PDF defines the **functional truth** of the product. It does NOT define: visual style, layout, typography, color palette, animation style, interaction patterns, section composition, navigation design, page transitions, visual storytelling, how information should be presented, how the provided assets should be used, how the public experience should flow visually.

These are free to invent.

### Do not follow this prompt too literally

The ideas here are **creative direction, not a rigid design specification**. If a better way to present something is discovered, use it. If a more impressive interaction than what's described exists, implement it. If a completely different visual concept would substantially improve the experience, pursue it.

Do not mechanically implement "section → card → animation → section → card" just because a conventional website usually works that way.

Think like an experienced creative director, interaction designer, motion designer, and frontend engineer working together.

---

## Functional Constraints vs Creative Freedom

### Non-negotiable (must follow the PDF / `SPEC.md`)

Functional requirements, business rules, user roles, permissions, validation rules, authentication rules, registration workflow, team-size rules, NOC rules, attendance rules, food rules, problem statement rules, approval workflow, exit-form rules, notifications, audit logging, admin configuration, acceptance criteria.

Do not alter these because of design preferences.

### Creative territory (complete freedom)

How these features look, how users navigate them, how information is visualized, animation choreography, transitions, visual hierarchy, interaction design, page composition, typography, layout, responsive behavior, visual storytelling, micro-interactions, loading experiences, empty states, success states, error states, dashboard composition.

---

## Take Risks

Do not default to the safest possible design. If a section would be better as a cinematic transition, an interactive scene, a horizontal experience, a spatial interface, a kinetic typography sequence, an interactive data visualization, an image composition, a scroll-driven narrative, or a full-screen interaction — do that.

The goal is not a website that everyone has already seen. The goal is an experience people remember.

---

## Design for the "Wow" Moment

Actively search for opportunities to create moments where the user thinks: *"I have never seen a college event website like this."* There should be multiple such moments throughout the experience, not just one impressive hero.

**WOW must never compromise usability, accessibility, performance, security, or functionality.**

---

## Do Not Be Afraid to Redesign

- "Display previous-year photographs" does NOT mean a gallery grid.
- "Display the event timeline" does NOT mean a vertical timeline.
- "Display prizes" does NOT mean three cards.
- "Display domains" does NOT mean domain cards.

Interpret the requirement creatively. The PDF tells you **WHAT must exist**. Decide **HOW it should exist**.

---

## Creative Director Test

Before finalizing each major section, ask:

1. Is this the most interesting way to communicate this information?
2. Does this feel specific to IdeaSprint?
3. Could this be mistaken for a generic template?
4. Does motion add meaning?
5. Does the interaction create a memorable moment?
6. Is the experience still intuitive?
7. Does the visual language connect with the rest of the website?

If #3 is yes, rethink the section.

---

## One Important Balance

Do not confuse **creative** with **random**. The website should have a strong underlying design system. Every unusual interaction should feel like it belongs to the same universe. The final product should feel like one highly intentional piece of digital design rather than a collection of random animations.

Make the decisions. Don't wait for instructions for every visual decision. Push the design further than what's explicitly described.

---

# TMCG IdeaSprint 4.0 — Build an Absurdly Good, Highly Animated Web Experience

This is not a conventional college event website. This is the **official TMCG IdeaSprint 4.0 digital experience for GITAM University, Visakhapatnam**, jointly organized by **TMCG + Meta Developer Communities (MDC) GITAM Visakhapatnam**.

Functional requirements, business rules, roles, workflows, validations, and acceptance criteria are defined in `SPEC.md` (condensed from the official PDF). Treat that as the **source of truth for functionality**. The job here is to transform those requirements into a website that feels like it was designed by an elite experimental digital studio.

## 1. The Core Design Objective

First reaction: **"WHAT THE HELL IS THIS? WHO DESIGNED THIS?"** — not "this is a nice event website."

Must feel: futuristic, premium, experimental, energetic, technically sophisticated, interactive, cinematic, alive, memorable, slightly unpredictable, visually rich without becoming unusable. Should feel like a major technology event, not a university notice board. Communicate: Innovation + Technology + Competition + Campus Energy + Meta/MDC culture + Hackathon intensity.

## 2. Absolutely No Static Website Feel

Do NOT build: static hero + cards + sections, generic scrolling landing page, basic fade-ins, simple hover scaling, ordinary carousels, generic gradient blobs, template-looking cards, excessive rounded rectangles, repetitive section layouts, boring dashboard tables, "Framer template" aesthetics, animation-for-the-sake-of-animation.

Motion-designed from the ground up. Every major interaction: meaningful transition, spatial relationship, feedback, micro-interaction, visual continuity.

## 3. Animation Technology

**GSAP** — hero choreography, scroll-triggered sequences, timelines, pinned sections, horizontal scroll, image reveals, text splitting, counters, transitions, page transitions, magnetic interactions, cursor interactions, parallax, coordinated animations. Use ScrollTrigger, SplitText where available, Flip, MotionPath.

**Motion (motion.dev)** — React component interactions, layout animations, dialogs, drawers, list transitions, modal transitions, shared-layout effects, gesture interactions, spring-based UI.

**anime.js** — decorative particles, SVG animation, lightweight micro-animations, icon animation, background motion, ambient visual systems.

Use each library intentionally, not everywhere. Keep the architecture maintainable.

## 4. Motion Principle

**Static → Interactive → Reactive → Cinematic.** The interface should feel like it responds to the user: cursor-reactive CTAs, domain hovers that transform rather than recolor, sections that physically transition into each other on scroll, scroll-activated timeline items, mask reveals, counting numbers, card depth, scroll-aware navigation, morphing sections, visual confirmation on important actions. Registration should feel like progressing through a mission, not filling a boring form.

## 5. Visual Direction

Distinctive visual identity — not a copy of an existing website. Combine: premium technology conference + hackathon + experimental editorial design + futuristic interface + Indian university campus energy + developer culture. Strong typography, restrained but powerful color system, avoid generic purple/blue AI aesthetic. Use: strong contrast, expressive typography, carefully selected accent colors, subtle gradients, texture, depth, light, shadows, borders, noise/grain where appropriate, kinetic typography. The page should look excellent even before animation starts.

## 6–7. Information Hierarchy & Hero

Homepage must contain (non-negotiable content, freely designed presentation): TMCG IdeaSprint 4.0 title, Hero, GITAM Vizag campus imagery, Login, Register, Domains, previous-year gallery, event timeline, prize section, judges, FAQs, important instructions, contact section, footer.

Hero is the most important visual moment — a cinematic opening sequence, not title+subtitle+two buttons+background. Page starts near-empty, ambient motion begins, typography enters in layers, fragments of "IDEASPRINT" appear, metadata emerges, campus imagery reveals, particles/lines/geometry react, info assembles, CTAs activate. Communicate immediately: **TMCG × MDC / IDEASPRINT 4.0 / GITAM VISAKHAPATNAM**. Strong CTA hierarchy: **REGISTER YOUR TEAM** dominant over **LOGIN**.

## 8–9. Campus Imagery & Map

Real GITAM Vizag campus imagery, sourced from official/public sources — never a plain `<img>` in a rectangle. Make it part of the motion system: mask reveals, distortion transitions, parallax, scroll-linked zoom, perspective transforms, slicing, stacking, displacement, kinetic collage, full-screen transitions, image-to-section morphs, hover depth, cursor-based movement. Lazy load, optimize.

Map: GITAM Vizag location — functional iframe, but composed as an experience (mask reveal, floating location metadata, animated coordinates, "GET TO GITAM" section) not a boring embed box.

## 10–17. Domains, Timeline, Prizes, Gallery, Judges

**Domains** — configurable list, rendered as an interactive system (magnetic tiles, kinetic typography, cursor-reactive labels, horizontal scroll, hover expansion, rearranging grid) — never plain cards. Admin-configurable, not hardcoded.

**Timeline** — cinematic scroll-driven sequence covering Round 1 (Naukri Assessment, 100 min) → Round 2 (Build Hackathon, 18 hr) → Grand Finale, plus configurable milestones (release, selection window, build phase, submission, evaluation, winner announcement). Aggressive but intelligent ScrollTrigger use.

**Prizes** — ₹15,000 / ₹10,000 / ₹5,000, Grand Finale only. Championship moment, not three pricing cards: giant kinetic numbers, depth, spotlight, vertical hierarchy, premium metallic treatment, scroll-driven reveal. ₹15,000 visually dominant.

**Gallery** — previous-year event photos as an immersive experience: masonry/irregular sizing, overlap, transitions, fullscreen preview, cursor interaction, scroll-controlled movement. Admin-manageable images.

**Judges** — prestigious visual profile system (hover expands portrait, background shifts, metadata appears) rather than photo+name+designation cards. Real photos only, no fabricated judges.

## 18–20. Registration & Auth

Registration is NOT a plain form — a guided interactive experience: Register → Guidelines acknowledgement (mandatory, blocks progress) → Basic Team Details (Team Name, Domain, No. of Members) → Member Details (Name, Reg No, GITAM Mail ID, Phone, Year of Study, School, Department, Branch, Gender, Stay — all mandatory, for every member including the lead) → Validation → Complete → Google Login → Dashboard.

Team size 3–4 (lead counts as one). Animated progress, step transitions, contextual validation, polished inline duplicate/error handling (team name, email, reg no, mobile, already-on-another-team) — never a flat "Error: X" string.

Auth: Google via Supabase, restricted to `@student.gitam.edu` / `gitam.in`. Frontend checks are UX only; backend enforcement is authoritative. NOC requirement must stay highly visible throughout registration — never buried.

## 21–34. Team Dashboard & Roles

Four roles — Super Admin, SPOC, Team Lead, Member — each with a genuinely different, coherent UI, not palette-swapped copies. Team Dashboard = mission-control workspace: Team Profile, Members, Problem Statement, Attendance, Food Coupons, NOC, Exit Form, Notifications, with visible team status, NOC completion, attendance, countdown, pending actions.

Team status transitions (Registered → Active → Pending Approval → Qualified → Exited) get meaningful visual transitions, not text swaps.

Problem Statement UX should visually communicate **LOCKED → RELEASED → SELECTION WINDOW → DEADLINE → LOCKED** with countdowns and temporal UI. Selection by entering a Problem Statement Number, not browsing. Editable until deadline; SPOC/Super Admin can extend per-team.

NOC: individual per participant, states Not Uploaded/Uploaded/Verified/Missing, Team Lead manages all, Members manage only their own upload (no edit/replace/delete). Polished completion visualization (e.g. "3/4 uploaded").

Attendance & Food: fast, clarity-first admin tooling (not decorative), session-based, participant-wise, Present/Absent, Lunch/Dinner only (no breakfast), Redeemed/Not Redeemed, restricted to assigned SPOC/Super Admin, managed from one workspace.

Exit Form: Team Lead-only upload of signed physical form, states Not Submitted/Submitted/Verified/Exited.

Approval workflow: Team Lead edits → Pending Approval → SPOC/Super Admin review → Approve (apply) or Reject (keep previous) → notify. UI must show **current vs requested** as a clear visual diff, not text.

Admin Configuration (Super Admin only) drives nearly everything event-specific — event name/description/banner/hero, homepage announcement, registration status/dates, event dates, Grand Finale info, prizes, domains, gallery, instructions, FAQs, contacts, timeline, problem statements, attendance sessions, NOC deadline/file rules, notifications. **Never hardcode event-specific values in components** — design the frontend around configurable/dynamic data, keeping permanent business rules (team size, roles, auth domains, uniqueness, approval requirement) separate from configurable content (dates, domains, hero image, gallery, FAQs, contacts, timeline, prizes, announcements).

## 35–43. Cross-cutting UX Systems

Page transitions between all major routes should feel like one coherent app. Premium custom cursor system on desktop (default/interactive/CTA/image/drag states), subtle, disabled/simplified on touch. Designed scroll experience (ScrollTrigger, pinning, horizontal sequences, parallax, reveal masks) without scroll-jacking the whole site. Every interactive element gets real feedback states (hover/press/loading/success/disabled; focus/validation/error/success; hover/active/selected; drag/upload/success/failure).

Responsive: mobile is intentionally designed, not shrunk — reduce heavy effects, simplify cursor, optimize images, preserve hierarchy and animation quality.

Accessibility: keyboard nav, focus states, semantic HTML, contrast, `prefers-reduced-motion` support, screen-reader labels, accessible forms — never sacrificed for effects.

Performance: lazy loading, optimized images, code splitting, animation cleanup (no leaked GSAP/listeners), GPU-friendly transforms (`transform`/`opacity`/`scale`/`rotation`/`clip-path`, avoid animating layout properties), canvas/WebGL only when it earns its place.

## 44–45. Assets & No Fake Data

Priority: 1) provided official brand/photo assets, 2) official public GITAM sources, 3) other public sources. Never fabricate judges, contacts, statistics, domains, dates, photos, sponsors, achievements, participant counts — use clearly-structured placeholders wired to Admin Configuration so real assets drop in without a redesign.

## Brand Assets & Provided Materials

When official assets (TMCG/MDC/GITAM/IdeaSprint logos, event graphics, photographs, judge photos, campus photos, icons) are provided, they are the source of truth: never recreate them with text/CSS, never substitute generic alternatives, never distort/restretch/reflow proportions or apply effects that harm readability.

Make provided assets part of the motion system (e.g. TMCG × MDC × GITAM identities converging into "TMCG × MDC" → "IDEASPRINT 4.0" → "GITAM VISAKHAPATNAM" via opacity/scale/position/masking/depth/blur/light), while preserving the actual logo files.

Logo animation: subtle reveal, mask reveal, slide/float, scale entrance, light sweep, controlled parallax, depth transition — never spinning, bouncing, stretching, random rotation, gimmicks, unreadable glow, aggressive morphing.

Asset architecture: `/public/assets/brand/`, `/public/assets/event/`, `/public/assets/gallery/`, `/public/assets/judges/`, `/public/assets/campus/`, `/public/assets/icons/` with meaningful filenames.

If an asset hasn't been provided yet: use a clearly identifiable placeholder, keep the component structurally complete, make replacing it trivial once dropped in — never fabricate it.

Every major image is a **visual scene**, not an `<img>` in a card: campus photo → cinematic hero reveal, event photo → gallery transition, judge portrait → interactive profile reveal, logo → choreographed brand entrance, map → animated location section, event graphic → scroll-linked composition.

## 46–48. Design System & Component Architecture

Proper reusable design system: typography, spacing, colors, shadows, borders, radii, animation timings/easing, buttons, inputs, cards, badges, modals, notifications, tables, status indicators.

Reusable components (names indicative, improve as needed): AnimatedHero, MagneticButton, KineticText, RevealImage, ScrollSection, EventTimeline, DomainExplorer, InteractiveGallery, PrizeReveal, JudgeProfile, FAQAccordion, ContactPanel, CampusMap, RegistrationStepper, FormField, TeamStatus, NotificationCenter, NOCManager, AttendanceManager, FoodManager, ExitFormManager, ApprovalQueue, AuditLog, AdminConfiguration.

Animation budget priority: Hero > section transitions > timeline > gallery > prize section > registration > state changes > dashboard interactions. Administrative tables: **speed over decoration**.

## 49–54. Non-negotiable Wins & Final Direction

A visually impressive interface that violates the spec is a failure — role-based access, registration rules, auth restrictions, uniqueness validations, approval workflow, NOC/attendance/food rules, problem statement timing, exit form rules, notifications, audit history, configurable settings must all be preserved exactly as specified.

The complete product is not just a landing page: Public Website, Authentication, Registration, Participant/Team Portal, SPOC Portal, Super Admin Portal, Configuration System — one visual language throughout, cinematic in public, sophisticated/dense/fast/operational in the dashboards (never a flashy marketing page pretending to be a dashboard).

Before calling any section done, self-review as a creative director: Does this look like a generic React site? Could this pass as a standard college template? Does the animation contribute meaning? Would someone screenshot and share this? Is the first 10 seconds memorable? Does the dashboard feel like a real operational product?

Think "digital event experience," not "website." Flow: discover → explore → become excited → register → authenticate → participate → manage team → complete requirements → exit, all in one coherent visual language. Crazy but intentional. Animated but meaningful. Beautiful but never at the cost of usability. Experimental but never at the cost of functionality.

**Do not settle for "good."**
