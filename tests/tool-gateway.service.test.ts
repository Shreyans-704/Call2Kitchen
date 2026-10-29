import { describe, expect, it, vi } from "vitest";

import { AppError } from "../src/errors/app-error.js";
import {
  createToolGatewayAuthMiddleware,
  hasValidGatewayAuthorization
} from "../src/middleware/tool-gateway-auth.middleware.js";
import type { MenuItem, MenuRepository } from "../src/menu/menu.types.js";
import type { OrderRepository, QuoteRepository } from "../src/orders/order.types.js";
import { ToolGatewayService, toolNameSchema } from "../src/tools/tool-gateway.service.js";

const restaurantId = "00000000-0000-4000-8000-000000000001";
const menuItemId = "00000000-0000-4000-8000-000000000103";
const quoteId = "00000000-0000-4000-8000-000000000301";

const paneer: MenuItem = {
  id: menuItemId,
  restaurantId,
  name: "Paneer Butter Masala",
  description: "Paneer in tomato gravy",
  price: "260.00",
  category: "Main Course",
  isAvailable: true,
  allergens: ["dairy"]
};

function createMenuRepository(): MenuRepository {
  return {
    listAvailable: vi.fn(async () => [paneer]),
    findAvailableById: vi.fn(async (id) => (id === menuItemId ? paneer : null)),
    findByIds: vi.fn(async (ids) => (ids.includes(menuItemId) ? [paneer] : []))
  };
}

function createQuoteRepository(): QuoteRepository {
  return {
    createQuote: vi.fn(async () => ({
      id: quoteId,
      expiresAt: "2026-10-22T00:05:00.000Z"
    }))
  };
}

function createOrderRepository(): OrderRepository {
  return {
    createConfirmedOrder: vi.fn(async () => ({
      replayed: false,
      order: {
        id: "00000000-0000-4000-8000-000000000401",
        status: "NEW",
        currency: "INR",
        items: [
          {
            menuItemId,
            name: paneer.name,
            quantity: 2,
            unitPrice: "260.00",
            lineTotal: "520.00"
          }
        ],
        totalAmount: "520.00",
        createdAt: "2026-10-21T20:30:00.000Z"
      }
    }))
  };
}

function createService() {
  const menuRepository = createMenuRepository();
  const quoteRepository = createQuoteRepository();
  const orderRepository = createOrderRepository();
  return {
    service: new ToolGatewayService(menuRepository, quoteRepository, orderRepository),
    menuRepository,
    quoteRepository,
    orderRepository
  };
}

describe("tool gateway authentication primitive", () => {
  const secret = "a-strong-test-secret-with-at-least-32-characters";

  it("accepts only the exact bearer secret", () => {
    expect(hasValidGatewayAuthorization(`Bearer ${secret}`, secret)).toBe(true);
    expect(hasValidGatewayAuthorization(undefined, secret)).toBe(false);
    expect(hasValidGatewayAuthorization("Bearer wrong", secret)).toBe(false);
    expect(hasValidGatewayAuthorization(secret, secret)).toBe(false);
  });

  it("passes a valid request and rejects missing or invalid credentials uniformly", () => {
    const middleware = createToolGatewayAuthMiddleware(() => secret);
    const next = vi.fn();
    const request = { header: vi.fn((name: string) => (name === "authorization" ? `Bearer ${secret}` : undefined)) };

    middleware(request as never, {} as never, next);
    expect(next).toHaveBeenCalledWith();

    const rejectedNext = vi.fn();
    middleware({ header: vi.fn(() => "Bearer incorrect") } as never, {} as never, rejectedNext);
    expect(rejectedNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});

describe("ToolGatewayService", () => {
  it("uses the existing menu repository for get_menu", async () => {
    const { service, menuRepository } = createService();

    await expect(service.invoke("get_menu", {})).resolves.toEqual({
      tool: "get_menu",
      data: { items: [paneer] }
    });
    expect(menuRepository.listAvailable).toHaveBeenCalledOnce();
  });

  it("uses available-only menu details and rejects an unknown item", async () => {
    const { service, menuRepository } = createService();

    await expect(service.invoke("get_item_details", { menuItemId })).resolves.toEqual({
      tool: "get_item_details",
      data: { item: paneer }
    });
    expect(menuRepository.findAvailableById).toHaveBeenCalledWith(menuItemId);
    await expect(
      service.invoke("get_item_details", {
        menuItemId: "00000000-0000-4000-8000-000000000999"
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("strictly validates tool arguments before accessing trusted data", async () => {
    const { service, menuRepository } = createService();

    await expect(service.invoke("get_menu", { unexpected: true })).rejects.toMatchObject({
      statusCode: 400
    });
    await expect(service.invoke("quote_order", { items: [] })).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.invoke("quote_order", {
        items: [{ menuItemId, quantity: 1, price: "0.01" }]
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.invoke("get_item_details", { menuItemId: "not-a-uuid" })
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.invoke("quote_order", { items: [{ menuItemId, quantity: 51 }] })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(menuRepository.findByIds).not.toHaveBeenCalled();
  });

  it("reuses trusted quote creation and returns its quote capability unchanged", async () => {
    const { service, quoteRepository } = createService();

    const result = await service.invoke("quote_order", {
      items: [{ menuItemId, quantity: 2 }]
    });

    expect(result.tool).toBe("quote_order");
    expect(result.data).toMatchObject({
      quoteId,
      totalAmount: "520.00",
      currency: "INR",
      confirmationToken: expect.any(String),
      expiresAt: "2026-10-22T00:05:00.000Z"
    });
    expect(quoteRepository.createQuote).toHaveBeenCalledOnce();
  });

  it("reuses the order service and does not turn a repository failure into success", async () => {
    const { service, orderRepository } = createService();
    const request = {
      quoteId,
      confirmationToken: "a".repeat(43),
      idempotencyKey: "idempotency-key-0001",
      items: [{ menuItemId, quantity: 2 }]
    };

    await expect(service.invoke("place_order", request)).resolves.toMatchObject({
      tool: "place_order",
      data: { id: "00000000-0000-4000-8000-000000000401", replayed: false }
    });
    expect(orderRepository.createConfirmedOrder).toHaveBeenCalledOnce();

    const failingService = new ToolGatewayService(
      createMenuRepository(),
      createQuoteRepository(),
      { createConfirmedOrder: async () => { throw new AppError("Invalid confirmation token", 400); } }
    );
    await expect(failingService.invoke("place_order", request)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("preserves a safe idempotent replay returned by the existing order repository", async () => {
    const replayedOrderRepository = createOrderRepository();
    (replayedOrderRepository.createConfirmedOrder as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      replayed: true,
      order: {
        id: "00000000-0000-4000-8000-000000000401",
        status: "NEW",
        currency: "INR",
        items: [],
        totalAmount: "520.00",
        createdAt: "2026-10-21T20:30:00.000Z"
      }
    });
    const service = new ToolGatewayService(
      createMenuRepository(),
      createQuoteRepository(),
      replayedOrderRepository
    );

    await expect(
      service.invoke("place_order", {
        quoteId,
        confirmationToken: "a".repeat(43),
        idempotencyKey: "idempotency-key-0001",
        items: [{ menuItemId, quantity: 2 }]
      })
    ).resolves.toMatchObject({ data: { replayed: true, id: "00000000-0000-4000-8000-000000000401" } });
  });

  it("rejects invalid and unknown tool names before dispatch", () => {
    expect(toolNameSchema.safeParse("delete_everything").success).toBe(false);
    expect(toolNameSchema.safeParse("quote_order").success).toBe(true);
  });
});
