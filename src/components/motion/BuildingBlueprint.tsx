// Colonnade column x-positions, measured directly off the photo (see
// component doc comment) — not evenly guessed. Top/base y interpolated
// linearly between the two measured end columns so the row's perspective
// rise (columns get shorter, and shift up, moving right toward the
// vanishing point) reads correctly instead of every column being identical.
const COLONNADE_X = [60.5, 67, 73.5, 80, 86.5, 93, 96.5];
const COLONNADE_X_RANGE: [number, number] = [60.5, 96.5];
// The far end of the colonnade curves away from camera — those columns
// read shorter and sit closer to the roofline (perspective foreshortening),
// not just uniformly shifted like the near end.
const COLONNADE_TOP_RANGE: [number, number] = [35, 26];
const COLONNADE_BASE_RANGE: [number, number] = [47.5, 42];

function lerp(x: number, xRange: [number, number], yRange: [number, number]) {
  const t = (x - xRange[0]) / (xRange[1] - xRange[0]);
  return yRange[0] + t * (yRange[1] - yRange[0]);
}

// Portico columns — measured individually, not evenly spaced (the third one
// sits slightly back from the front two, the fourth marks where the portico
// roof meets the main building wall).
const PORTICO_COLUMNS: Array<{ x: number; top: number; base: number }> = [
  { x: 17.5, top: 45, base: 57 },
  { x: 24, top: 45, base: 57 },
  { x: 28.5, top: 44.5, base: 56.5 },
  { x: 38, top: 43.5, base: 56 },
];

const COLONNADE_POINTS = COLONNADE_X.map((x) => ({
  x,
  top: lerp(x, COLONNADE_X_RANGE, COLONNADE_TOP_RANGE),
}));

// A representative subset of vertices, not every one — the "points" stage
// reads as survey markers establishing the form, not a dense scatter.
const VERTEX_POINTS: Array<[number, number]> = [
  [30, 34],
  [65, 27],
  [97, 21.5],
  [16.5, 45],
  [27, 38.5],
  [42, 44],
  ...COLONNADE_POINTS.filter((_, i) => i % 2 === 0).map((c): [number, number] => [c.x, c.top]),
];

// Perspective construction lines — the pediment's three vertices extended
// toward a shared off-canvas vanishing point, the way an architect's
// perspective sketch is actually constructed. This is what reads as
// "volumetric" rather than flat linework — real drafting technique, not a
// decorative wireframe-cube cliché.
const VANISHING_POINT: [number, number] = [108, 15];
const VOLUME_ORIGINS: Array<[number, number]> = [
  [16.5, 45],
  [27, 38.5],
  [42, 44],
];

/**
 * The building's own surfaces, broken into discrete panels — the pediment,
 * the portico wall, the upper cornice/window band, each colonnade bay
 * individually, and the ground plane. Rendered as flat-shaded fills during
 * the SVG blueprint's "surfaces gain material" beat, sitting under the
 * linework. The photograph itself is a separate, single full-bleed layer
 * (see Hero.tsx) — not clipped through these shapes — so these panels are
 * purely a blueprint-visualisation concern now.
 */
function buildPanels(): Array<{ key: string; d?: string; rect?: [number, number, number, number] }> {
  const panels: Array<{ key: string; d?: string; rect?: [number, number, number, number] }> = [
    { key: "pediment", d: "M 16.5,45 L 27,38.5 L 42,44 Z" },
    { key: "portico-wall", rect: [17, 45, 21, 12] },
    { key: "cornice", rect: [44, 20, 55, 11] },
    // The connecting wall between the portico and the colonnade — without
    // this, that whole span (below the cornice, right of the portico)
    // has no panel at all.
    { key: "connector", rect: [38, 31, 22.5, 26.5] },
  ];
  // Bays between each pair of columns, PLUS one trailing bay from the last
  // column out to the frame edge (100) — without it, the colonnade past
  // the last traced column has no panel at all and stays permanently
  // black even once the sequence finishes.
  const bayEdges = [...COLONNADE_X, 100];
  for (let i = 0; i < bayEdges.length - 1; i++) {
    const x1 = bayEdges[i];
    const x2 = bayEdges[i + 1];
    const topX1 = i < COLONNADE_X.length ? lerp(x1, COLONNADE_X_RANGE, COLONNADE_TOP_RANGE) : lerp(COLONNADE_X_RANGE[1], COLONNADE_X_RANGE, COLONNADE_TOP_RANGE);
    const topX2 = i + 1 < COLONNADE_X.length ? lerp(x2, COLONNADE_X_RANGE, COLONNADE_TOP_RANGE) : topX1;
    const top = Math.min(topX1, topX2) - 2;
    panels.push({ key: `bay-${i}`, rect: [x1, top, x2 - x1, 57.5 - top] });
  }
  panels.push({ key: "ground", rect: [15, 55, 85, 5] });
  return panels;
}

const PANELS = buildPanels();

/**
 * Hand-traced architectural line art of the campus colonnade (see
 * gitam-colonnade-hires.webp) — not a live edge-detection filter. A photo
 * this textured (trees, sky, pavement) would produce noisy, uncontrolled
 * results from something like an SVG feConvolveMatrix or Canvas Sobel
 * filter; hand-authored paths give full art-direction control over which
 * lines actually read as "this building" (the roofline sweep, the
 * portico's pediment, the colonnade's column rhythm) versus incidental
 * photographic detail.
 *
 * Coordinates were measured directly off the photo, not estimated by eye —
 * a 2%-increment grid was overlaid on the full image and on zoomed crops of
 * the portico and colonnade specifically, and each point read off that grid.
 *
 * Line weights are deliberately hierarchical, not uniform — the roofline
 * (the one big gesture) reads strongest; columns are secondary; the ground
 * line, window-band hints, and dimension mark are the quietest, thin and
 * low-opacity, the way a real construction drawing has a clear visual
 * hierarchy rather than every line shouting equally.
 *
 * Every element carries `data-blueprint-*` so Hero.tsx can choreograph
 * groups independently through the construction sequence: point (vertices,
 * appear first), primary (the roofline), column (colonnade + portico
 * verticals), secondary (pediment outline, ground line, window-band hints —
 * the quiet supporting lines), volume (perspective construction lines —
 * the "this has depth" beat), surface (the panel fills — the "this has
 * material" beat), tick (one restrained dimension mark).
 *
 * This linework sits directly on top of the photograph in Hero.tsx (no
 * masking shape between them): it draws in over the still-hidden photo,
 * then dissolves once the photo has faded in and the grade resolves to
 * true colour — the drawing itself is the "no reveal shape" mechanism.
 */
export function BuildingBlueprint() {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      {/* Surfaces — flat-shaded fills, no stroke, sitting under the linework */}
      <g data-blueprint-surface fill="var(--color-ink)">
        {PANELS.map((p) =>
          p.d ? (
            <path key={p.key} d={p.d} opacity="0.1" />
          ) : (
            <rect key={p.key} x={p.rect![0]} y={p.rect![1]} width={p.rect![2]} height={p.rect![3]} opacity="0.05" />
          ),
        )}
      </g>

      <g fill="none" stroke="var(--color-ink)" strokeLinecap="round" strokeLinejoin="round">
        {/* Perspective construction lines — depth, not decoration */}
        <g data-blueprint-volume strokeWidth="0.05" opacity="0.4">
          {VOLUME_ORIGINS.map(([x, y]) => (
            <path key={x} d={`M ${x},${y} L ${VANISHING_POINT[0]},${VANISHING_POINT[1]}`} />
          ))}
        </g>

        {/* The roofline — measured through five points along its actual
            sweep (30,34) (50,29.5) (65,27) (80,24.5) (97,21.5), not a
            single guessed arc. The strongest line on the page — everything
            else is quieter than this. */}
        <path
          data-blueprint-primary
          strokeWidth="0.13"
          opacity="0.85"
          d="M 30,34 C 40,31.2 46,30 50,29.5 C 58,28.6 61,27.6 65,27 C 72,25.9 76,25.1 80,24.5 C 87,23.4 92,22.3 97,21.5"
        />

        {/* Portico pediment — a closed triangle: left slope, right slope, base */}
        <path data-blueprint-secondary strokeWidth="0.07" opacity="0.55" d="M 16.5,45 L 27,38.5 L 42,44 Z" />

        {/* Portico columns */}
        {PORTICO_COLUMNS.map((c) => (
          <path key={c.x} data-blueprint-column strokeWidth="0.1" opacity="0.7" d={`M ${c.x},${c.top} L ${c.x},${c.base}`} />
        ))}

        {/* Colonnade columns, rhythmic left to right, heights following the
            roofline's own perspective rise */}
        {COLONNADE_X.map((x) => {
          const top = lerp(x, COLONNADE_X_RANGE, COLONNADE_TOP_RANGE);
          const base = lerp(x, COLONNADE_X_RANGE, COLONNADE_BASE_RANGE);
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

        {/* Ground line + window-band hints — quiet supporting structure,
            the thinnest, faintest lines on the page */}
        <path data-blueprint-secondary strokeWidth="0.05" opacity="0.4" d="M 15,57.5 L 100,57.5" />
        <path data-blueprint-secondary strokeWidth="0.05" opacity="0.35" d="M 44,31.5 L 98,31.5" />
        <path data-blueprint-secondary strokeWidth="0.05" opacity="0.35" d="M 60,46.5 L 98,46.5" />

        {/* One restrained dimension mark — not a HUD, just a single technical note */}
        <g data-blueprint-tick strokeWidth="0.06" opacity="0.5">
          <path d="M 9,45 L 11,45 M 9,57 L 11,57 M 10,45 L 10,57" />
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

