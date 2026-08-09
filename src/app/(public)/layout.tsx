import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { ActRail } from "@/components/motion/ActRail";
import { SceneLight } from "@/components/motion/SceneLight";
import { StudioIdent } from "@/components/motion/StudioIdent";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StudioIdent />
      <NavBar />
      <ActRail />
      <SceneLight />
      <SmoothScroll />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          {children}
          <Footer />
        </div>
      </div>
    </>
  );
}
