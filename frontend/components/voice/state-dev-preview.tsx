"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { VoiceState } from "@/types";

const DEV_STATES: VoiceState[] = [
  "idle",
  "connecting",
  "incoming",
  "listening",
  "processing",
  "speaking",
  "reviewing_order",
  "awaiting_confirmation",
  "ended",
  "error",
];

const DEV_STATE_LABELS: Record<VoiceState, string> = {
  idle: "Idle",
  connecting: "Connecting",
  incoming: "Incoming",
  listening: "Listening",
  processing: "Processing",
  speaking: "Speaking",
  reviewing_order: "Reviewing order",
  awaiting_confirmation: "Awaiting confirmation",
  success: "Success",
  ended: "Ended",
  error: "Error",
};

/**
 * StateDevPreview — development-only panel for previewing voice states
 * without a real phone call.
 *
 * Only rendered when NODE_ENV is development. Visually separated from the
 * production experience with a clear "DEV" badge. Keyboard accessible:
 * each state is a focusable button; pressing a state button updates the
 * console state. Preview states are clearly separated from actual call
 * states via the "DEV PREVIEW" heading and border styling.
 */
export function StateDevPreview({
  state,
  onStateChange,
}: {
  state: VoiceState;
  onStateChange: (next: VoiceState) => void;
}) {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed top-24 right-4 z-40 w-64 border border-white/10 bg-black/80 backdrop-blur-md rounded-lg p-4 shadow-2xl",
        state === "error" ? "border-rose-500/30" : "border-white/10",
      )}
      aria-label="Development state preview"
    >
      <div className="flex items-center justify-between mb-3">
        <Text small secondary className="font-medium tracking-wider uppercase">
          Dev Preview
        </Text>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-[10px] font-medium text-white/60">
          DEV
        </span>
      </div>
      <Text small muted className="mb-3 text-text-muted">
        Not connected to Bolna. State simulation only.
      </Text>
      <div className="grid grid-cols-2 gap-2">
        {DEV_STATES.map((devState) => (
          <Button
            key={devState}
            variant="outline"
            size="sm"
            onClick={() => onStateChange(devState)}
            aria-pressed={state === devState}
            className={cn(
              "text-[11px] leading-none",
              state === devState
                ? "bg-white/10 border-white/20 text-white"
                : "bg-white/5 border-white/5 text-white/50 hover:border-white/20",
            )}
          >
            {DEV_STATE_LABELS[devState]}
          </Button>
        ))}
      </div>
    </div>
  );
}
