"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-ink-black disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-accent-blue text-white hover:bg-accent-blue/90 shadow-sm",
        outline:
          "border border-ink-border hover:bg-accent-white/05 hover:border-ink-border-hover text-primary",
        ghost:
          "hover:bg-accent-white-soft hover:text-primary text-secondary",
        destructive:
          "bg-red-600/10 border border-red-600/20 text-red-400 hover:bg-red-600/20 hover:text-red-400",
      },
      size: {
        sm: "h-8 px-3 gap-1.5",
        md: "h-10 px-4 gap-2",
        lg: "h-11 px-6 gap-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends VariantProps<typeof buttonVariants>,
    React.ButtonHTMLAttributes<HTMLButtonElement> {}

export function Button(props: ButtonProps) {
  const { className, variant, size, disabled, ...rest } = props;
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled}
      {...rest}
    />
  );
}
