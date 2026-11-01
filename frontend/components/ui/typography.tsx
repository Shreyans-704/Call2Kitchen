"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

const headingStyles: Record<HeadingLevel, string> = {
  h1: "text-3xl md:text-4xl font-light tracking-tight text-text-primary",
  h2: "text-2xl md:text-3xl font-light tracking-tight text-text-primary",
  h3: "text-xl md:text-2xl font-medium tracking-tight text-text-primary",
  h4: "text-lg font-medium text-text-primary",
  h5: "text-base font-medium text-text-primary",
  h6: "text-sm font-medium text-text-primary",
};

export interface HeadingProps {
  level?: HeadingLevel;
  className?: string;
  children: React.ReactNode;
}

export function Heading({
  level = "h2",
  className,
  children,
  ...rest
}: HeadingProps & Omit<React.HTMLAttributes<HTMLElement>, "children">) {
  const Tag = level;
  return (
    <Tag className={cn(headingStyles[level], className)} {...rest}>
      {children}
    </Tag>
  );
}

type TextAs = "p" | "span" | "div";

export interface TextProps {
  as?: TextAs;
  className?: string;
  children: React.ReactNode;
  muted?: boolean;
  secondary?: boolean;
  small?: boolean;
}

export function Text({
  as: As = "p",
  className,
  children,
  muted = false,
  secondary = false,
  small = false,
  ...rest
}: TextProps & Omit<React.HTMLAttributes<HTMLElement>, "children">) {
  return (
    <As
      className={cn(
        "text-text-primary leading-relaxed",
        muted && "text-text-muted",
        secondary && "text-text-secondary",
        small && "text-sm",
        className,
      )}
      {...rest}
    >
      {children}
    </As>
  );
}

export interface LabelProps {
  className?: string;
  children: React.ReactNode;
}

export function Label({
  className,
  children,
  ...rest
}: LabelProps & Omit<React.HTMLAttributes<HTMLElement>, "children">) {
  return (
    <span
      className={cn(
        "text-xs font-medium tracking-wider uppercase text-text-secondary",
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
