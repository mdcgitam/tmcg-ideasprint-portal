import {
  CORNER_X,
  CORNER_TOP,
  CORNER_BASE,
  PILASTER_X,
  PILASTER_X_RANGE,
  PILASTER_TOP_RANGE,
  PILASTER_BASE_RANGE,
  MULLIONS,
  FLOOR_LINES,
  VERTEX_POINTS,
  VANISHING_POINT,
  VOLUME_ORIGINS,
  PANELS,
  ROOFLINE_PATH,
  s,
  lerp,
} from "@/lib/building-geometry";

/**
 * Hand-traced architectural line art of the academic block's facade (see
 * gitam-academic-block-hires.webp) — not a live edge-detection filter. A
 * photo this textured (rendered wall, trees, sky, fencing) would produce
 * noisy, uncontrolled results from something like an SVG feConvolveMatrix or
 * Canvas Sobel filter; hand-authored paths give full art-direction control
 * over which lines actually read as "this building" (the roofline sweep,
 * the near corner pier, the pilaster and mullion rhythm) versus incidental
 * photographic detail.
 *
 * Coordinates were measured directly off the photo, not estimated by eye —
 * a 1%-increment grid was overlaid on the full image and on zoomed crops of
 * the corner, the bay just past it, and the pilaster run specifically, and
 * each point read off that grid. The measured geometry itself lives in
 * `@/lib/building-geometry` — shared with BuildingPhotograph.tsx, which
 * clips the real photo through these same panel shapes, so the linework and
 * the photo reveal are guaranteed to agree on where the building actually is.
 *
 * The facade is deliberately drawn as a continuous grid of full-length
 * lines (mullions running the facade's own height, floor lines running the
 * facade's own width) rather than a closed rectangle per window — that
 * reads as precise structural linework, the way a real elevation drawing
 * is built from lines that keep going past the feature they define, not as
 * a scatter of disconnected boxes.
 *
 * Line weights are deliberately hierarchical, not uniform — the roofline
 * (the one big gesture) reads strongest; the corner pier and pilasters are
 * next; the mullions are a step quieter than the pilasters they run
 * alongside; the ground line, floor-divider lines, and dimension mark are
 * the quietest, thin and low-opacity, the way a real construction drawing
 * has a clear visual hierarchy rather than every line shouting equally.
 *
 * Every element carries `data-blueprint-*` so Hero.tsx can choreograph
 * groups independently through the construction sequence: point (vertices,
 * appear first), primary (the roofline), column (corner pier + pilasters),
 * mullion (window-edge verticals, a step quieter), secondary (ground line,
 * floor-divider lines — the quiet supporting lines), volume (perspective
 * construction lines — the "this has depth" beat), surface (the panel
 * fills — the "this has material" beat), tick (one restrained dimension
 * mark).
 *
 * This linework sits directly on top of the (initially fully transparent)
 * photo layer in Hero.tsx: it draws in over pure darkness, then the real
 * photograph materializes region by region underneath it — see
 * BuildingPhotograph.tsx — and only once that's resolved does this
 * linework dissolve, leaving the finished photograph on its own.
 */
export function BuildingBlueprint() {
  return (
    <svg
      viewBox="0 0 100 75"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      {/* Surfaces — flat-shaded fills, no stroke, sitting under the linework */}
      <g data-blueprint-surface fill="var(--color-ink)">
        {PANELS.map((p) => (
          <rect key={p.key} x={p.rect[0]} y={p.rect[1]} width={p.rect[2]} height={p.rect[3]} opacity="0.05" />
        ))}
      </g>

      <g fill="none" stroke="var(--color-ink)" strokeLinecap="round" strokeLinejoin="round">
        {/* Perspective construction lines — depth, not decoration */}
        <g data-blueprint-volume strokeWidth="0.05" opacity="0.4">
          {VOLUME_ORIGINS.map(([x, y]) => (
            <path key={x} d={`M ${x},${y} L ${VANISHING_POINT[0]},${VANISHING_POINT[1]}`} />
          ))}
        </g>

        {/* The roofline — the strongest line on the page; everything else
            is quieter than this. */}
        <path data-blueprint-primary strokeWidth="0.13" opacity="0.85" d={ROOFLINE_PATH} />

        {/* The near corner pier — the building's own dominant vertical, not
            a portico column */}
        <path data-blueprint-column strokeWidth="0.11" opacity="0.75" d={`M ${CORNER_X},${s(CORNER_TOP)} L ${CORNER_X},${s(CORNER_BASE)}`} />
        <path data-blueprint-secondary strokeWidth="0.06" opacity="0.5" d="M 6,2.25 L 6,42" />

        {/* Pilasters, rhythmic left to right, heights following the
            roofline's own perspective recession */}
        {PILASTER_X.map((x) => {
          const top = lerp(x, PILASTER_X_RANGE, PILASTER_TOP_RANGE);
          const base = lerp(x, PILASTER_X_RANGE, PILASTER_BASE_RANGE);
          return (
            <path
              key={x}
              data-blueprint-column
              strokeWidth="0.1"
              opacity="0.7"
              d={`M ${x},${s(top).toFixed(2)} L ${x},${s(base).toFixed(2)}`}
            />
          );
        })}

        {/* Window-edge mullions — full facade height at their own x, a
            continuous vertical grid rather than a box per window */}
        <g data-blueprint-mullion strokeWidth="0.045" opacity="0.55">
          {MULLIONS.map((m) => (
            <path key={m.x} d={`M ${m.x},${s(m.top).toFixed(2)} L ${m.x},${s(m.base).toFixed(2)}`} />
          ))}
        </g>

        {/* Ground/fence line + floor-divider lines — quiet supporting
            structure, the thinnest, faintest lines on the page. Each floor
            line runs the full facade width in one continuous path. */}
        <path data-blueprint-secondary strokeWidth="0.05" opacity="0.4" d="M 6,48 L 90,42" />
        {FLOOR_LINES.map((d, i) => (
          <path key={i} data-blueprint-secondary strokeWidth="0.04" opacity="0.3" d={d} />
        ))}

        {/* One restrained dimension mark — not a HUD, just a single technical note */}
        <g data-blueprint-tick strokeWidth="0.06" opacity="0.5">
          <path d={`M 3,${s(CORNER_TOP)} L 5,${s(CORNER_TOP)} M 3,${s(CORNER_BASE)} L 5,${s(CORNER_BASE)} M 4,${s(CORNER_TOP)} L 4,${s(CORNER_BASE)}`} />
        </g>
      </g>

      {/* Vertex points — the "survey markers" the structure is built from */}
      <g data-blueprint-point fill="var(--color-ink)" stroke="none" opacity="0.8">
        {VERTEX_POINTS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="0.28" />
        ))}
      </g>
    </svg>
  );
}
