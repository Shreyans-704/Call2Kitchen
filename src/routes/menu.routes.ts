import { Router } from "express";
import { z } from "zod";

import { AppError } from "../errors/app-error.js";
import { liveMenuRepository } from "../menu/menu.repository.js";
import type { MenuRepository } from "../menu/menu.types.js";

const menuItemParamsSchema = z.object({
  id: z.string().uuid("Menu item id must be a valid UUID")
});

export function createMenuRouter(menuRepository: MenuRepository = liveMenuRepository) {
  const router = Router();

  router.get("/", async (_request, response) => {
    const items = await menuRepository.listAvailable();
    response.status(200).json({ data: items });
  });

  router.get("/:id", async (request, response) => {
    const parsedParams = menuItemParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      throw new AppError("Menu item id must be a valid UUID", 400);
    }

    const item = await menuRepository.findAvailableById(parsedParams.data.id);

    if (!item) {
      throw new AppError("Menu item not found", 404);
    }

    response.status(200).json({ data: item });
  });

  return router;
}
