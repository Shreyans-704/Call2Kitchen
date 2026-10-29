import type { SupabaseClient } from "@supabase/supabase-js";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { createSupabaseMenuRepository } from "../src/menu/menu.repository.js";
import type { MenuItem, MenuRepository } from "../src/menu/menu.types.js";

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

function createRepository(overrides: Partial<MenuRepository> = {}): MenuRepository {
  return {
    listAvailable: async () => [availableItem],
    findAvailableById: async (id) => (id === availableItem.id ? availableItem : null),
    findByIds: async (ids) => (ids.includes(availableItem.id) ? [availableItem] : []),
    ...overrides
  };
}

describe("GET /api/menu", () => {
  it("returns the documented menu response structure", async () => {
    const response = await request(createApp({ menuRepository: createRepository() })).get("/api/menu");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/json/);
    expect(response.body).toEqual({ data: [availableItem] });
  });

  it("does not return unavailable items", async () => {
    const unavailableItem: MenuItem = { ...availableItem, id: "00000000-0000-4000-8000-000000000107", isAvailable: false };
    const repository = createRepository({
      // This mirrors the database repository contract: listAvailable exposes
      // only records that were filtered with is_available = true.
      listAvailable: async () => [availableItem]
    });

    const response = await request(createApp({ menuRepository: repository })).get("/api/menu");

    expect(response.body.data).not.toContainEqual(unavailableItem);
    expect(response.body.data).toEqual([availableItem]);
  });

  it("returns a safe server error when the database dependency fails", async () => {
    const errorLogger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const repository = createRepository({
      listAvailable: async () => {
        throw new Error("database connection failed for internal-host.example");
      }
    });

    const response = await request(createApp({ menuRepository: repository })).get("/api/menu");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { message: "Internal server error", statusCode: 500 }
    });
    expect(JSON.stringify(response.body)).not.toContain("internal-host.example");
    expect(errorLogger).toHaveBeenCalledTimes(1);
    errorLogger.mockRestore();
  });
});

describe("GET /api/menu/:id", () => {
  it("returns one available menu item", async () => {
    const response = await request(createApp({ menuRepository: createRepository() })).get(
      `/api/menu/${availableItem.id}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: availableItem });
  });

  it("rejects an invalid menu item id before querying the database", async () => {
    const findAvailableById = vi.fn<MenuRepository["findAvailableById"]>();
    const repository = createRepository({ findAvailableById });

    const response = await request(createApp({ menuRepository: repository })).get("/api/menu/not-a-uuid");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { message: "Menu item id must be a valid UUID", statusCode: 400 }
    });
    expect(findAvailableById).not.toHaveBeenCalled();
  });

  it("returns 404 when an item is missing or unavailable", async () => {
    const response = await request(
      createApp({ menuRepository: createRepository({ findAvailableById: async () => null }) })
    ).get(`/api/menu/${availableItem.id}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { message: "Menu item not found", statusCode: 404 }
    });
  });
});

describe("Supabase menu repository", () => {
  it("filters the list query to available items and orders it by category then name", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn()
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValueOnce(query).mockResolvedValueOnce({
      data: [
        {
          id: availableItem.id,
          restaurant_id: availableItem.restaurantId,
          name: availableItem.name,
          description: availableItem.description,
          price: availableItem.price,
          category: availableItem.category,
          is_available: true,
          allergens: availableItem.allergens
        }
      ],
      error: null
    });
    const client = { from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient;

    const items = await createSupabaseMenuRepository(client).listAvailable();

    expect(query.eq).toHaveBeenCalledWith("is_available", true);
    expect(query.order).toHaveBeenNthCalledWith(1, "category", { ascending: true });
    expect(query.order).toHaveBeenNthCalledWith(2, "name", { ascending: true });
    expect(items).toEqual([availableItem]);
  });
});
