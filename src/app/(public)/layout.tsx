import type { Viewport } from "next";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { CopyGuard } from "@/components/layout/CopyGuard";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { SceneLight } from "@/components/motion/SceneLight";
import { StudioIdent } from "@/components/motion/StudioIdent";

// Blocks pinch-zoom on the public Home + Register pages only - overrides the
// root layout's default viewport for this route segment (Next.js metadata
// resolution: the closest ancestor that exports `viewport` wins). Dashboards
// outside this route group are untouched and keep normal pinch-zoom.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <CopyGuard>
      <StudioIdent />
      <NavBar />
      <SceneLight />
      <SmoothScroll />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          {children}
          <Footer />
        </div>
      </div>
    </CopyGuard>
  );
}
