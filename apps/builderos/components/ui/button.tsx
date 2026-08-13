import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-acid/70 focus-visible:ring-offset-2 focus-visible:ring-offset-night disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        default: "bg-acid text-night shadow-sm hover:bg-acid/90",
        ghost: "text-copy hover:bg-surface-secondary hover:text-ink",
      },
      size: {
        default: "h-9 px-4 py-2",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
