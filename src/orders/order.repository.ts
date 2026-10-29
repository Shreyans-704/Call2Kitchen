import { z } from "zod";

import { AppError } from "../errors/app-error.js";
import { getSupabaseClient } from "../lib/supabase.js";
import type { OrderRepository, PersistedOrder } from "./order.types.js";

const persistedOrderSchema = z.object({
  id: z.string().uuid(),
  status: z.literal("NEW"),
  currency: z.literal("INR"),
  items: z.array(
    z.object({
      menuItemId: z.string().uuid(),
      name: z.string(),
      quantity: z.number().int().positive(),
      unitPrice: z.string().regex(/^\d+\.\d{2}$/),
      lineTotal: z.string().regex(/^\d+\.\d{2}$/)
    })
  ),
  totalAmount: z.string().regex(/^\d+\.\d{2}$/),
  createdAt: z.string()
});

const rpcResultSchema = z.object({
  replayed: z.boolean(),
  order: persistedOrderSchema
});

const clientErrors = new Set([
  "quote_not_found",
  "invalid_confirmation_token",
  "quote_expired",
  "quote_already_consumed",
  "quote_changed",
  "invalid_request_hash",
  "menu_item_missing_or_wrong_restaurant",
  "menu_item_unavailable"
]);

export const liveOrderRepository: OrderRepository = {
  async createConfirmedOrder(input) {
    const { data, error } = await getSupabaseClient().rpc("create_confirmed_order", {
      p_quote_id: input.quoteId,
      p_confirmation_token_hash: input.confirmationTokenHash,
      p_idempotency_key: input.idempotencyKey,
      p_request_hash: input.requestHash,
      p_items: input.requestedItems
    });

    if (error) {
      if (clientErrors.has(error.message)) {
        throw new AppError("The confirmed quote can no longer be placed", 400);
      }

      if (error.message === "idempotency_conflict" || error.code === "23505") {
        throw new AppError("Idempotency key conflicts with another order", 409);
      }

      throw new Error("Could not persist the confirmed order", { cause: error });
    }

    const result = rpcResultSchema.parse(data);
    return { order: result.order as PersistedOrder, replayed: result.replayed };
  }
};
