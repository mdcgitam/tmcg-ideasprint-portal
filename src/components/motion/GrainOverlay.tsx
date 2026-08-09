/**
 * Subtle film-grain texture (prompt.md §5 "texture... noise/grain where
 * appropriate"). Doubles as a practical disguise for upscaled/soft source
 * photography — grain reads as an intentional cinematic grade rather than a
 * quality defect.
 */
export function GrainOverlay({ opacity = 0.05 }: { opacity?: number }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full mix-blend-overlay"
      style={{ opacity }}
      aria-hidden
    >
      <filter id="grain-overlay-filter">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain-overlay-filter)" />
    </svg>
  );
}
