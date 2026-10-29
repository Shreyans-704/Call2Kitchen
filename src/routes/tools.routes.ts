import { Router } from "express";

import { AppError } from "../errors/app-error.js";
import { liveMenuRepository } from "../menu/menu.repository.js";
import type { MenuRepository } from "../menu/menu.types.js";
import { createToolGatewayAuthMiddleware } from "../middleware/tool-gateway-auth.middleware.js";
import { liveOrderRepository } from "../orders/order.repository.js";
import type { OrderRepository, QuoteRepository } from "../orders/order.types.js";
import { liveQuoteRepository } from "../orders/quote.repository.js";
import { ToolGatewayService, toolNameSchema } from "../tools/tool-gateway.service.js";

const toolTimeoutMs = 8_000;

export function createToolsRouter(
  dependencies: {
    menuRepository?: MenuRepository;
    quoteRepository?: QuoteRepository;
    orderRepository?: OrderRepository;
    gatewaySecret?: string;
  } = {}
) {
  const router = Router();
  const service = new ToolGatewayService(
    dependencies.menuRepository ?? liveMenuRepository,
    dependencies.quoteRepository ?? liveQuoteRepository,
    dependencies.orderRepository ?? liveOrderRepository
  );
  const secretProvider = dependencies.gatewaySecret
    ? () => dependencies.gatewaySecret
    : undefined;

  router.post(
    "/:toolName",
    createToolGatewayAuthMiddleware(secretProvider),
    async (request, response) => {
      const parsedToolName = toolNameSchema.safeParse(request.params.toolName);

      if (!parsedToolName.success) {
        throw new AppError("Unknown tool", 404);
      }

      const result = await withToolTimeout(service.invoke(parsedToolName.data, request.body));
      response.status(200).json({ success: true, tool: result.tool, data: result.data });
    }
  );

  return router;
}

/**
 * A timeout never reports an order as successful. If a write completes after
 * the caller times out, a retry must reuse the same idempotency key.
 */
function withToolTimeout<Result>(operation: Promise<Result>): Promise<Result> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutResult = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new AppError("Tool request timed out", 504)), toolTimeoutMs);
  });

  return Promise.race([operation, timeoutResult]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}
