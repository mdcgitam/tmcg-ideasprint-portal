/**
 * Single source of truth for the hero building's measured facade geometry —
 * shared between BuildingBlueprint.tsx (the line-art overlay) and
 * BuildingPhotograph.tsx (the region-by-region photo reveal), so the two
 * layers are guaranteed to agree on exactly where the corner, each pilaster
 * bay, and the connector wall sit. Splitting this out stopped being
 * optional once a second component needed the same panel rects the
 * blueprint already used for its surface fills — duplicating the numbers
 * would have let the two drift apart silently.
 *
 * y-values throughout are expressed in the shared SVG viewBox's own units,
 * which is 75 tall (not 100) — both consuming components use
 * `viewBox="0 0 100 75"` with `preserveAspectRatio="xMidYMid slice"`. The
 * viewBox height matches the source photo's 4:3 aspect ratio exactly, so
 * this "slice" crop lands on the identical window of the photo regardless
 * of the hero container's own aspect ratio. (A square 100x100 viewBox over
 * a 4:3 photo would crop a *different* vertical slice than a 4:3 one at any
 * non-4:3 container aspect ratio — e.g. a 16:9 hero — silently
 * misaligning the linework from the photo it's meant to trace.) So a y
 * measured as "40% down the photo" is written here as 40 * 0.75 = 30.
 */
const SCALE = 0.75;
export const s = (raw: number) => raw * SCALE;

export function lerp(x: number, xRange: [number, number], yRange: [number, number]) {
  const t = (x - xRange[0]) / (xRange[1] - xRange[0]);
  return yRange[0] + t * (yRange[1] - yRange[0]);
}

// The facade reads as four zones left to right, each measured separately
// off the photo rather than forced into one formula: the near-edge-on
// return facade, the first main-facade bay right past the corner (easy to
// miss — it reads as part of the return facade at a glance, but it's on
// the other side of the corner seam), a genuinely blank connector wall,
// and the receding pilaster run. All raw values are "percent of photo".
export const CORNER_X = 17.5;
export const CORNER_TOP = 2;
export const CORNER_BASE = 58;
export const PILASTER_X = [50, 58, 65, 72, 80];
export const PILASTER_X_RANGE: [number, number] = [50, 80];
export const PILASTER_TOP_RANGE: [number, number] = [8, 18.5];
export const PILASTER_BASE_RANGE: [number, number] = [55, 45];

// Top/base of the facade's structural envelope at any x from the corner
// through the end of the pilaster run — piecewise, not one formula, because
// the near facade (corner to first pilaster) barely foreshortens while the
// pilaster run recedes sharply. Used to derive the mullions, the floor
// lines, and the panel rects so every element — regardless of which zone
// it's in — sits on the same measured envelope instead of being eyeballed
// per zone.
export function facadeEnvelope(x: number): { top: number; base: number } {
  if (x <= CORNER_X) return { top: CORNER_TOP, base: CORNER_BASE };
  if (x <= PILASTER_X_RANGE[0]) {
    const t = (x - CORNER_X) / (PILASTER_X_RANGE[0] - CORNER_X);
    return {
      top: CORNER_TOP + t * (PILASTER_TOP_RANGE[0] - CORNER_TOP),
      base: CORNER_BASE + t * (PILASTER_BASE_RANGE[0] - CORNER_BASE),
    };
  }
  return {
    top: lerp(x, PILASTER_X_RANGE, PILASTER_TOP_RANGE),
    base: lerp(x, PILASTER_X_RANGE, PILASTER_BASE_RANGE),
  };
}

export interface BuildingPanel {
  key: string;
  rect: [number, number, number, number];
}

/**
 * The building's own architectural regions, broken into discrete panels —
 * the near (nearly edge-on) return facade, the first main-facade bay past
 * the corner, the plain connector wall, each pilaster bay individually, and
 * the ground/fence strip. Used two ways: BuildingBlueprint renders these as
 * flat-shaded surface fills under the linework, and BuildingPhotograph
 * clips the real photograph through these exact same shapes so the
 * "blueprint becomes real" transition follows the building's own geometry
 * region by region, not a generic wipe or fade.
 */
function buildPanels(): BuildingPanel[] {
  const panels: BuildingPanel[] = [
    { key: "return-facade", rect: [6, s(2), 11.5, s(56)] },
    { key: "near-bay", rect: [CORNER_X, s(2), 9.5, s(56)] },
    { key: "connector", rect: [27, s(4), 23, s(53)] },
  ];
  // Bays between each pair of pilasters. No trailing bay past the last
  // pilaster (unlike a colonnade running to the frame edge) — the roofline
  // itself ends around x=80 into open sky, so a panel past that would sit
  // on nothing but sky.
  for (let i = 0; i < PILASTER_X.length - 1; i++) {
    const x1 = PILASTER_X[i];
    const x2 = PILASTER_X[i + 1];
    const top = s(
      Math.min(lerp(x1, PILASTER_X_RANGE, PILASTER_TOP_RANGE), lerp(x2, PILASTER_X_RANGE, PILASTER_TOP_RANGE)),
    );
    panels.push({ key: `bay-${i}`, rect: [x1, top - 1.125, x2 - x1, 42 - top] });
  }
  panels.push({ key: "ground", rect: [6, s(56), 74, s(6)] });
  return panels;
}

export const PANELS = buildPanels();

// The order panels materialize in — architecture first, left to right
// across the facade, with the ground/fence/foreground strip held back
// until last since it's clutter (car, pipes, railing), not the subject.
export const REVEAL_ORDER = ["return-facade", "near-bay", "connector", "bay-0", "bay-1", "bay-2", "bay-3", "ground"];

export const PANELS_IN_REVEAL_ORDER = REVEAL_ORDER.map((key) => PANELS.find((p) => p.key === key)!);

// Window-edge mullions — full facade height at their own x, not just
// spanning their window's floor band — read as real vertical structure the
// way the corner pier and pilasters do, just a step quieter. Four zones:
// the return facade's own window column, the first main-facade bay right
// past the corner (the one most likely to get missed), and two per
// pilaster bay across the receding run.
export const MULLION_X = [
  6.5, 14.5, // return facade window
  19, 26.5, // first main-facade bay, past the corner
  ...PILASTER_X.slice(0, -1).flatMap((x1, i) => {
    const x2 = PILASTER_X[i + 1];
    const bayWidth = x2 - x1;
    return [x1 + bayWidth * 0.18, x1 + bayWidth * 0.82];
  }),
];

export const MULLIONS = MULLION_X.map((x) => ({ x, ...facadeEnvelope(x) }));

// Floor-divider lines — six boundaries bracketing five floors, each drawn
// as one continuous path across the *entire* facade width (return facade
// through the last pilaster), not per-zone fragments. Sampled at every x
// where the facade envelope actually changes shape (the corner, the
// connector's two edges, and each pilaster) so the line visibly kisses the
// corner and every pilaster at the exact height `facadeEnvelope` puts them,
// the way a real floor slab reads continuously behind a plain wall too.
const FLOOR_SAMPLE_X = [6, CORNER_X, 27, ...PILASTER_X];
export const FLOOR_COUNT = 5;

function buildFloorLines(): string[] {
  const paths: string[] = [];
  for (let k = 0; k <= FLOOR_COUNT; k++) {
    const points = FLOOR_SAMPLE_X.map((x) => {
      const { top, base } = facadeEnvelope(x);
      const y = top + (k / FLOOR_COUNT) * (base - top);
      return `${x},${s(y).toFixed(2)}`;
    });
    paths.push(`M ${points.join(" L ")}`);
  }
  return paths;
}

export const FLOOR_LINES = buildFloorLines();

// A representative subset of vertices, not every one — the "points" stage
// reads as survey markers establishing the form, not a dense scatter.
export const VERTEX_POINTS: Array<[number, number]> = [
  [6, s(3)],
  [13, s(1.5)],
  [CORNER_X, s(CORNER_TOP)],
  [27, s(facadeEnvelope(27).top)],
  [40, s(6.5)],
  [65, s(13)],
  [80, s(18.5)],
  [CORNER_X, s(CORNER_BASE)],
  ...PILASTER_X.filter((_, i) => i % 2 === 0).map((x): [number, number] => [x, s(lerp(x, PILASTER_X_RANGE, PILASTER_TOP_RANGE))]),
];

// Perspective construction lines — the roofline's near corner and two
// pilaster tops extended toward a shared off-canvas vanishing point, the way
// an architect's perspective sketch is actually constructed. Unlike a
// rising roofline, this facade's roof and base converge toward each other
// moving right (the building foreshortens as it recedes), which places the
// vanishing point down and to the right rather than up and to the right.
export const VANISHING_POINT: [number, number] = [120, s(32)];
export const VOLUME_ORIGINS: Array<[number, number]> = [
  [CORNER_X, s(CORNER_TOP)],
  [50, s(8)],
  [80, s(18.5)],
];

// The roofline — measured through ten points along its actual sweep, from
// the near-edge-on return facade through the corner and across the
// receding pilaster run, not a single guessed arc.
export const ROOFLINE_PATH =
  "M 6,2.25 C 10,1.5 12,1.275 13,1.125 C 15,1.275 16.5,1.425 17.5,1.5 C 23,2.1 27,2.775 30,3.375 C 35,4.125 38,4.5 40,4.875 C 45,5.4 48,5.775 50,6 C 54,6.75 56,7.5 58,7.875 C 61,8.625 63,9.225 65,9.75 C 68,10.5 70,11.1 72,11.625 C 75,12.525 78,13.35 80,13.875";
