// Pilaster x-positions along the receding facade, measured directly off the
// photo (see component doc comment) — not evenly guessed. Top/base y
// interpolated linearly between the two measured end pilasters so the row's
// perspective recession (pilasters get shorter, and shift down, moving right
// toward the vanishing point) reads correctly instead of every pilaster
// being identical.
// y-values throughout this file are expressed in the SVG's own viewBox
// units, which is 75 tall (not 100) — see the viewBox on the <svg> below.
// The viewBox height matches the source photo's 4:3 aspect ratio exactly,
// so that this SVG's own "xMidYMid slice" crop lands on the identical
// window of the photo as the CSS `background-size: cover` layer it sits on
// top of in Hero.tsx. (A square 100x100 viewBox over a 4:3 photo would crop
// a *different* vertical slice than `cover` does at any non-4:3 container
// aspect ratio — e.g. a 16:9 hero — silently misaligning the linework from
// the photo it's meant to trace.) So a y measured as "40% down the photo"
// is written here as 40 * 0.75 = 30.
const PILASTER_X = [50, 58, 65, 72, 80];
const PILASTER_X_RANGE: [number, number] = [50, 80];
const PILASTER_TOP_RANGE: [number, number] = [6, 13.875];
const PILASTER_BASE_RANGE: [number, number] = [41.25, 33.75];

function lerp(x: number, xRange: [number, number], yRange: [number, number]) {
  const t = (x - xRange[0]) / (xRange[1] - xRange[0]);
  return yRange[0] + t * (yRange[1] - yRange[0]);
}

const PILASTER_POINTS = PILASTER_X.map((x) => ({
  x,
  top: lerp(x, PILASTER_X_RANGE, PILASTER_TOP_RANGE),
}));

// A representative subset of vertices, not every one — the "points" stage
// reads as survey markers establishing the form, not a dense scatter.
const VERTEX_POINTS: Array<[number, number]> = [
  [6, 2.25],
  [13, 1.125],
  [17.5, 1.5],
  [40, 4.875],
  [65, 9.75],
  [80, 13.875],
  [17.5, 43.5],
  ...PILASTER_POINTS.filter((_, i) => i % 2 === 0).map((c): [number, number] => [c.x, c.top]),
];

// Perspective construction lines — the roofline's near corner and two
// pilaster tops extended toward a shared off-canvas vanishing point, the way
// an architect's perspective sketch is actually constructed. Unlike a
// rising roofline, this facade's roof and base converge toward each other
// moving right (the building foreshortens as it recedes), which places the
// vanishing point down and to the right rather than up and to the right.
const VANISHING_POINT: [number, number] = [120, 24];
const VOLUME_ORIGINS: Array<[number, number]> = [
  [17.5, 1.5],
  [50, 6],
  [80, 13.875],
];

/**
 * The building's own surfaces, broken into discrete panels — the near
 * (nearly edge-on) return facade, the plain connector wall between it and
 * the first pilaster, each pilaster bay individually, and the ground/fence
 * strip. Rendered as flat-shaded fills during the SVG blueprint's "surfaces
 * gain material" beat, sitting under the linework. The photograph itself is
 * a separate, single full-bleed layer (see Hero.tsx) — not clipped through
 * these shapes — so these panels are purely a blueprint-visualisation
 * concern now.
 */
function buildPanels(): Array<{ key: string; rect: [number, number, number, number] }> {
  const panels: Array<{ key: string; rect: [number, number, number, number] }> = [
    { key: "return-facade", rect: [6, 2.25, 11.5, 39.75] },
    { key: "connector", rect: [17.5, 2.25, 32.5, 39.75] },
  ];
  // Bays between each pair of pilasters. No trailing bay past the last
  // pilaster (unlike a colonnade running to the frame edge) — the roofline
  // itself ends around x=80 into open sky, so a panel past that would sit
  // on nothing but sky.
  for (let i = 0; i < PILASTER_X.length - 1; i++) {
    const x1 = PILASTER_X[i];
    const x2 = PILASTER_X[i + 1];
    const top = Math.min(
      lerp(x1, PILASTER_X_RANGE, PILASTER_TOP_RANGE),
      lerp(x2, PILASTER_X_RANGE, PILASTER_TOP_RANGE),
    );
    panels.push({ key: `bay-${i}`, rect: [x1, top - 1.125, x2 - x1, 42 - top] });
  }
  panels.push({ key: "ground", rect: [6, 42, 74, 4.5] });
  return panels;
}

const PANELS = buildPanels();

/**
 * Hand-traced architectural line art of the academic block's facade (see
 * gitam-academic-block-hires.webp) — not a live edge-detection filter. A
 * photo this textured (rendered wall, trees, sky, fencing) would produce
 * noisy, uncontrolled results from something like an SVG feConvolveMatrix or
 * Canvas Sobel filter; hand-authored paths give full art-direction control
 * over which lines actually read as "this building" (the roofline sweep,
 * the near corner pier, the pilaster rhythm) versus incidental photographic
 * detail.
 *
 * Coordinates were measured directly off the photo, not estimated by eye —
 * a 1%-increment grid was overlaid on the full image and on zoomed crops of
 * the corner and pilaster run specifically, and each point read off that
 * grid.
 *
 * Line weights are deliberately hierarchical, not uniform — the roofline
 * (the one big gesture) reads strongest; the corner pier and pilasters are
 * secondary; the ground/fence line, window-band hints, and dimension mark
 * are the quietest, thin and low-opacity, the way a real construction
 * drawing has a clear visual hierarchy rather than every line shouting
 * equally.
 *
 * Every element carries `data-blueprint-*` so Hero.tsx can choreograph
 * groups independently through the construction sequence: point (vertices,
 * appear first), primary (the roofline), column (corner pier + pilasters),
 * secondary (ground/fence line, window-band hints — the quiet supporting
 * lines), volume (perspective construction lines — the "this has depth"
 * beat), surface (the panel fills — the "this has material" beat), tick
 * (one restrained dimension mark).
 *
 * This linework sits directly on top of the photograph in Hero.tsx (no
 * masking shape between them): it draws in over the still-hidden photo,
 * then dissolves once the photo has faded in and the grade resolves to
 * true colour — the drawing itself is the "no reveal shape" mechanism.
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

        {/* The roofline — measured through ten points along its actual
            sweep, from the near-edge-on return facade through the corner
            and across the receding pilaster run, not a single guessed arc.
            The strongest line on the page — everything else is quieter
            than this. */}
        <path
          data-blueprint-primary
          strokeWidth="0.13"
          opacity="0.85"
          d="M 6,2.25 C 10,1.5 12,1.275 13,1.125 C 15,1.275 16.5,1.425 17.5,1.5 C 23,2.1 27,2.775 30,3.375 C 35,4.125 38,4.5 40,4.875 C 45,5.4 48,5.775 50,6 C 54,6.75 56,7.5 58,7.875 C 61,8.625 63,9.225 65,9.75 C 68,10.5 70,11.1 72,11.625 C 75,12.525 78,13.35 80,13.875"
        />

        {/* The near corner pier — the building's own dominant vertical, not
            a portico column */}
        <path data-blueprint-column strokeWidth="0.11" opacity="0.75" d="M 17.5,1.5 L 17.5,43.5" />
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
              d={`M ${x},${top.toFixed(2)} L ${x},${base.toFixed(2)}`}
            />
          );
        })}

        {/* Ground/fence line + window-band hints — quiet supporting
            structure, the thinnest, faintest lines on the page */}
        <path data-blueprint-secondary strokeWidth="0.05" opacity="0.4" d="M 6,48 L 90,42" />
        <path data-blueprint-secondary strokeWidth="0.05" opacity="0.35" d="M 50,22.5 L 80,25.5" />
        <path data-blueprint-secondary strokeWidth="0.05" opacity="0.35" d="M 50,33.75 L 80,36" />

        {/* One restrained dimension mark — not a HUD, just a single technical note */}
        <g data-blueprint-tick strokeWidth="0.06" opacity="0.5">
          <path d="M 3,1.5 L 5,1.5 M 3,43.5 L 5,43.5 M 4,1.5 L 4,43.5" />
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
