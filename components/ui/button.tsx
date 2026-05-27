import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_16px_35px_-24px_rgba(54,67,101,0.8)] hover:-translate-y-0.5 hover:bg-primary/90",
        accent:
          "bg-accent text-accent-foreground shadow-[0_16px_35px_-24px_rgba(205,163,138,0.75)] hover:-translate-y-0.5 hover:bg-accent/90",
        outline:
          "border border-border bg-white/85 text-foreground shadow-sm hover:-translate-y-0.5 hover:bg-muted",
        secondary: "bg-muted text-foreground shadow-sm hover:-translate-y-0.5 hover:bg-muted/80",
        ghost: "text-foreground hover:bg-muted/80",
        destructive:
          "bg-rose-600 text-white shadow-[0_16px_35px_-24px_rgba(225,29,72,0.8)] hover:-translate-y-0.5 hover:bg-rose-700"
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-12 px-5",
        full: "h-11 w-full px-4 py-2",
        icon: "h-11 w-11"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      ref={ref}
      type={type}
      {...props}
    />
  )
);

Button.displayName = "Button";

export { Button, buttonVariants };
