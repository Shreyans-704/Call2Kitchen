import { Router } from "express";

import { AppError } from "../errors/app-error.js";
import { liveMenuRepository } from "../menu/menu.repository.js";
import type { MenuRepository } from "../menu/menu.types.js";
import { quoteRequestSchema } from "../orders/quote.schema.js";
import { liveQuoteRepository } from "../orders/quote.repository.js";
import { QuoteCreationService } from "../orders/quote-creation.service.js";
import type { QuoteRepository } from "../orders/order.types.js";

export function createQuoteRouter(
  menuRepository: MenuRepository = liveMenuRepository,
  quoteRepository: QuoteRepository = liveQuoteRepository
) {
  const router = Router();
  const quoteCreationService = new QuoteCreationService(menuRepository, quoteRepository);

  router.post("/quote", async (request, response) => {
    const parsedRequest = quoteRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      throw new AppError("Invalid quote request", 400);
    }

    const quote = await quoteCreationService.createQuote(parsedRequest.data);

    response.status(200).json({
      data: {
        ...quote
      }
    });
  });

  return router;
}
