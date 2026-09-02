import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const metadata: Metadata = {
  title: "Privacy Policy | TMCG IdeaSprint 4.0",
  description: "How TMCG IdeaSprint 4.0 collects, stores, and uses participant data.",
};

const SECTION_HEADING = "font-heading text-sm tracking-[0.3em] text-ink-muted uppercase";
const BODY = "mt-4 font-heading leading-relaxed text-ink-muted";

// Seeded as the default `privacy_policy.content` config value (see migration
// 0006) and used verbatim whenever Super Admin hasn't overridden it — kept
// in sync with that seed so the page never renders blank before a first edit.
const DEFAULT_CONTENT = `This policy explains what information TMCG IdeaSprint 4.0 ("the event", "we", "us") — jointly organized by TMCG and Meta Developer Communities (MDC) GITAM Visakhapatnam — collects through this website, why we collect it, and who can see it. It applies to this site only, not to GITAM University or Google's own services.

Information we collect: at registration, each participant's name, GITAM email, phone number, registration number, year of study, school, department, branch, gender, and stay preference, plus the team's name — submitted by the registering team before anyone signs in. At sign-in, your name, email address, and profile photo as provided by Google; sign-in is restricted to @student.gitam.edu and @gitam.in accounts, used only to confirm you're the person who registered — we never request access to your Gmail, Drive, Calendar, or any other Google data. We also collect documents you upload (NOCs and team exit forms, as PDF files) and event records (attendance and, where applicable, other event-day logs) recorded by event staff.

How we use it: solely to run the event — verifying registrations, granting dashboard access, managing problem statement selection, tracking attendance, processing NOC/exit form submissions, and sending you notifications about your team's status. We don't use it for advertising, and we don't sell or rent it to anyone.

Who can see it: access is limited by role, enforced at the database level, not just hidden in the interface. You can always see your own information. Your Team Lead can see your team's roster and NOC status. The SPOC assigned to your team's room can see your team's information for coordination and verification. Event organizers (Super Admin) can see all participant and team data, for running the event. No one outside these roles — and no one outside the organizing team — has access to participant data.

How it's stored: data is stored with Supabase (a hosted PostgreSQL provider). Uploaded documents are kept in private storage — never publicly accessible by URL, only ever served through short-lived signed links generated when someone with permission chooses to view them. Sign-in is handled by Google and Supabase Auth; we never see or store your Google password.

Cookies: we use one cookie, set by Supabase Auth, to keep you signed in between page loads. We don't use advertising, tracking, or analytics cookies.

How long we keep it: participant and team data is retained for the duration of the event and for a reasonable period afterward for record-keeping and reporting to the organizing institutions, after which it may be deleted. If you'd like your data removed sooner, contact us using the details on this site.

Changes to this policy: if this policy changes, we'll update it here. Continued use of the site after a change means you accept the update.`;

// Anon-key client with no cookies dependency (this row is public per the
// configuration_select RLS policy) — unstable_cache can't safely wrap a
// per-request-cookie-bound client, and caching this avoids a DB round trip
// on every single /privacy view under concurrent load, since the content
// changes only when Super Admin edits it.
const getPrivacyPolicyContent = unstable_cache(
  async () => {
    const supabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await supabase.from("configuration").select("value").eq("key", "privacy_policy.content").maybeSingle();
    return typeof data?.value === "string" ? data.value : null;
  },
  ["privacy-policy-content"],
  { revalidate: 60 },
);

export default async function PrivacyPolicyPage() {
  const stored = await getPrivacyPolicyContent();
  const content = stored && stored.trim().length > 0 ? stored : DEFAULT_CONTENT;
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <main id="top" className="bg-void px-6 py-28 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-3xl">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Legal</span>
        <h1 className="mt-4 font-display text-5xl tracking-wide text-ink sm:text-6xl">Privacy Policy</h1>
        <p className="mt-4 font-heading text-sm text-ink-faint">Last updated: 10 August 2026</p>

        <div className="mt-14 flex flex-col gap-2">
          {paragraphs.map((paragraph, i) => (
            <p key={i} className={i === 0 ? BODY.replace("mt-4", "mt-0") : BODY}>
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-14">
          <h2 className={SECTION_HEADING}>Contact</h2>
          <p className={BODY}>
            Questions about this policy, or requests to access, correct, or delete your data, can be sent to the
            organizer contacts listed on the homepage.
          </p>
        </div>
      </div>
    </main>
  );
}
