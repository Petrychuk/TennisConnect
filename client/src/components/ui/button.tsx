import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
  TennisConnect button system - the one place a button's shape, size,
  type, colours and states are defined. Used by <Button>, and through
  buttonVariants() by anything that only needs to LOOK like a button
  (a <Link>, an <a>, a dialog action, a popover trigger).

  Rules (keep pages free of their own button styling):
  - Shape: every button uses the shared --radius-button token
    (rounded-button, 12px - index.css). Pages don't set rounded-*.
  - Size: sm (32px), default (40px), lg (48px), icon (40px square),
    icon-sm (32px square). Pages don't set their own height/padding,
    except to stretch a button to a layout (w-full, flex-1, h-11 to
    line up with a neighbouring input).
  - Type: Inter semibold, slightly tracked - the same in every variant.
  - Colour: pick a variant; don't restyle bg/text/border per page.
      default    lime brand button, near-black text (~9.7:1)
      secondary  neutral grey
      outline    light surface with a border
      ghost      no surface until hovered
      destructive  red, white text (--destructive, ~5:1)
      inverse    for dark sections and photos (white text, translucent)
      link       text-only, dark brand green (--primary-text)
  - States: hover darkens/tints, press nudges down 1px, keyboard focus
    is a 2px --ring with an offset (visible on light and dark), disabled
    is 50% opacity and not clickable.
  - Brand detail: the lime button carries a thin darker baseline - a
    "court line" (inset shadow) - which is the signature on every
    primary action across the site, hubs and admin.
*/
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-button border font-sans font-semibold tracking-[0.01em] leading-none",
    "cursor-pointer select-none transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0",
    "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        // Lime + near-black text, never white text: --primary only gives
        // ~2:1 against white.
        default:
          "bg-primary text-foreground border-primary shadow-[inset_0_-2px_0_hsl(var(--primary-text)/0.45)] hover:bg-primary-hover hover:border-primary-hover",
        destructive:
          "bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90",
        outline:
          "bg-background text-foreground border-input shadow-xs hover:bg-accent hover:border-primary-text/40 hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground border-secondary hover:bg-secondary-hover hover:border-secondary-hover",
        ghost:
          "bg-transparent border-transparent hover:bg-foreground/5",
        // White text and a translucent white surface - for buttons on
        // dark sections and photos, where the light variants would glare.
        inverse:
          "bg-white/10 text-white border-white/40 backdrop-blur-sm hover:bg-white/20 hover:border-white/70 focus-visible:ring-white focus-visible:ring-offset-black/40",
        // --primary-text, not --primary: green text on a light background
        // needs the darker brand green (~5:1) - see index.css.
        link:
          "border-transparent bg-transparent text-primary-text underline-offset-4 hover:underline",
      },
      size: {
        sm: "min-h-8 px-3.5 text-sm",
        default: "min-h-10 px-5 text-sm",
        lg: "min-h-12 px-7 text-base",
        icon: "h-10 w-10 p-0",
        "icon-sm": "h-8 w-8 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
