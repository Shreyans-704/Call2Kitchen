import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import type { MenuItem, MenuRepository } from "../src/menu/menu.types.js";
import type { QuoteRepository } from "../src/orders/order.types.js";

const paneer: MenuItem = {
  id: "00000000-0000-4000-8000-000000000103",
  restaurantId: "00000000-0000-4000-8000-000000000001",
  name: "Paneer Butter Masala",
  description: "Paneer in a rich tomato and butter gravy",
  price: "260.00",
  category: "Main Course",
  isAvailable: true,
  allergens: ["dairy", "cashew"]
};

const dal: MenuItem = {
  id: "00000000-0000-4000-8000-000000000104",
  restaurantId: paneer.restaurantId,
  name: "Dal Tadka",
  description: "Yellow lentils tempered with garlic and spices",
  price: "190.00",
  category: "Main Course",
  isAvailable: true,
  allergens: []
};

function createRepository(menuItems: MenuItem[] = [paneer, dal]): MenuRepository {
  return {
    listAvailable: async () => menuItems.filter((item) => item.isAvailable),
    findAvailableById: async (id) => menuItems.find((item) => item.id === id && item.isAvailable) ?? null,
    findByIds: async (ids) => menuItems.filter((item) => ids.includes(item.id))
  };
}

function createQuoteRepository(): QuoteRepository {
  return {
    createQuote: async () => ({
      id: "00000000-0000-4000-8000-000000000301",
      expiresAt: "2026-10-21T20:30:00.000Z"
    })
  };
}

function createQuoteApp(menuRepository: MenuRepository) {
  return createApp({ menuRepository, quoteRepository: createQuoteRepository() });
}

function quoteRequest(items: unknown[]) {
  return { items };
}

describe("POST /api/orders/quote", () => {
  it("returns a trusted quote for one valid item", async () => {
    const response = await request(createQuoteApp(createRepository()))
      .post("/api/orders/quote")
      .send(quoteRequest([{ menuItemId: paneer.id, quantity: 2 }]));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        items: [
          {
            menuItemId: paneer.id,
            name: "Paneer Butter Masala",
            quantity: 2,
            unitPrice: "260.00",
            lineTotal: "520.00"
          }
        ],
        totalAmount: "520.00",
        currency: "INR",
        quoteId: "00000000-0000-4000-8000-000000000301",
        confirmationToken: expect.any(String),
        expiresAt: "2026-10-21T20:30:00.000Z"
      }
    });
  });

  it("adds multiple line items using exact minor-unit arithmetic", async () => {
    const tenPaise: MenuItem = { ...paneer, id: "00000000-0000-4000-8000-000000000201", name: "Test 0.10", price: "0.10" };
    const twentyPaise: MenuItem = { ...paneer, id: "00000000-0000-4000-8000-000000000202", name: "Test 0.20", price: "0.20" };
    const response = await request(createQuoteApp(createRepository([tenPaise, twentyPaise])))
      .post("/api/orders/quote")
      .send(
        quoteRequest([
          { menuItemId: tenPaise.id, quantity: 3 },
          { menuItemId: twentyPaise.id, quantity: 1 }
        ])
      );

    expect(response.status).toBe(200);
    expect(response.body.data.items[0].lineTotal).toBe("0.30");
    expect(response.body.data.items[1].lineTotal).toBe("0.20");
    expect(response.body.data.totalAmount).toBe("0.50");
  });

  it("rejects an invalid menu item id", async () => {
    const response = await request(createQuoteApp(createRepository()))
      .post("/api/orders/quote")
      .send(quoteRequest([{ menuItemId: "not-a-uuid", quantity: 1 }]));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { message: "Invalid quote request", statusCode: 400 } });
  });

  it("rejects an empty items array", async () => {
    const response = await request(createQuoteApp(createRepository()))
      .post("/api/orders/quote")
      .send(quoteRequest([]));

    expect(response.status).toBe(400);
  });

  it.each([0, -1])("rejects a non-positive quantity of %s", async (quantity) => {
    const response = await request(createQuoteApp(createRepository()))
      .post("/api/orders/quote")
      .send(quoteRequest([{ menuItemId: paneer.id, quantity }]));

    expect(response.status).toBe(400);
  });

  it("rejects quantities greater than 50", async () => {
    const response = await request(createQuoteApp(createRepository()))
      .post("/api/orders/quote")
      .send(quoteRequest([{ menuItemId: paneer.id, quantity: 51 }]));

    expect(response.status).toBe(400);
  });

  it("rejects requests with more than 20 distinct items", async () => {
    const items = Array.from({ length: 21 }, (_, index) => ({
      menuItemId: `00000000-0000-4000-8000-${String(index + 300).padStart(12, "0")}`,
      quantity: 1
    }));
    const response = await request(createQuoteApp(createRepository()))
      .post("/api/orders/quote")
      .send(quoteRequest(items));

    expect(response.status).toBe(400);
  });

  it("rejects a missing requested menu item", async () => {
    const response = await request(createQuoteApp(createRepository()))
      .post("/api/orders/quote")
      .send(
        quoteRequest([{ menuItemId: "00000000-0000-4000-8000-000000000999", quantity: 1 }])
      );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { message: "A requested menu item was not found", statusCode: 400 }
    });
  });

  it("rejects a requested item that is unavailable", async () => {
    const unavailableItem: MenuItem = { ...paneer, isAvailable: false };
    const response = await request(createQuoteApp(createRepository([unavailableItem])))
      .post("/api/orders/quote")
      .send(quoteRequest([{ menuItemId: paneer.id, quantity: 1 }]));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { message: "A requested menu item is not available", statusCode: 400 }
    });
  });

  it("rejects a client-supplied price before it can influence a quote", async () => {
    const findByIds = vi.fn<MenuRepository["findByIds"]>();
    const repository = createRepository();
    repository.findByIds = findByIds;

    const response = await request(createQuoteApp(repository))
      .post("/api/orders/quote")
      .send(quoteRequest([{ menuItemId: paneer.id, quantity: 1, price: "0.01" }]));

    expect(response.status).toBe(400);
    expect(findByIds).not.toHaveBeenCalled();
  });

  it("returns a safe error when the menu database lookup fails", async () => {
    const errorLogger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const repository = createRepository();
    repository.findByIds = async () => {
      throw new Error("database password or private host detail");
    };

    const response = await request(createQuoteApp(repository))
      .post("/api/orders/quote")
      .send(quoteRequest([{ menuItemId: paneer.id, quantity: 1 }]));

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { message: "Internal server error", statusCode: 500 } });
    expect(JSON.stringify(response.body)).not.toContain("private host");
    errorLogger.mockRestore();
  });

  it("does not create an order while quoting", async () => {
    const createOrder = vi.fn();
    const repository = Object.assign(createRepository(), { createOrder });

    const response = await request(createQuoteApp(repository))
      .post("/api/orders/quote")
      .send(quoteRequest([{ menuItemId: paneer.id, quantity: 1 }]));

    expect(response.status).toBe(200);
    expect(createOrder).not.toHaveBeenCalled();
  });
});
