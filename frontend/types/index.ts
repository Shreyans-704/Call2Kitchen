export type StatusVariant = "idle" | "active" | "success" | "warning" | "error";

export type VoiceState =
  | "idle"
  | "incoming"
  | "listening"
  | "processing"
  | "speaking"
  | "reviewing_order"
  | "awaiting_confirmation"
  | "success"
  | "ended"
  | "error";

export interface VoiceStateConfig {
  label: string;
  subLabel?: string;
  orbVariant: "idle" | "listening" | "processing" | "speaking" | "success" | "ended" | "error";
}

export type ButtonVariant = "default" | "outline" | "ghost" | "destructive";

export type ButtonSize = "sm" | "md" | "lg";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  available: boolean;
}

export interface Order {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  items?: Array<{ menuItemId: string; quantity: number; price: number }>;
}
