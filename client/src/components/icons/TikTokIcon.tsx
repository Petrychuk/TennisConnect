import type { SVGProps } from "react";

// TikTok's logomark isn't in lucide-react (it only ships generic icons,
// not brand marks), so this is a small hand-drawn stand-in - single
// path, fill="currentColor", sized/styled the same way lucide icons are
// (accepts the usual className="w-N h-N" etc.).
export function TikTokIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path d="M16.6 5.82c-.9-.98-1.4-2.26-1.4-3.6h-3.24v13.44a3.16 3.16 0 0 1-5.68 1.9 3.16 3.16 0 0 1 2.53-5.06c.31 0 .61.05.9.13V9.4a6.4 6.4 0 0 0-.9-.06 6.4 6.4 0 1 0 6.4 6.4V9.28a9.14 9.14 0 0 0 5.33 1.7V7.75a5.66 5.66 0 0 1-3.94-1.93Z" />
    </svg>
  );
}
