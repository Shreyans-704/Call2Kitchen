"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import type { StatusVariant } from "@/types";

const statusStyles: Record<
  StatusVariant,
  { dot: string; text: string; label: string }
> = {
  idle: {
    dot: "bg-text-muted",
    text: "text-text-muted",
    label: "Idle",
  },
  active: {
    dot: "bg-accent-blue shadow-[0_0_14px_rgba(37,99,235,0.45)]",
    text: "text-accent-blue",
    label: "Active",
  },
  success: {
    dot: "bg-green-500 shadow-[0_0_14px_rgba(34,197,94,0.45)]",
    text: "text-green-500",
    label: "Confirmed",
  },
  warning: {
    dot: "bg-amber-500 shadow-[0_0_14px_rgba(245,158,11,0.45)]",
    text: "text-amber-500",
    label: "Attention",
  },
  error: {
    dot: "bg-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.45)]",
    text: "text-rose-500",
    label: "Error",
  },
};

export interface StatusIndicatorProps {
  variant?: StatusVariant;
  label?: string;
  className?: string;
}

export function StatusIndicator({
  variant = "idle",
  label,
  className,
}: StatusIndicatorProps) {
  const { dot, text, label: defaultLabel } = statusStyles[variant];
  const visibleLabel = label ?? defaultLabel;

  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      aria-label={visibleLabel}
      data-status={variant}
    >
      <span className={cn("inline-block size-2.5 rounded-full", dot)} aria-hidden="true" />
      <span className={cn("text-xs font-medium tracking-wider uppercase", text)}>
        {visibleLabel}
      </span>
    </span>
  );
}
