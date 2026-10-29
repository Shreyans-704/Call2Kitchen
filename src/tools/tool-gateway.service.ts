import { z } from "zod";

import { AppError } from "../errors/app-error.js";
import type { MenuRepository } from "../menu/menu.types.js";
import { OrderService } from "../orders/order.service.js";
import { createOrderRequestSchema } from "../orders/order.schema.js";
import type { OrderRepository, QuoteRepository } from "../orders/order.types.js";
import { QuoteCreationService } from "../orders/quote-creation.service.js";
import { quoteRequestSchema } from "../orders/quote.schema.js";

export const toolNameSchema = z.enum([
  "get_menu",
  "get_item_details",
  "quote_order",
  "place_order"
]);

export type ToolName = z.infer<typeof toolNameSchema>;

const noArgumentsSchema = z.object({}).strict();
const itemDetailsArgumentsSchema = z
  .object({
    menuItemId: z.string().uuid("menuItemId must be a valid UUID")
  })
  .strict();

export type ToolGatewayResult = {
  tool: ToolName;
  data: unknown;
};

/**
 * A deliberately small adapter between an authenticated voice tool and the
 * existing business services. It contains no alternate pricing, confirmation,
 * or persistence path.
 */
export class ToolGatewayService {
  private readonly quoteCreationService: QuoteCreationService;
  private readonly orderService: OrderService;

  constructor(
    private readonly menuRepository: MenuRepository,
    quoteRepository: QuoteRepository,
    orderRepository: OrderRepository
  ) {
    this.quoteCreationService = new QuoteCreationService(menuRepository, quoteRepository);
    this.orderService = new OrderService(orderRepository);
  }

  async invoke(tool: ToolName, argumentsValue: unknown): Promise<ToolGatewayResult> {
    switch (tool) {
      case "get_menu": {
        ensureValidArguments(noArgumentsSchema, argumentsValue);
        return { tool, data: { items: await this.menuRepository.listAvailable() } };
      }

      case "get_item_details": {
        const argumentsData = ensureValidArguments(itemDetailsArgumentsSchema, argumentsValue);
        const item = await this.menuRepository.findAvailableById(argumentsData.menuItemId);

        if (!item) {
          throw new AppError("Menu item not found", 404);
        }

        return { tool, data: { item } };
      }

      case "quote_order": {
        const argumentsData = ensureValidArguments(quoteRequestSchema, argumentsValue);
        return { tool, data: await this.quoteCreationService.createQuote(argumentsData) };
      }

      case "place_order": {
        const argumentsData = ensureValidArguments(createOrderRequestSchema, argumentsValue);
        const result = await this.orderService.createOrder(argumentsData);
        return { tool, data: { ...result.order, replayed: result.replayed } };
      }
    }
  }
}

function ensureValidArguments<Schema extends z.ZodTypeAny>(schema: Schema, value: unknown): z.infer<Schema> {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new AppError("Invalid tool arguments", 400);
  }

  return parsed.data;
}
