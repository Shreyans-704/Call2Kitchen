import { z } from "zod";

import { getSupabaseClient } from "../lib/supabase.js";
import type { QuoteRepository, StoredQuote } from "./order.types.js";

const storedQuoteSchema = z.object({
  id: z.string().uuid(),
  expires_at: z.string()
});

export const liveQuoteRepository: QuoteRepository = {
  async createQuote(input): Promise<StoredQuote> {
    const { data, error } = await getSupabaseClient()
      .from("order_quotes")
      .insert({
        restaurant_id: input.restaurantId,
        requested_items: input.requestedItems,
        quoted_items: input.quotedItems,
        total_amount: input.totalAmount,
        currency: "INR",
        confirmation_token_hash: input.confirmationTokenHash,
        expires_at: input.expiresAt
      })
      .select("id, expires_at")
      .single();

    if (error) {
      throw new Error("Could not persist the order quote", { cause: error });
    }

    const quote = storedQuoteSchema.parse(data);
    return { id: quote.id, expiresAt: quote.expires_at };
  }
};
