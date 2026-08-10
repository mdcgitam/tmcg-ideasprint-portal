import { PANELS_IN_REVEAL_ORDER } from "@/lib/building-geometry";

/**
 * Reveals the real campus photo through the building's own architectural
 * regions — the return facade, the corner bay, the connector wall, each
 * pilaster bay, the ground strip — rather than fading the whole photograph
 * in at once. Each region is the *same* photo, clipped to that region's
 * exact shape (shared with BuildingBlueprint.tsx's surface-fill panels via
 * `@/lib/building-geometry`), with its clip rect starting at zero height.
 * Hero.tsx's timeline grows each rect's `height` from 0 to full, staggered
 * left to right (ground last — it's the fence/pipes/car foreground, not
 * the subject), so different parts of the facade visibly become "real" at
 * different moments instead of one uniform crossfade.
 *
 * A full, unclipped copy sits underneath at zero opacity and fades in
 * slowly across the same window purely as a safety net for the thin
 * slivers between panels (the roofline curve itself, small seams) — by the
 * time it's visible those areas already match what the panels revealed, so
 * it never reads as a separate wipe of its own.
 *
 * Both this and BuildingBlueprint use the identical
 * `viewBox="0 0 100 75"` + `xMidYMid slice` setup, so the photo and the
 * linework crop identically at any container aspect ratio — see the
 * viewBox comment in building-geometry.ts.
 */
export function BuildingPhotograph({ src }: { src: string }) {
  return (
    <svg
      viewBox="0 0 100 75"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        {PANELS_IN_REVEAL_ORDER.map((p) => (
          <clipPath key={p.key} id={`hero-reveal-${p.key}`} clipPathUnits="userSpaceOnUse">
            <rect data-reveal-clip={p.key} data-full-height={p.rect[3]} x={p.rect[0]} y={p.rect[1]} width={p.rect[2]} height={0} />
          </clipPath>
        ))}
      </defs>

      {/* Safety-net base layer — catches the roofline sliver and any seams
          between panels once they've already resolved */}
      <image data-reveal-base href={src} x={0} y={0} width={100} height={75} opacity={0} preserveAspectRatio="xMidYMid slice" />

      {/* One clipped copy per architectural region */}
      {PANELS_IN_REVEAL_ORDER.map((p) => (
        <image
          key={p.key}
          data-reveal-panel={p.key}
          href={src}
          x={0}
          y={0}
          width={100}
          height={75}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#hero-reveal-${p.key})`}
        />
      ))}
    </svg>
  );
}
