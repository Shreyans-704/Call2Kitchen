import { z } from "zod";

const quoteItemSchema = z
  .object({
    menuItemId: z.string().uuid("menuItemId must be a valid UUID"),
    quantity: z.number().int("quantity must be an integer").min(1).max(50)
  })
  .strict();

export const quoteRequestSchema = z
  .object({
    items: z.array(quoteItemSchema).min(1).max(20)
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

export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
