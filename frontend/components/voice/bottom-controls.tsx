"use client";

import * as React from "react";
import { Mic, MicOff, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { VoiceState } from "@/types";

interface BottomControlsProps {
  state: VoiceState;
  transcript?: string;
  onMicrophoneToggle?: () => void;
  onEndCall?: () => void;
  microphoneEnabled?: boolean;
}

/**
 * BottomControls — restrained bottom control area with microphone control,
 * session end control, and a compact status/transcript line. Mobile
 * safe-area spacing included. Does not resemble a standard chatbot input.
 */
export function BottomControls({
  state,
  transcript,
  onMicrophoneToggle,
  onEndCall,
  microphoneEnabled = true,
}: BottomControlsProps) {
  const isActive =
    state === "listening" ||
    state === "processing" ||
    state === "speaking" ||
    state === "incoming";
  const showEnd = state === "ended" || state === "error" || state === "success";

  const micAriaLabel = microphoneEnabled ? "Mute microphone" : "Unmute microphone";

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 pointer-events-none",
        state === "idle" ? "opacity-0 transition-opacity duration-300" : "opacity-100",
      )}
    >
      <div className="pointer-events-auto w-full px-6 pb-6 sm:pb-8">
        {/* Safe-area padding for devices with bottom notches/home indicators */}
        <div className="max-w-md mx-auto relative">
          {/* Compact status / transcript line — restrained, no chat bubbles */}
          {transcript && (
            <div className="mb-4 flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-accent-blue" aria-hidden="true" />
              <Text
                small
                muted
                className="max-w-[340px] truncate text-text-secondary"
              >
                {transcript}
              </Text>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            {/* Microphone control — prominent circular toggle */}
            <Button
              variant="ghost"
              size="lg"
              onClick={onMicrophoneToggle}
              aria-label={micAriaLabel}
              aria-pressed={microphoneEnabled}
              disabled={isActive && state !== "speaking"}
              className={cn(
                "size-16 rounded-full border border-white/10 bg-black/50 backdrop-blur text-white",
                !microphoneEnabled &&
                  "bg-rose-500/10 border-rose-500/20 text-rose-400",
                isActive && state !== "speaking" && "opacity-60 pointer-events-none",
              )}
            >
              {microphoneEnabled ? (
                <MicOff className="size-6" />
              ) : (
                <Mic className="size-6 text-accent-blue" />
              )}
            </Button>

            {/* Session end / close control — shown when relevant */}
            {showEnd && onEndCall && (
              <Button
                variant="destructive"
                size="lg"
                onClick={onEndCall}
                aria-label="End session"
                className="size-16 rounded-full"
              >
                <Send className="size-6" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
