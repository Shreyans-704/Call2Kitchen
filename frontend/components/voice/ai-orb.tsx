"use client";

import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";

import { cn } from "@/lib/utils";
import type { VoiceState } from "@/types";

interface AIOrbProps {
  size?: number;
  state: VoiceState;
  className?: string;
}

/**
 * AIOrb — dimensional, luminous sphere that serves as the visual centerpiece
 * of the AI Voice Console.
 *
 * Built with layered CSS gradients and Framer Motion. No WebGL or heavy
 * dependencies. The orb responds to voice state with restrained, premium
 * animation: gentle breathing at idle, active motion while listening,
 * controlled pulsing while processing, expressive illumination while speaking,
 * and a calm fade when ended.
 */
export function AIOrb({
  size = 220,
  state,
  className,
}: AIOrbProps) {
  const reduceMotion = useReducedMotion();

  // Orb color accents per voice state — kept within the blue/white/periwinkle
  // premium palette, with rose only for the restrained error state.
  const stateColors: Record<VoiceState, { inner: string; outer: string; glow: string }> = {
    idle: {
      inner: "rgba(255, 255, 255, 0.10)",
      outer: "rgba(99, 102, 241, 0.18)",
      glow: "rgba(99, 102, 241, 0.35)",
    },
    incoming: {
      inner: "rgba(255, 255, 255, 0.16)",
      outer: "rgba(37, 99, 235, 0.30)",
      glow: "rgba(37, 99, 235, 0.50)",
    },
    listening: {
      inner: "rgba(255, 255, 255, 0.22)",
      outer: "rgba(37, 99, 235, 0.38)",
      glow: "rgba(37, 99, 235, 0.55)",
    },
    processing: {
      inner: "rgba(255, 255, 255, 0.14)",
      outer: "rgba(99, 102, 241, 0.30)",
      glow: "rgba(99, 102, 241, 0.45)",
    },
    speaking: {
      inner: "rgba(255, 255, 255, 0.30)",
      outer: "rgba(255, 255, 255, 0.20)",
      glow: "rgba(255, 255, 255, 0.50)",
    },
    reviewing_order: {
      inner: "rgba(255, 255, 255, 0.16)",
      outer: "rgba(37, 99, 235, 0.28)",
      glow: "rgba(37, 99, 235, 0.42)",
    },
    awaiting_confirmation: {
      inner: "rgba(255, 255, 255, 0.18)",
      outer: "rgba(37, 99, 235, 0.32)",
      glow: "rgba(37, 99, 235, 0.48)",
    },
    success: {
      inner: "rgba(255, 255, 255, 0.28)",
      outer: "rgba(255, 255, 255, 0.25)",
      glow: "rgba(255, 255, 255, 0.55)",
    },
    ended: {
      inner: "rgba(255, 255, 255, 0.06)",
      outer: "rgba(99, 102, 241, 0.10)",
      glow: "rgba(99, 102, 241, 0.20)",
    },
    error: {
      inner: "rgba(244, 63, 94, 0.14)",
      outer: "rgba(244, 63, 94, 0.22)",
      glow: "rgba(244, 63, 94, 0.35)",
    },
  };

  const colors = stateColors[state];

  // Motion variants per voice state. Reduced motion disables animated
  // properties so the orb rests at its final state.
  const containerVariants: Record<
    VoiceState,
    React.ComponentProps<typeof motion.div>["animate"]
  > = {
    idle: { scale: [1, 1.02, 1] },
    incoming: { scale: [1, 1.04, 1] },
    listening: { scale: [1, 1.05, 1, 1.02, 1] },
    processing: { scale: [1, 1.03, 1] },
    speaking: { scale: [1, 1.06, 1, 1.04, 1] },
    reviewing_order: { scale: [1, 1.025, 1] },
    awaiting_confirmation: { scale: [1, 1.035, 1] },
    success: { scale: [1, 1.05, 1] },
    ended: { scale: 1 },
    error: { scale: [1, 1.04, 1] },
  };

  const containerTransitions: Record<
    VoiceState,
    React.ComponentProps<typeof motion.div>["transition"]
  > = {
    idle: { duration: 6, repeat: Infinity, ease: "easeInOut" },
    incoming: { duration: 3, repeat: Infinity, ease: "easeInOut" },
    listening: { duration: 4, repeat: Infinity, ease: "easeInOut" },
    processing: { duration: 5, repeat: Infinity, ease: "easeInOut" },
    speaking: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
    reviewing_order: { duration: 5.5, repeat: Infinity, ease: "easeInOut" },
    awaiting_confirmation: { duration: 4.5, repeat: Infinity, ease: "easeInOut" },
    success: { duration: 4, repeat: Infinity, ease: "easeInOut" },
    ended: { duration: 0 },
    error: { duration: 3, repeat: Infinity, ease: "easeInOut" },
  };

  const highlightVariants: Record<
    VoiceState,
    React.ComponentProps<typeof motion.div>["animate"]
  > = {
    idle: { opacity: [0.35, 0.55, 0.35] },
    incoming: { opacity: [0.4, 0.7, 0.4] },
    listening: { opacity: [0.45, 0.75, 0.45, 0.55, 0.45] },
    processing: { opacity: [0.4, 0.65, 0.4] },
    speaking: { opacity: [0.5, 0.85, 0.5, 0.7, 0.5] },
    reviewing_order: { opacity: [0.42, 0.6, 0.42] },
    awaiting_confirmation: { opacity: [0.44, 0.68, 0.44] },
    success: { opacity: [0.5, 0.8, 0.5] },
    ended: { opacity: 0.3 },
    error: { opacity: [0.4, 0.75, 0.4] },
  };

  const glowVariants: Record<
    VoiceState,
    React.ComponentProps<typeof motion.div>["animate"]
  > = {
    idle: { opacity: [0.35, 0.55, 0.35] },
    incoming: { opacity: [0.4, 0.75, 0.4] },
    listening: { opacity: [0.45, 0.8, 0.45, 0.6, 0.45] },
    processing: { opacity: [0.4, 0.65, 0.4] },
    speaking: { opacity: [0.5, 0.85, 0.5, 0.75, 0.5] },
    reviewing_order: { opacity: [0.42, 0.62, 0.42] },
    awaiting_confirmation: { opacity: [0.44, 0.7, 0.44] },
    success: { opacity: [0.5, 0.85, 0.5] },
    ended: { opacity: 0.2 },
    error: { opacity: [0.4, 0.8, 0.4] },
  };

  const glowTransition: React.ComponentProps<typeof motion.div>["transition"] = {
    duration: 4,
    repeat: Infinity,
    ease: "easeInOut",
  };

  const motionProps = reduceMotion
    ? {}
    : {
        animate: containerVariants[state],
        transition: containerTransitions[state],
      };

  const highlightMotionProps = reduceMotion
    ? {}
    : {
        animate: highlightVariants[state],
        transition: glowTransition,
      };

  const glowMotionProps = reduceMotion
    ? {}
    : {
        animate: glowVariants[state],
        transition: glowTransition,
      };

  return (
    <div
      className={cn("relative inline-block", className)}
      style={{ width: size, height: size }}
    >
      {/* External ambient glows — layered, soft, no neon harshness */}
      <motion.div
        className="absolute inset-0 rounded-full blur-[64px] pointer-events-none"
        style={{ backgroundColor: colors.glow, opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 rounded-full blur-[40px] pointer-events-none"
        style={{ backgroundColor: colors.glow, opacity: 0 }}
        {...glowMotionProps}
      />
      <motion.div
        className="absolute inset-0 rounded-full blur-[24px] pointer-events-none"
        style={{ backgroundColor: colors.outer, opacity: 0 }}
        {...glowMotionProps}
      />

      {/* Core sphere — dimensional lighting via layered radial gradients */}
      <motion.div
        className={cn(
          "absolute inset-0 rounded-full border border-white/10 relative overflow-hidden",
        )}
        style={{
          backgroundImage:
            `radial-gradient(circle at 38% 38%, ${colors.inner}, ${colors.outer} 45%, rgba(0,0,0,0.85) 100%)`,
          boxShadow:
            "inset -6px -6px 16px rgba(0, 0, 0, 0.55), inset 6px 6px 14px rgba(255, 255, 255, 0.14)",
        }}
        {...motionProps}
      >
        {/* Inner luminous core — subtle pulsing light at the center */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
          style={{
            width: "55%",
            height: "55%",
            backgroundImage:
              "radial-gradient(circle at center, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0) 60%)",
            opacity: state === "speaking" ? 0.85 : state === "listening" ? 0.5 : 0.3,
          }}
          animate={
            reduceMotion || state !== "speaking"
              ? {}
              : { opacity: [0.6, 0.9, 0.6] }
          }
          transition={{
            duration: state === "speaking" ? 2.5 : 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Specular highlight — top-left, dimensional sheen */}
        <motion.div
          className="absolute top-14 left-14 size-8 rounded-full bg-white/40 blur-sm pointer-events-none"
          style={{
            transform: "rotate(-22deg) translateX(-6px) translateY(-6px)",
          }}
          {...highlightMotionProps}
        />

        {/* Secondary rim highlight — bottom-right edge for depth */}
        <div
          className="absolute bottom-8 right-8 size-6 rounded-full bg-white/10 blur-xs pointer-events-none"
          style={{
            transform: "rotate(-22deg) translateX(4px) translateY(4px)",
          }}
        />
      </motion.div>

      {/* Outer rim ring — subtle edge definition */}
      <div
        className="absolute inset-0 rounded-full border border-white/8 pointer-events-none"
        style={{ opacity: state === "ended" ? 0.2 : 0.5 }}
      />
    </div>
  );
}
