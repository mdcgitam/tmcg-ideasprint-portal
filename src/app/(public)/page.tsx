import { Hero } from "@/components/sections/Hero";
import { DomainsSection } from "@/components/sections/DomainsSection";
import { TimelineSection } from "@/components/sections/TimelineSection";
import { GallerySection } from "@/components/sections/GallerySection";
import { JudgesSection } from "@/components/sections/JudgesSection";
import { PrizeSection } from "@/components/sections/PrizeSection";
import { InstructionsSection } from "@/components/sections/InstructionsSection";
import { FAQSection } from "@/components/sections/FAQSection";
import { ContactSection } from "@/components/sections/ContactSection";

export default function Home() {
  return (
    <main>
      <Hero />
      <DomainsSection />
      <TimelineSection />
      <GallerySection />
      <JudgesSection />
      <PrizeSection />
      <InstructionsSection />
      <FAQSection />
      <ContactSection />
    </main>
  );
}
