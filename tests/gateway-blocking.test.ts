import { describe, expect, it, vi } from "vitest";
import request from "supertest";

// When the gateway is enabled, direct /api/orders/* routes must remain
// inaccessible (404) while menu reads stay public. Mock the env module with
// TOOL_GATEWAY_ENABLED=true to prove production route protection is unchanged.
const testEnv = vi.hoisted(() => ({
  env: { NODE_ENV: "test", PORT: 3000, TOOL_GATEWAY_ENABLED: true },
  getSupabaseEnvironment: vi.fn(),
  getToolGatewayEnvironment: vi.fn(),
  getBolnaEnvironment: vi.fn(),
}));

vi.mock("../src/lib/env.js", () => testEnv);

import { createApp } from "../src/app.js";
import type { MenuItem, MenuRepository } from "../src/menu/menu.types.js";
import type { OrderRepository } from "../src/orders/order.types.js";

const availableItem: MenuItem = {
  id: "00000000-0000-4000-8000-000000000103",
  restaurantId: "00000000-0000-4000-8000-000000000001",
  name: "Paneer Butter Masala",
  description: "Paneer in a rich tomato and butter gravy",
  price: "260.00",
  category: "Main Course",
  isAvailable: true,
  allergens: ["dairy", "cashew"]
};

function createRepository(): MenuRepository {
  return {
    listAvailable: async () => [availableItem],
    findAvailableById: async () => availableItem,
    findByIds: async () => [availableItem]
  };
}

const orderRepository: OrderRepository = {
  createConfirmedOrder: vi.fn(async () => ({
    replayed: false,
    order: {
      id: "00000000-0000-4000-8000-000000000401",
      status: "NEW" as const,
      currency: "INR" as const,
      items: [],
      totalAmount: "0.00",
      createdAt: "2026-01-01T00:00:00.000Z"
    }
  }))
};

describe("Direct order routes when gateway is enabled", () => {
  it("blocks POST /api/orders/quote with 404", async () => {
    const app = createApp({ menuRepository: createRepository() });
    const response = await request(app)
      .post("/api/orders/quote")
      .send({ items: [{ menuItemId: availableItem.id, quantity: 1 }] });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { message: "Route not found", statusCode: 404 }
    });
  });

  it("blocks POST /api/orders with 404", async () => {
    const app = createApp({
      menuRepository: createRepository(),
      orderRepository
    });
    const response = await request(app)
      .post("/api/orders")
      .send({
        quoteId: "00000000-0000-4000-8000-000000000301",
        confirmationToken: "a".repeat(43),
        idempotencyKey: "idem-key-0001",
        items: [{ menuItemId: availableItem.id, quantity: 1 }]
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { message: "Route not found", statusCode: 404 }
    });
  });

  it("still allows GET /api/menu (menu reads remain public)", async () => {
    const app = createApp({ menuRepository: createRepository() });
    const response = await request(app).get("/api/menu");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [availableItem] });
  });

  it("still allows GET /api/health", async () => {
    const app = createApp();
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      message: "Call2Kitchen backend is running"
    });
  });
});
