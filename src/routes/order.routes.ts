import { Router } from "express";

import { AppError } from "../errors/app-error.js";
import { createOrderRequestSchema } from "../orders/order.schema.js";
import { liveOrderRepository } from "../orders/order.repository.js";
import { OrderService } from "../orders/order.service.js";
import type { OrderRepository } from "../orders/order.types.js";

export function createOrderRouter(orderRepository: OrderRepository = liveOrderRepository) {
  const router = Router();
  const orderService = new OrderService(orderRepository);

  router.post("/", async (request, response) => {
    const parsedRequest = createOrderRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      throw new AppError("Invalid order request", 400);
    }

    const result = await orderService.createOrder(parsedRequest.data);
    response.status(result.replayed ? 200 : 201).json({ data: result.order });
  });

  return router;
}
