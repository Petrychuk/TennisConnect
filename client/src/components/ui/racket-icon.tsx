import * as React from "react";

// Tennis racket icon in the same outline style as the lucide icons
// (24x24, currentColor, 2px stroke) so it can be used the same way.
export function RacketIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <ellipse cx="14.8" cy="9.2" rx="4.6" ry="7" transform="rotate(45 14.8 9.2)" />
      <path d="M10.9 13.1 4.2 19.8" />
      <path d="m3 21 1.7-1.7" strokeWidth="3.2" />
      <path d="M11.5 6.5l6 6M14 4.2l5.8 5.8" strokeWidth="1.2" />
    </svg>
  );
}
