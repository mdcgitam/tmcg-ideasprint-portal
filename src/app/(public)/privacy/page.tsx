import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | TMCG IdeaSprint 4.0",
  description: "How TMCG IdeaSprint 4.0 collects, stores, and uses participant data.",
};

const SECTION_HEADING = "font-heading text-sm tracking-[0.3em] text-ink-muted uppercase";
const BODY = "mt-4 font-heading leading-relaxed text-ink-muted";
const LIST = "mt-4 flex flex-col gap-2 font-heading leading-relaxed text-ink-muted";

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-void px-6 py-28 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-3xl">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Legal</span>
        <h1 className="mt-4 font-display text-5xl tracking-wide text-ink sm:text-6xl">Privacy Policy</h1>
        <p className="mt-4 font-heading text-sm text-ink-faint">Last updated: 10 August 2026</p>

        <p className={BODY}>
          This policy explains what information TMCG IdeaSprint 4.0 (&ldquo;the event&rdquo;, &ldquo;we&rdquo;,
          &ldquo;us&rdquo;) — jointly organized by TMCG and Meta Developer Communities (MDC) GITAM Visakhapatnam —
          collects through this website, why we collect it, and who can see it. It applies to this site
          only, not to GITAM University or Google&rsquo;s own services.
        </p>

        <div className="mt-14 flex flex-col gap-12">
          <section>
            <h2 className={SECTION_HEADING}>Information we collect</h2>
            <p className={BODY}>We collect information at two points: when a team registers, and when a participant signs in.</p>
            <ul className={LIST}>
              <li>
                <span className="text-ink">Team registration</span> — each participant&rsquo;s name, GITAM email,
                phone number, registration number, year of study, school, department, branch, gender, and stay
                preference, plus the team&rsquo;s name and chosen domain. This is submitted directly by the
                registering team, before anyone signs in.
              </li>
              <li>
                <span className="text-ink">Google sign-in</span> — your name, email address, and profile photo, as
                provided by Google. Sign-in is restricted to <span className="text-ink">@student.gitam.edu</span> and{" "}
                <span className="text-ink">@gitam.in</span> accounts; we only use this to confirm you&rsquo;re the
                person who registered and are a member of the GITAM community — we never request access to your
                Gmail, Drive, Calendar, or any other Google data.
              </li>
              <li>
                <span className="text-ink">Documents you upload</span> — No Objection Certificates (NOCs) and team
                exit forms, submitted as PDF files through your dashboard.
              </li>
              <li>
                <span className="text-ink">Event records</span> — attendance and meal-coupon redemption status,
                recorded by event staff during the event itself.
              </li>
            </ul>
          </section>

          <section>
            <h2 className={SECTION_HEADING}>How we use it</h2>
            <p className={BODY}>
              Solely to run the event: verifying registrations, granting dashboard access, managing problem
              statement selection, tracking attendance and meal coupons, processing NOC/exit form submissions, and
              sending you notifications about your team&rsquo;s status. We don&rsquo;t use it for advertising, and
              we don&rsquo;t sell or rent it to anyone.
            </p>
          </section>

          <section>
            <h2 className={SECTION_HEADING}>Who can see it</h2>
            <p className={BODY}>Access is limited by role, enforced at the database level, not just hidden in the interface:</p>
            <ul className={LIST}>
              <li>You can always see your own information.</li>
              <li>Your Team Lead can see your team&rsquo;s roster and NOC status.</li>
              <li>The SPOC (single point of contact) assigned to your team can see your team&rsquo;s information for coordination and verification.</li>
              <li>Event organizers (Super Admin) can see all participant and team data, for running the event.</li>
            </ul>
            <p className={BODY}>No one outside these roles — and no one outside the organizing team — has access to participant data.</p>
          </section>

          <section>
            <h2 className={SECTION_HEADING}>How it&rsquo;s stored</h2>
            <p className={BODY}>
              Data is stored with Supabase (a hosted PostgreSQL provider). Uploaded documents (NOCs, exit forms) are
              kept in private storage — they are never publicly accessible by URL, and are only ever served through
              short-lived signed links generated when someone with permission chooses to view them. Sign-in is
              handled by Google and Supabase Auth; we never see or store your Google password.
            </p>
          </section>

          <section>
            <h2 className={SECTION_HEADING}>Cookies</h2>
            <p className={BODY}>
              We use one cookie, set by Supabase Auth, to keep you signed in between page loads. We don&rsquo;t use
              advertising, tracking, or analytics cookies.
            </p>
          </section>

          <section>
            <h2 className={SECTION_HEADING}>How long we keep it</h2>
            <p className={BODY}>
              Participant and team data is retained for the duration of the event and for a reasonable period
              afterward for record-keeping and reporting to the organizing institutions, after which it may be
              deleted. If you&rsquo;d like your data removed sooner, contact us using the details below.
            </p>
          </section>

          <section>
            <h2 className={SECTION_HEADING}>Contact</h2>
            <p className={BODY}>
              Questions about this policy, or requests to access, correct, or delete your data, can be sent to{" "}
              <span className="text-ink">[organizer contact email]</span>.
            </p>
          </section>

          <section>
            <h2 className={SECTION_HEADING}>Changes to this policy</h2>
            <p className={BODY}>
              If this policy changes, we&rsquo;ll update the &ldquo;Last updated&rdquo; date above. Continued use of
              the site after a change means you accept the update.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
