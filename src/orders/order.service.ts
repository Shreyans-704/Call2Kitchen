import { createHash } from "node:crypto";

import type { CreateOrderRequest } from "./order.schema.js";
import type { OrderRepository } from "./order.types.js";

export class OrderService {
  constructor(private readonly orderRepository: OrderRepository) {}

  async createOrder(request: CreateOrderRequest) {
    return this.orderRepository.createConfirmedOrder({
      quoteId: request.quoteId,
      confirmationTokenHash: sha256(request.confirmationToken),
      idempotencyKey: request.idempotencyKey,
      requestHash: sha256(canonicalOrderRequest(request.quoteId, request.items)),
      requestedItems: request.items
    });
  }
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * This exact field order is also reconstructed by the database RPC before it
 * accepts a request hash. Keep it stable: it binds idempotent retries to the
 * quote ID and the ordered menu-item/quantity list, not client-supplied data.
 */
export function canonicalOrderRequest(
  quoteId: string,
  items: Array<{ menuItemId: string; quantity: number }>
): string {
  return JSON.stringify({
    quoteId,
    items: items.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity
    }))
  });
}
