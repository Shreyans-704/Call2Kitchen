import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getSupabaseClient } from "../lib/supabase.js";
import type { MenuItem, MenuRepository } from "./menu.types.js";

const menuItemRowSchema = z.object({
  id: z.string().uuid(),
  restaurant_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.union([z.string().regex(/^\d+\.\d{2}$/), z.number().finite().nonnegative()]),
  category: z.string(),
  is_available: z.boolean(),
  allergens: z.array(z.string()).nullable()
});

const menuItemColumns =
  "id, restaurant_id, name, description, price, category, is_available, allergens";

export function createSupabaseMenuRepository(client: SupabaseClient): MenuRepository {
  return {
    async listAvailable() {
      const { data, error } = await client
        .from("menu_items")
        .select(menuItemColumns)
        .eq("is_available", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        throw new Error("Could not retrieve menu items from the database", { cause: error });
      }

      return z.array(menuItemRowSchema).parse(data ?? []).map(toMenuItem);
    },

    async findAvailableById(id) {
      const { data, error } = await client
        .from("menu_items")
        .select(menuItemColumns)
        .eq("id", id)
        .eq("is_available", true)
        .maybeSingle();

      if (error) {
        throw new Error("Could not retrieve the menu item from the database", { cause: error });
      }

      return data ? toMenuItem(menuItemRowSchema.parse(data)) : null;
    },

    async findByIds(ids) {
      const { data, error } = await client
        .from("menu_items")
        .select(menuItemColumns)
        .in("id", ids);

      if (error) {
        throw new Error("Could not retrieve requested menu items from the database", { cause: error });
      }

      return z.array(menuItemRowSchema).parse(data ?? []).map(toMenuItem);
    }
  };
}

/**
 * Defers real client creation until a menu request, so importing app.ts stays
 * credential-free for tests and tooling.
 */
export const liveMenuRepository: MenuRepository = {
  listAvailable: () => createSupabaseMenuRepository(getSupabaseClient()).listAvailable(),
  findAvailableById: (id) => createSupabaseMenuRepository(getSupabaseClient()).findAvailableById(id),
  findByIds: (ids) => createSupabaseMenuRepository(getSupabaseClient()).findByIds(ids)
};

function toMenuItem(row: z.infer<typeof menuItemRowSchema>): MenuItem {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    description: row.description,
    // The database column is NUMERIC(12,2). A string stays exact; a number is
    // rounded back to two decimal places before leaving the API boundary.
    price: typeof row.price === "number" ? row.price.toFixed(2) : row.price,
    category: row.category,
    isAvailable: row.is_available,
    allergens: row.allergens ?? []
  };
}
