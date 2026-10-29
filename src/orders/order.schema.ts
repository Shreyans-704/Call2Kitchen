import { z } from "zod";

const orderItemSchema = z
  .object({
    menuItemId: z.string().uuid("menuItemId must be a valid UUID"),
    quantity: z.number().int("quantity must be an integer").min(1).max(50)
  })
  .strict();

export const createOrderRequestSchema = z
  .object({
    quoteId: z.string().uuid("quoteId must be a valid UUID"),
    confirmationToken: z.string().min(32).max(200),
    idempotencyKey: z.string().min(16).max(200),
    items: z.array(orderItemSchema).min(1).max(20)
  })
  .strict()
  .superRefine((request, context) => {
    const itemIds = new Set<string>();

    request.items.forEach((item, index) => {
      if (itemIds.has(item.menuItemId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "menuItemId"],
          message: "Duplicate menu item ids are not supported"
        });
      }
      itemIds.add(item.menuItemId);
    });
  });

export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;
