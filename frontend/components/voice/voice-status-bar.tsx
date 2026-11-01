"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { StatusIndicator } from "@/components/ui/status-indicator";
import type { VoiceState } from "@/types";

interface VoiceStatusBarProps {
  state: VoiceState;
}

const stateLabels: Record<VoiceState, string> = {
  idle: "Ready",
  incoming: "Incoming",
  listening: "Listening",
  processing: "Processing",
  speaking: "Speaking",
  reviewing_order: "Reviewing order",
  awaiting_confirmation: "Confirming",
  success: "Complete",
  ended: "Ended",
  error: "Error",
};

const stateVariants: Record<VoiceState, Parameters<typeof StatusIndicator>[0]["variant"] | undefined> = {
  idle: undefined,
  incoming: "active",
  listening: "active",
  processing: "active",
  speaking: "active",
  reviewing_order: undefined,
  awaiting_confirmation: undefined,
  success: "success",
  ended: undefined,
  error: "error",
};

/**
 * VoiceStatusBar — compact top bar showing the current time and voice
 * session status. Minimal, no chrome.
 */
export function VoiceStatusBar({ state }: VoiceStatusBarProps) {
  // `time` starts as `null` so the initial server render and the client
  // hydration render emit identical HTML. The live clock is seeded and
  // started inside useEffect after hydration, which avoids a React hydration
  // mismatch: server and client can disagree on both the current time and the
  // default locale used by `toLocaleTimeString`.
  const [time, setTime] = React.useState<Date | null>(null);

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = time
    ? time.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--:--";

  const variant = stateVariants[state];

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3",
        state === "ended" || state === "error" ? "opacity-60" : "",
      )}
    >
      <div className="text-xs font-medium text-white tracking-wider">
        {timeString}
      </div>
      <div className="flex items-center gap-2">
        <span
          className="inline-block size-1.5 rounded-full"
          style={{
            backgroundColor:
              variant === "active"
                ? "rgba(37, 99, 235, 0.9)"
                : variant === "success"
                ? "rgba(34, 197, 94, 0.9)"
                : variant === "error"
                ? "rgba(244, 63, 94, 0.9)"
                : "rgba(255, 255, 255, 0.5)",
          }}
          aria-hidden="true"
        />
        <span className="text-xs font-medium text-white/70">
          {stateLabels[state]}
        </span>
      </div>
    </div>
  );
}
