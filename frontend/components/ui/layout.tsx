"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function Container({ children, className }: ContainerProps) {
  return (
    <div className={cn("mx-auto max-w-6xl px-4 md:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}

export interface SectionProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

export function Section({
  children,
  className,
  padding = "md",
}: SectionProps) {
  const paddingClasses: Record<string, string> = {
    none: "",
    sm: "py-8 md:py-10",
    md: "py-12 md:py-16",
    lg: "py-16 md:py-24",
  };
  return (
    <section className={cn("relative", paddingClasses[padding], className)}>
      {children}
    </section>
  );
}

export interface StackProps {
  children: React.ReactNode;
  className?: string;
  gap?: "sm" | "md" | "lg" | "xl";
}

export function Stack({ children, className, gap = "md" }: StackProps) {
  const gapClasses: Record<string, string> = {
    sm: "gap-4",
    md: "gap-6",
    lg: "gap-8",
    xl: "gap-12",
  };
  return (
    <div className={cn("flex flex-col", gapClasses[gap], className)}>
      {children}
    </div>
  );
}

export interface GridProps {
  children: React.ReactNode;
  className?: string;
  cols?: 1 | 2 | 3 | 4;
}

export function Grid({ children, className, cols = 1 }: GridProps) {
  const colsClasses: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  };
  return (
    <div className={cn("grid gap-6", colsClasses[cols], className)}>
      {children}
    </div>
  );
}
