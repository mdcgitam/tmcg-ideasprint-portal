/**
 * Global hidden SVG filter defs, mounted once in the root layout.
 *
 * `logo-key-black`: keys black out of the TMCG mark (a flat-black JPEG,
 * no alpha channel) by replacing the alpha channel with the pixel's own
 * luminance — black becomes transparent, the gold linework stays exactly
 * its original color. This works regardless of DOM/stacking-context
 * structure since it only reads the image's own pixels (mix-blend-mode
 * was tried first but proved unreliable once the logo sat behind several
 * nested layers — likely a GPU compositing-layer quirk, not a CSS bug).
 */
export function SvgFilterDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <filter id="logo-key-black" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0.2126 0.7152 0.0722 0 0"
          />
        </filter>
      </defs>
    </svg>
  );
}
