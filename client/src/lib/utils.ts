import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// tailwind-merge only knows Tailwind's built-in radius names. Teach it the
// shared button radius token (index.css --radius-button -> rounded-button)
// so cn("rounded-button", "rounded-full") resolves to one radius instead
// of keeping both and letting CSS order decide.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["button"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
