# Supabase staging verification — Phase 7

This checklist verifies the real PostgreSQL schema and `create_confirmed_order` RPC. It is intentionally manual because this workspace has no configured Supabase environment. Run it only against a disposable or clearly approved **staging** project after all four migrations have been applied in order.

Do not put service-role keys, database passwords, complete connection strings, or confirmation tokens in this document, shell history, source control, issue trackers, or chat.

## Before writing data

1. Confirm the project is staging using your team's deployment records, not an assumed project name or URL.
2. Apply the migrations in this order:
   - `supabase/migrations/20261021180000_create_restaurants_and_menu_items.sql`
   - `supabase/seed.sql`
   - `supabase/migrations/20261021202000_create_order_confirmation_and_orders.sql`
   - `supabase/migrations/20261021230000_harden_order_rpc_and_rls.sql`
3. Run the read-only catalog checks in the README. Confirm RLS is on for `order_quotes`, `orders`, and `order_items`, and that only `service_role` has RPC execution access among application roles.
4. Start the backend with staging-only environment configuration. For tool-gateway testing, set `TOOL_GATEWAY_ENABLED=true` and use the protected gateway credential only in the test client.

## Test matrix

Use `get_menu` to retrieve real staging menu IDs. Create each quote through `quote_order`, retain its quote ID and confirmation token only in the secure test client, then make `place_order` requests.

| Case | Action | Expected result |
| --- | --- | --- |
| Valid quote | Quote one available item. | Trusted line items, INR total, quote ID, token, and future expiry are returned. |
| Valid order | Place the exact quoted request once. | New order response; `orders` has one row and `order_items` has matching price/name snapshots. |
| Exact money | Quote items with non-integer amounts or use test values `0.10` and `0.20` in an isolated staging fixture. | Totals are exact decimal strings, never floating-point artifacts. |
| Invalid token | Submit a well-formed but incorrect token. | Safe client error; no order row. |
| Expired quote | Wait past expiry or create an approved short-lived staging fixture. | Safe client error; no order row. |
| Consumed quote | Submit the same quote with a new idempotency key after success. | Rejected; no second order. |
| Missing item | Remove or use a test-only quote/menu mismatch in a disposable environment. | Rejected; no order row. |
| Unavailable item | Mark a test-only menu item unavailable after quoting. | Rejected; no order row. |
| Price/name change | Change a test-only menu item's price or name after quoting. | `quote_changed`; no order row. Restore the fixture afterward. |
| Cross restaurant | Build a test quote with items from different restaurant IDs only in a disposable fixture. | Rejected by trusted quote/order checks. |
| Replay | Resend the exact successful body with the same idempotency key. | Same order ID, replay response, still one order row. |
| Key conflict | Reuse a successful idempotency key with different items or quote. | HTTP 409/client conflict; no additional order. |
| Concurrent retry | Send two identical requests simultaneously with one quote and key. | One persisted order; the other request returns the same order as a replay after locking. |
| Rollback | In a disposable project, temporarily add a transaction-local trigger that raises during `order_items` insertion, then submit a valid request. Remove the trigger immediately. | RPC fails and neither `orders` nor `order_items` receives a partial row. |
| RPC permission | From an anon/authenticated test context, attempt the RPC without using the server-side service role. | Execute is denied. The backend service-role path continues to work. |

Never use production menu rows for price/name/availability mutation tests. Prefer a separate restaurant and clearly named test records, for example `PHASE7_TEST_ONLY`, then remove only those records after confirming their IDs and references.

## Read-only persistence checks

After a successful result, use its order ID—not a confirmation token—to inspect snapshots:

```sql
select id, quote_id, status, total_amount, currency, idempotency_key, created_at
from public.orders
where id = '<returned-order-id>';

select menu_item_id, item_name, quantity, unit_price, line_total, line_number
from public.order_items
where order_id = '<returned-order-id>'
order by line_number;
```

For rollback cases, compare counts for the known test quote before and after the deliberately failed RPC. For concurrent cases, confirm one `orders` row for the quote and one set of ordered item snapshots.

## Evidence to record safely

Record the staging project label, migration filenames, UTC time, test case, HTTP status, returned order ID where applicable, and pass/fail result. Do not record secrets, full request bodies containing confirmation tokens, or raw Supabase error details.

## What this checklist proves

It can prove actual PostgreSQL transaction behavior, function permissions, RLS behavior, and Supabase RPC integration only when executed against staging. Local source review and mocked/unit tests do not replace those checks.
