import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Hero } from "@/components/sections/Hero";
import { TimelineSection } from "@/components/sections/TimelineSection";
import { InstructionsSection } from "@/components/sections/InstructionsSection";
import { PrizeSection } from "@/components/sections/PrizeSection";
import { JudgesSection } from "@/components/sections/JudgesSection";
import { GallerySection } from "@/components/sections/GallerySection";
import { FAQSection } from "@/components/sections/FAQSection";
import { ContactSection } from "@/components/sections/ContactSection";
import { RegistrationClosedPopup } from "@/components/sections/RegistrationClosedPopup";
import type { CampusCode } from "@/lib/registration/schema";

// Placeholder until the real Terms & Conditions doc is set via admin
// Configuration → Site Content — keeps the box visible now instead of
// staying hidden while nobody has configured a real link yet.
const PLACEHOLDER_TNC_URL = "https://docs.google.com/document/d/1PLACEHOLDER-ideasprint-4-0-terms-and-conditions/edit";

const CONFIG_KEYS = ["terms_and_conditions.url", "grand_finale.date", "grand_finale.venue"] as const;

function readConfigString(rows: { key: string; value: unknown }[] | null, key: string): string | null {
  const value = rows?.find((r) => r.key === key)?.value;
  return typeof value === "string" && value.trim() ? value : null;
}

// Anon-key client with no cookies dependency (everything below is public per
// RLS) — unstable_cache can't safely wrap a per-request-cookie-bound client,
// and this keeps `/` served from the CDN edge instead of hitting Postgres
// (plus a cold serverless invocation) on every single visit — same pattern
// as src/app/(public)/privacy/page.tsx. Without this, the homepage's use of
// the cookie-based server client (just to read two public, anonymous-safe
// values) forces Next.js to render it fully dynamically on every request.
const getHomeData = unstable_cache(
  async () => {
    const supabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const [{ data: campusCounts }, { data: configRows }] = await Promise.all([
      supabase.rpc("get_team_counts_by_campus"),
      supabase.from("configuration").select("key, value").in("key", CONFIG_KEYS),
    ]);
    return {
      campusCounts: (campusCounts ?? []) as { campus: CampusCode; registered: number; cap: number }[],
      configRows: configRows ?? [],
    };
  },
  ["home-page-data"],
  { revalidate: 60 },
);

export default async function Home() {
  const { campusCounts, configRows } = await getHomeData();

  const campusSlots = Object.fromEntries(
    campusCounts.map((c) => [c.campus, { registered: c.registered, cap: c.cap }]),
  ) as Partial<Record<CampusCode, { registered: number; cap: number }>>;
  const isFull = campusCounts.length > 0 && campusCounts.every((c) => c.registered >= c.cap);
  const tncUrl = readConfigString(configRows, "terms_and_conditions.url") ?? PLACEHOLDER_TNC_URL;
  const grandFinaleDate = readConfigString(configRows, "grand_finale.date");
  const grandFinaleVenue = readConfigString(configRows, "grand_finale.venue");

  return (
    <main>
      <Hero />
      <TimelineSection grandFinaleDate={grandFinaleDate} grandFinaleVenue={grandFinaleVenue} />
      <InstructionsSection tncUrl={tncUrl} campusSlots={campusSlots} />
      <PrizeSection />
      <JudgesSection />
      <GallerySection />
      <FAQSection />
      <ContactSection />
      <RegistrationClosedPopup isFull={isFull} />
    </main>
  );
}
