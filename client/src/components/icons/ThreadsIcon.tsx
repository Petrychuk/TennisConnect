import type { SVGProps } from "react";

// Same situation as TikTokIcon - Threads' logomark isn't part of
// lucide-react's generic icon set, so this is a small stand-in path.
export function ThreadsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path d="M12.2 2C7.1 2 3.4 4.8 3.1 9.9c-.02.4.29.75.7.75.36 0 .66-.27.69-.63C4.8 6.15 7.7 3.9 12.2 3.9c4.6 0 7.4 2.36 7.4 6.6 0 3.02-1.28 4.9-3.1 5.86-.2-1.6-1.02-2.9-2.36-3.7a5.6 5.6 0 0 0-2.9-.78c-2.24 0-4.04 1.3-4.04 3.24 0 1.98 1.66 3.28 4.02 3.28 1.9 0 3.36-.8 4.24-2.2.3.24.56.53.76.87-.98 1.5-2.74 2.35-5 2.35-3.36 0-5.9-1.98-5.9-5.4 0-1.9.86-3.4 2.3-4.3-1.06-.86-1.66-2.1-1.66-3.6C6.66 3.5 8.9 2 12.2 2Zm-.14 9.36c-1.4 0-2.3.66-2.3 1.6 0 .9.9 1.5 2.2 1.5 1.5 0 2.6-.68 2.94-2.02a4.2 4.2 0 0 0-2.84-1.08Z" />
    </svg>
  );
}
