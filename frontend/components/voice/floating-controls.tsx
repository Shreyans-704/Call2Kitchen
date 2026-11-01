"use client";

import * as React from "react";
import { Menu, Settings, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FloatingControlsProps {
  onMenuClick?: () => void;
  onSettingsClick?: () => void;
  onCloseClick?: () => void;
  isClosed?: boolean;
}

/**
 * FloatingControls — minimal circular buttons positioned at the top corners.
 * Upper-left: menu. Upper-right: settings. Subtle borders and translucent
 * dark surfaces. Accessible labels and keyboard interactions.
 */
export function FloatingControls({
  onMenuClick,
  onSettingsClick,
  onCloseClick,
  isClosed = false,
}: FloatingControlsProps) {
  const controlStyles =
    "relative z-20 size-10 rounded-full border border-white/10 bg-black/40 backdrop-blur-sm text-white hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-accent-blue transition-colors";

  return (
    <div className="absolute inset-0 pointer-events-none flex justify-between px-6 py-4">
      <div className="pointer-events-auto flex items-start gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onMenuClick}
          aria-label="Menu"
          className={cn(controlStyles, "p-2")}
        >
          <Menu className="size-5" />
        </Button>
        {isClosed && onCloseClick && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCloseClick}
            aria-label="Close session"
            className={cn(controlStyles, "p-2")}
          >
            <X className="size-5" />
          </Button>
        )}
      </div>
      <div className="pointer-events-auto flex items-start gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSettingsClick}
          aria-label="Settings"
          className={cn(controlStyles, "p-2")}
        >
          <Settings className="size-5" />
        </Button>
      </div>
    </div>
  );
}
