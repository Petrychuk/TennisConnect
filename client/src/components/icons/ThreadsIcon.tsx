import type { SVGProps } from "react";

// Threads' logomark is a stylised "@" - rendering it as a bold glyph
// gets much closer to the real mark than a hand-drawn path (tried that
// first; this sandbox has no way to preview bezier curves against the
// real logo, so freehand tracing kept coming out wrong). Colour is
// controlled the same way as the other footer icons, via `currentColor`
// on the wrapping element - "the black bits" from the reference badge
// become the brand colour, same as Facebook/Instagram/TikTok here.
export function ThreadsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <text
        x="12"
        y="17.5"
        fontSize="19"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fill="currentColor"
      >
        @
      </text>
    </svg>
  );
}
