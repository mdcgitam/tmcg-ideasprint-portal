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
 * Still a stylized representation, not a pixel-perfect trace (the photo
 * displays via object-cover inside a full-viewport section, so its visible
 * crop shifts with viewport aspect ratio in a way no fixed coordinate set
 * can chase exactly) — but the proportions and rhythm now match the actual
 * building, not an approximation.
 *
 * Every path carries `data-blueprint-*` so Hero.tsx can target groups with
 * GSAP's DrawSVGPlugin independently: primary (the roofline, drawn first —
 * the one big gesture), column (the colonnade + portico verticals, ticking
 * in rhythmically), secondary (pediment outline, ground line, window-band
 * hints), tick (a single restrained dimension mark — not a HUD).
 */
export function BuildingBlueprint() {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <g fill="none" stroke="var(--color-ink)" strokeWidth="0.18" strokeLinecap="round" strokeLinejoin="round">
        {/* The roofline — measured through five points along its actual
            sweep (30,34) (50,29.5) (65,27) (80,24.5) (97,21.5), not a
            single guessed arc */}
        <path data-blueprint-primary d="M 30,34 C 40,31.2 46,30 50,29.5 C 58,28.6 61,27.6 65,27 C 72,25.9 76,25.1 80,24.5 C 87,23.4 92,22.3 97,21.5" />

        {/* Portico pediment — a closed triangle: left slope, right slope, base */}
        <path data-blueprint-secondary d="M 16.5,45 L 27,38.5 L 42,44 Z" />

        {/* Portico columns */}
        {PORTICO_COLUMNS.map((c) => (
          <path key={c.x} data-blueprint-column d={`M ${c.x},${c.top} L ${c.x},${c.base}`} />
        ))}

        {/* Colonnade columns, rhythmic left to right, heights following the
            roofline's own perspective rise */}
        {COLONNADE_X.map((x) => {
          const top = lerp(x, COLONNADE_X_RANGE, COLONNADE_TOP_RANGE);
          const base = lerp(x, COLONNADE_X_RANGE, COLONNADE_BASE_RANGE);
          return <path key={x} data-blueprint-column d={`M ${x},${top.toFixed(2)} L ${x},${base.toFixed(2)}`} />;
        })}

        {/* Ground line + window-band hints — quiet supporting structure */}
        <path data-blueprint-secondary d="M 15,57.5 L 100,57.5" />
        <path data-blueprint-secondary d="M 44,31.5 L 98,31.5" />
        <path data-blueprint-secondary d="M 60,46.5 L 98,46.5" />

        {/* One restrained dimension mark — not a HUD, just a single technical note */}
        <g data-blueprint-tick strokeWidth="0.12">
          <path d="M 9,45 L 11,45 M 9,57 L 11,57 M 10,45 L 10,57" />
        </g>
      </g>
    </svg>
  );
}
