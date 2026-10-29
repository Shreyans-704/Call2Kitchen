import { createHash, randomBytes } from "node:crypto";

import type { MenuRepository } from "../menu/menu.types.js";
import type { QuoteRepository } from "./order.types.js";
import type { QuoteRequest } from "./quote.schema.js";
import { QuoteService } from "./quote.service.js";

const quoteLifetimeMs = 5 * 60 * 1000;

/**
 * Creates the persisted, single-use capability that turns a trusted price
 * calculation into a quote which can later be confirmed exactly once.
 */
export class QuoteCreationService {
  private readonly quoteService: QuoteService;

  constructor(
    menuRepository: MenuRepository,
    private readonly quoteRepository: QuoteRepository
  ) {
    this.quoteService = new QuoteService(menuRepository);
  }

  async createQuote(request: QuoteRequest) {
    const quote = await this.quoteService.createQuote(request);
    const confirmationToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + quoteLifetimeMs).toISOString();
    const storedQuote = await this.quoteRepository.createQuote({
      restaurantId: quote.restaurantId,
      requestedItems: request.items,
      quotedItems: quote.items,
      totalAmount: quote.totalAmount,
      confirmationTokenHash: createHash("sha256").update(confirmationToken).digest("hex"),
      expiresAt
    });

    return {
      items: quote.items,
      totalAmount: quote.totalAmount,
      currency: quote.currency,
      quoteId: storedQuote.id,
      confirmationToken,
      expiresAt: storedQuote.expiresAt
    };
  }
}
