"use client";

import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";

import { Heading } from "./typography";
import { Text } from "./typography";

/**
 * Full-page loading foundation. Used while a route or section is not yet
 * ready for interaction. Announces itself to assistive technology through
 * an aria-live region instead of relying on decorative spinners alone.
 */
export interface PageLoadingProps {
  title?: string;
  description?: string;
}

export function PageLoading({
  title = "Loading",
  description = "Please wait while the interface prepares.",
}: PageLoadingProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink-black text-text-primary"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <motion.div
          className="relative"
          animate={reduceMotion ? {} : { rotate: [0, 360] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          <svg
            className="size-12 text-accent-blue"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6a6 6 0 0 1 6 6h6" />
          </svg>
        </motion.div>
        <div className="text-center">
          <Heading level="h3" className="text-text-secondary">
            {title}
          </Heading>
          <Text as="p" muted className="mt-2 max-w-xs">
            {description}
          </Text>
        </div>
      </div>
    </div>
  );
}
