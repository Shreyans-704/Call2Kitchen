import { describe, expect, it, vi } from "vitest";

import { canonicalOrderRequest, OrderService, sha256 } from "../src/orders/order.service.js";
import type { OrderRepository } from "../src/orders/order.types.js";

const quoteId = "00000000-0000-4000-8000-000000000301";
const menuItemId = "00000000-0000-4000-8000-000000000103";

function persistedOrder() {
  return {
    replayed: false,
    order: {
      id: "00000000-0000-4000-8000-000000000401",
      status: "NEW" as const,
      currency: "INR" as const,
      items: [{ menuItemId, name: "Paneer Butter Masala", quantity: 2, unitPrice: "260.00", lineTotal: "520.00" }],
      totalAmount: "520.00",
      createdAt: "2026-10-21T20:30:00.000Z"
    }
  };
}

describe("OrderService", () => {
  it("hashes the capability token and canonical confirmed contents before persistence", async () => {
    const createConfirmedOrder = vi.fn<OrderRepository["createConfirmedOrder"]>().mockResolvedValue(persistedOrder());
    const service = new OrderService({ createConfirmedOrder });
    const confirmationToken = "a".repeat(43);

    const result = await service.createOrder({
      quoteId,
      confirmationToken,
      idempotencyKey: "idem-key-00000001",
      items: [{ menuItemId, quantity: 2 }]
    });

    expect(result).toEqual(persistedOrder());
    expect(createConfirmedOrder).toHaveBeenCalledWith({
      quoteId,
      confirmationTokenHash: sha256(confirmationToken),
      idempotencyKey: "idem-key-00000001",
      requestHash: sha256(canonicalOrderRequest(quoteId, [{ menuItemId, quantity: 2 }])),
      requestedItems: [{ menuItemId, quantity: 2 }]
    });
  });

  it("uses the canonical request serialization expected by the database RPC", () => {
    expect(canonicalOrderRequest(quoteId, [{ menuItemId, quantity: 2 }])).toBe(
      `{"quoteId":"${quoteId}","items":[{"menuItemId":"${menuItemId}","quantity":2}]}`
    );
  });

  it("does not turn a repository failure into a successful order", async () => {
    const service = new OrderService({
      createConfirmedOrder: async () => {
        throw new Error("transaction failed");
      }
    });

    await expect(
      service.createOrder({
        quoteId,
        confirmationToken: "a".repeat(43),
        idempotencyKey: "idem-key-00000001",
        items: [{ menuItemId, quantity: 2 }]
      })
    ).rejects.toThrow("transaction failed");
  });
});
