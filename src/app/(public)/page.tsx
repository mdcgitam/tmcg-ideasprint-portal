import { createClient } from "@/lib/supabase/server";
import { Hero } from "@/components/sections/Hero";
import { TimelineSection } from "@/components/sections/TimelineSection";
import { InstructionsSection } from "@/components/sections/InstructionsSection";
import { PrizeSection } from "@/components/sections/PrizeSection";
import { JudgesSection } from "@/components/sections/JudgesSection";
import { GallerySection } from "@/components/sections/GallerySection";
import { FAQSection } from "@/components/sections/FAQSection";
import { ContactSection } from "@/components/sections/ContactSection";
import { RegistrationClosedPopup } from "@/components/sections/RegistrationClosedPopup";

const TEAM_CAP = 100;

export default async function Home() {
  const supabase = await createClient();

  const [{ data: teamCount }, { data: tncRow }] = await Promise.all([
    supabase.rpc("get_confirmed_team_count"),
    supabase.from("configuration").select("value").eq("key", "terms_and_conditions.url").maybeSingle(),
  ]);

  const isFull = (teamCount ?? 0) >= TEAM_CAP;
  const tncValue = (tncRow as { value: unknown } | null)?.value;
  const tncUrl = typeof tncValue === "string" && tncValue.trim() ? tncValue : null;

  return (
    <main>
      <Hero />
      <TimelineSection />
      <InstructionsSection tncUrl={tncUrl} />
      <PrizeSection />
      <JudgesSection />
      <GallerySection />
      <FAQSection />
      <ContactSection />
      <RegistrationClosedPopup isFull={isFull} />
    </main>
  );
}
