import type { QuoteLineItem } from "./quote.service.js";

export type RequestedOrderItem = {
  menuItemId: string;
  quantity: number;
};

export type StoredQuote = {
  id: string;
  expiresAt: string;
};

export interface QuoteRepository {
  createQuote(input: {
    restaurantId: string;
    requestedItems: RequestedOrderItem[];
    quotedItems: QuoteLineItem[];
    totalAmount: string;
    confirmationTokenHash: string;
    expiresAt: string;
  }): Promise<StoredQuote>;
}

export type PersistedOrderItem = {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

export type PersistedOrder = {
  id: string;
  status: "NEW";
  currency: "INR";
  items: PersistedOrderItem[];
  totalAmount: string;
  createdAt: string;
};

export interface OrderRepository {
  createConfirmedOrder(input: {
    quoteId: string;
    confirmationTokenHash: string;
    idempotencyKey: string;
    requestHash: string;
    requestedItems: RequestedOrderItem[];
  }): Promise<{ order: PersistedOrder; replayed: boolean }>;
}
