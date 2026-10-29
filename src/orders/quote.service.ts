import { AppError } from "../errors/app-error.js";
import type { MenuRepository } from "../menu/menu.types.js";
import type { QuoteRequest } from "./quote.schema.js";

export type QuoteLineItem = {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

export type OrderQuote = {
  items: QuoteLineItem[];
  totalAmount: string;
  currency: "INR";
};

export type TrustedOrderQuote = OrderQuote & {
  restaurantId: string;
};

export class QuoteService {
  constructor(private readonly menuRepository: MenuRepository) {}

  async createQuote(request: QuoteRequest): Promise<TrustedOrderQuote> {
    const requestedIds = request.items.map((item) => item.menuItemId);
    const menuItems = await this.menuRepository.findByIds(requestedIds);
    const menuItemsById = new Map(menuItems.map((item) => [item.id, item]));

    let totalMinorUnits = 0n;
    let restaurantId: string | undefined;
    const quoteItems = request.items.map((requestedItem) => {
      const menuItem = menuItemsById.get(requestedItem.menuItemId);

      if (!menuItem) {
        throw new AppError("A requested menu item was not found", 400);
      }

      if (!menuItem.isAvailable) {
        throw new AppError("A requested menu item is not available", 400);
      }

      if (restaurantId && menuItem.restaurantId !== restaurantId) {
        throw new AppError("All requested menu items must belong to one restaurant", 400);
      }
      restaurantId = menuItem.restaurantId;

      const unitPriceMinorUnits = parsePriceToMinorUnits(menuItem.price);
      const lineTotalMinorUnits = unitPriceMinorUnits * BigInt(requestedItem.quantity);
      totalMinorUnits += lineTotalMinorUnits;

      return {
        menuItemId: menuItem.id,
        name: menuItem.name,
        quantity: requestedItem.quantity,
        unitPrice: formatMinorUnits(unitPriceMinorUnits),
        lineTotal: formatMinorUnits(lineTotalMinorUnits)
      };
    });

    return {
      items: quoteItems,
      totalAmount: formatMinorUnits(totalMinorUnits),
      currency: "INR",
      restaurantId: restaurantId!
    };
  }
}

/** Converts a trusted NUMERIC(12,2) API value into exact paise. */
function parsePriceToMinorUnits(price: string): bigint {
  const matchedPrice = /^(\d+)\.(\d{2})$/.exec(price);

  if (!matchedPrice) {
    throw new Error("Menu item has an invalid database price format");
  }

  return BigInt(matchedPrice[1]) * 100n + BigInt(matchedPrice[2]);
}

function formatMinorUnits(amount: bigint): string {
  const rupees = amount / 100n;
  const paise = (amount % 100n).toString().padStart(2, "0");
  return `${rupees}.${paise}`;
}
