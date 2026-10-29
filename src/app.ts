import express from "express";

import { errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware.js";
import { disableDirectOrderApiWhenGatewayEnabled } from "./middleware/direct-order-api.middleware.js";
import { createMenuRouter } from "./routes/menu.routes.js";
import { createOrderRouter } from "./routes/order.routes.js";
import { createQuoteRouter } from "./routes/quote.routes.js";
import { createToolsRouter } from "./routes/tools.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import type { MenuRepository } from "./menu/menu.types.js";
import type { OrderRepository, QuoteRepository } from "./orders/order.types.js";

export function createApp(
  dependencies: {
    menuRepository?: MenuRepository;
    quoteRepository?: QuoteRepository;
    orderRepository?: OrderRepository;
    gatewaySecret?: string;
  } = {}
) {
  const app = express();

  app.use(express.json({ limit: "16kb" }));
  app.use("/api", healthRouter);
  app.use("/api/menu", createMenuRouter(dependencies.menuRepository));
  app.use("/api/orders", disableDirectOrderApiWhenGatewayEnabled);
  app.use("/api/orders", createQuoteRouter(dependencies.menuRepository, dependencies.quoteRepository));
  app.use("/api/orders", createOrderRouter(dependencies.orderRepository));
  app.use(
    "/api/tools",
    createToolsRouter({
      menuRepository: dependencies.menuRepository,
      quoteRepository: dependencies.quoteRepository,
      orderRepository: dependencies.orderRepository,
      gatewaySecret: dependencies.gatewaySecret
    })
  );

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

export const app = createApp();
