"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import { BolnaWebCall, type CallState, type CallError, type CallEndInfo } from "@bolna/web-call";

import { useToast } from "@/components/ui/toast";
import { AIOrb } from "@/components/voice/ai-orb";
import { BottomControls } from "@/components/voice/bottom-controls";
import { FloatingControls } from "@/components/voice/floating-controls";
import { StateDevPreview } from "@/components/voice/state-dev-preview";
import { VoiceStatusBar } from "@/components/voice/voice-status-bar";
import { Text, Heading } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { BASE_URL } from "@/lib/api";
import type { VoiceState } from "@/types";

interface VoiceStateConfig {
  label: string;
  subLabel?: string;
}

const STATE_CONFIGS: Record<VoiceState, VoiceStateConfig> = {
  idle: { label: "Ready to take orders", subLabel: "Tap the microphone to start" },
  connecting: {
    label: "Connecting…",
    subLabel: "Allow microphone access if your browser asks",
  },
  incoming: { label: "Incoming order" },
  listening: { label: "Listening…" },
  processing: { label: "Processing request" },
  speaking: { label: "Speaking" },
  reviewing_order: { label: "Reviewing your order" },
  awaiting_confirmation: { label: "Please confirm your order" },
  success: { label: "Order placed successfully" },
  ended: { label: "Call ended" },
  error: { label: "Something went wrong", subLabel: "Please try again" },
};

const SPEAKING_VOLUME_THRESHOLD = 0.05;

function toVoiceState(state: CallState): VoiceState {
  switch (state) {
    case "idle":
      return "idle";
    case "ended":
      return "ended";
    case "connecting":
      // Session mint + microphone permission + WebRTC negotiation.
      return "connecting";
    case "ringing":
      // Microphone is live; the agent has not spoken yet.
      return "listening";
    case "active":
      return "speaking";
  }
}

function describeCallError(error: CallError): string {
  const fallback = error.message || "The voice call failed.";
  switch (error.code) {
    case "mint_failed":
      return fallback;
    case "at_capacity":
      return "All voice lines are busy right now.";
    case "microphone_denied":
      return "Microphone access was denied.";
    case "connect_failed":
      return "Could not connect to the voice agent.";
    case "call_rejected":
      return "The voice agent declined the call.";
    case "autoplay_blocked":
      return "The browser blocked audio playback.";
    case "already_active":
      return "A voice call is already in progress.";
    default:
      return fallback;
  }
}

/**
 * VoiceConsole — immersive, Apple-inspired AI voice interface.
 *
 * Pure black background, a dimensional AI orb at the center, minimal
 * circular controls, and elegant typography. No chat bubbles, no dashboard
 * cards, no fabricated transcripts or orders.
 *
 * Backed by the Bolna Web Call SDK. The SDK owns the call lifecycle
 * (session mint -> mic preflight -> WebRTC connect -> hangup) and emits
 * state changes, errors and volume levels that map onto the existing voice
 * UI states. All browser API access happens inside effect-driven lifecycle
 * handlers, so nothing touches the microphone, AudioContext or peer
 * connection during server-side rendering.
 */
export function VoiceConsole() {
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();

  const callRef = React.useRef<BolnaWebCall | null>(null);
  const [state, setState] = React.useState<VoiceState>("idle");
  const [microphoneEnabled, setMicrophoneEnabled] = React.useState(true);
  const [showClose, setShowClose] = React.useState(false);

  const config = STATE_CONFIGS[state];

  const handleSetState = (next: VoiceState) => {
    setState(next);
    // Show close control once the session leaves idle.
    if (next !== "idle" && next !== "ended") {
      setShowClose(true);
    }
  };

  const handleStartCall = React.useCallback(async () => {
    const call = callRef.current;
    if (!call) {
      return;
    }

    const currentState = call.getState();
    // Prevent duplicate concurrent sessions.
    if (currentState !== "idle" && currentState !== "ended") {
      return;
    }

    try {
      await call.start();
    } catch {
      // Failures surface through the SDK error events; teardown moves the
      // call to its terminal state.
    }
  }, []);

  const handleEndCall = React.useCallback(async () => {
    const call = callRef.current;
    if (call) {
      await call.stop();
      return;
    }
    setState("ended");
    setShowClose(false);
  }, []);

  const handleMicrophoneToggle = React.useCallback(() => {
    const call = callRef.current;
    if (!call) {
      return;
    }

    if (call.getState() === "active") {
      const nextEnabled = !microphoneEnabled;
      setMicrophoneEnabled(nextEnabled);
      call.setMuted(!nextEnabled);
      return;
    }

    // Explicit user interaction only: idle/ended sessions start here.
    void handleStartCall();
  }, [handleStartCall, microphoneEnabled]);

  const handleMenuClick = () => {
    toast({
      type: "info",
      title: "Voice console",
      description: "Menu options are not connected yet.",
    });
  };

  const handleSettingsClick = () => {
    toast({
      type: "info",
      title: "Voice console",
      description: "Settings are not connected yet.",
    });
  };

  const isSpeaking = state === "speaking";
  const isListening = state === "listening";

  React.useEffect(() => {
    const call = new BolnaWebCall({
      sessionUrl: `${BASE_URL}/api/bolna-session`,
    });
    callRef.current = call;

    const handleStateChange = (next: CallState) => {
      const nextVoiceState = toVoiceState(next);
      setState(nextVoiceState);
      setShowClose(
        nextVoiceState !== "idle" &&
          nextVoiceState !== "ended" &&
          nextVoiceState !== "error",
      );
    };

    const handleCallStart = () => {
      setState("speaking");
    };

    const handleCallEnd = (_info: CallEndInfo) => {
      setState("ended");
      setShowClose(false);
    };

    const handleError = (error: CallError) => {
      setState("error");
      setShowClose(false);
      toast({
        type: "error",
        title: "Voice call",
        description: describeCallError(error),
      });
    };

    const handleVolumeLevel = (level: number) => {
      const currentCall = callRef.current;
      if (!currentCall) {
        return;
      }
      if (currentCall.getState() === "active") {
        setState(level > SPEAKING_VOLUME_THRESHOLD ? "speaking" : "listening");
      }
    };

    call.on("state-change", handleStateChange);
    call.on("call-start", handleCallStart);
    call.on("call-end", handleCallEnd);
    call.on("error", handleError);
    call.on("volume-level", handleVolumeLevel);

    return () => {
      call.off("state-change", handleStateChange);
      call.off("call-start", handleCallStart);
      call.off("call-end", handleCallEnd);
      call.off("error", handleError);
      call.off("volume-level", handleVolumeLevel);
      void call.stop();
      callRef.current = null;
    };
  }, [toast]);

  return (
    <div
      className={cn(
        "fixed inset-0 bg-black text-white min-h-screen flex flex-col",
        reduceMotion ? "" : "overflow-hidden",
      )}
    >
      {/* Top bar — time + compact session status */}
      <VoiceStatusBar state={state} />

      {/* Floating controls — menu upper-left, settings upper-right */}
      <FloatingControls
        onMenuClick={handleMenuClick}
        onSettingsClick={handleSettingsClick}
        onCloseClick={handleEndCall}
        isClosed={showClose}
      />

      {/* Central content — orb + state text */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pt-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={state}
            className="flex flex-col items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <AIOrb size={270} state={state} className="mb-8" />
            <Heading
              level="h2"
              className={cn(
                "text-3xl md:text-5xl font-light tracking-tight",
                isSpeaking || isListening ? "text-accent-blue" : "text-white",
              )}
            >
              {config.label}
            </Heading>
            {config.subLabel && (
              <Text small muted className="mt-2 text-text-secondary">
                {config.subLabel}
              </Text>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls — mic, end/close, status/transcript */}
      <BottomControls
        state={state}
        onMicrophoneToggle={handleMicrophoneToggle}
        onEndCall={handleEndCall}
        microphoneEnabled={microphoneEnabled}
      />

      {/* Development-only state preview — not in production */}
      <StateDevPreview state={state} onStateChange={handleSetState} />
    </div>
  );
}
