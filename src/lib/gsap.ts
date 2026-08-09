import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { SplitText } from "gsap/SplitText";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { CustomEase } from "gsap/CustomEase";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText, DrawSVGPlugin, CustomEase);

  // Images (hero photo, gallery, campus map) load asynchronously and shift
  // page layout after each section's ScrollTrigger has already computed its
  // trigger positions from the pre-image layout — every scroll animation on
  // the page ends up measuring against stale coordinates until something
  // forces a recalculation. Refresh once everything (images + fonts) has
  // actually finished loading, and again shortly after for late/lazy assets.
  const refresh = () => ScrollTrigger.refresh();
  if (document.readyState === "complete") {
    refresh();
  } else {
    window.addEventListener("load", refresh, { once: true });
  }
  window.setTimeout(refresh, 1500);
}

export { gsap, ScrollTrigger, ScrollSmoother, SplitText, DrawSVGPlugin, CustomEase };

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
